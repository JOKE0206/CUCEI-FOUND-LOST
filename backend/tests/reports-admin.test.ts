import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { createTestContext, foundPublication } from "./helpers/context";

async function setup() {
  const context = createTestContext();
  const ana = context.addUser("ana");
  const beto = context.addUser("beto");
  const carla = context.addUser("carla");
  const admin = context.addUser("admin", { role: "admin" });
  const publication = await context.services.publicaciones.create(ana, foundPublication());

  return {
    ...context,
    ana,
    beto,
    carla,
    admin,
    publicationId: publication.id,
    reports: context.services.reports,
    adminService: context.services.admin,
  };
}

const publicationReport = (targetPublicationId: string) => ({
  targetPublicationId,
  targetUserId: null,
  reason: "Contenido fraudulento",
});
const userReport = (targetUserId: string) => ({
  targetPublicationId: null,
  targetUserId,
  reason: "Comportamiento inapropiado",
});

describe("reportes", () => {
  it("registra a quien reporta desde su identidad y queda pendiente", async () => {
    const { reports, beto, db, publicationId } = await setup();
    const report = await reports.create(beto, publicationReport(publicationId));

    expect(report.status).toBe("pending");
    expect(db.reports.get(report.id)!.reporterId).toBe(beto.id);
    expect(report).not.toHaveProperty("reviewedBy");
  });

  it("permite reportar a un usuario", async () => {
    const { reports, ana, beto } = await setup();
    await expect(reports.create(beto, userReport(ana.id))).resolves.toMatchObject({
      targetUserId: ana.id,
    });
  });

  it("no permite reportarse a sí mismo ni a su publicación", async () => {
    const { reports, ana, publicationId } = await setup();

    await expect(reports.create(ana, userReport(ana.id))).rejects.toMatchObject({ status: 422 });
    await expect(reports.create(ana, publicationReport(publicationId))).rejects.toMatchObject({
      status: 422,
    });
  });

  it("responde 404 si el objetivo no existe o no es visible", async () => {
    const { reports, beto, db, publicationId } = await setup();

    await expect(reports.create(beto, userReport(randomUUID()))).rejects.toMatchObject({ status: 404 });
    await expect(reports.create(beto, publicationReport(randomUUID()))).rejects.toMatchObject({
      status: 404,
    });

    db.updatePublication(publicationId, "cancelled");
    await expect(reports.create(beto, publicationReport(publicationId))).rejects.toMatchObject({
      status: 404,
    });
  });

  it("no acepta dos reportes abiertos sobre lo mismo", async () => {
    const { reports, beto, carla, publicationId } = await setup();
    await reports.create(beto, publicationReport(publicationId));

    await expect(reports.create(beto, publicationReport(publicationId))).rejects.toMatchObject({
      status: 409,
      code: "REPORTE_EXISTENTE",
    });
    await expect(reports.create(carla, publicationReport(publicationId))).resolves.toBeTruthy();
  });

  it("se puede reportar de nuevo cuando el anterior ya se cerró", async () => {
    const { reports, adminService, admin, beto, publicationId } = await setup();
    const first = await reports.create(beto, publicationReport(publicationId));
    await adminService.decideReport(admin, first.id, "dismissed");

    await expect(reports.create(beto, publicationReport(publicationId))).resolves.toMatchObject({
      status: "pending",
    });
  });
});

describe("administración", () => {
  it("cada método exige rol admin aunque se llame directo al servicio", async () => {
    const { adminService, beto, publicationId } = await setup();
    const denied = { status: 403, code: "ADMIN_REQUERIDO" };

    await expect(adminService.listReports(beto, { page: 1, pageSize: 20 })).rejects.toMatchObject(denied);
    await expect(adminService.decideReport(beto, randomUUID(), "resolved")).rejects.toMatchObject(denied);
    await expect(adminService.moderatePublication(beto, publicationId, "remove")).rejects.toMatchObject(denied);
  });

  it("lista reportes y filtra por estado", async () => {
    const { adminService, reports, admin, ana, beto, carla, publicationId } = await setup();
    const first = await reports.create(beto, publicationReport(publicationId));
    await reports.create(carla, userReport(ana.id));
    await adminService.decideReport(admin, first.id, "resolved");

    const all = await adminService.listReports(admin, { page: 1, pageSize: 20 });
    const pending = await adminService.listReports(admin, { status: "pending", page: 1, pageSize: 20 });
    const resolved = await adminService.listReports(admin, { status: "resolved", page: 1, pageSize: 20 });

    expect(all.total).toBe(2);
    expect(pending.items).toHaveLength(1);
    expect(pending.items[0]).toMatchObject({
      reporter: { id: carla.id, displayName: "carla" },
      targetUser: { id: ana.id, displayName: "ana" },
      targetPublication: null,
    });
    expect(resolved.items[0].targetPublication).toMatchObject({ id: publicationId });
  });

  it("registra quién atendió el reporte y no se atiende dos veces", async () => {
    const { adminService, reports, admin, beto, db, publicationId } = await setup();
    const report = await reports.create(beto, publicationReport(publicationId));

    await expect(adminService.decideReport(admin, report.id, "dismissed")).resolves.toMatchObject({
      status: "dismissed",
      reviewedBy: admin.id,
    });
    expect(db.reports.get(report.id)!.reviewedAt).not.toBeNull();

    await expect(adminService.decideReport(admin, report.id, "resolved")).rejects.toMatchObject({
      status: 409,
      code: "REPORTE_CERRADO",
    });
  });

  it("un reporte inexistente responde 404", async () => {
    const { adminService, admin } = await setup();
    await expect(adminService.decideReport(admin, randomUUID(), "resolved")).rejects.toMatchObject({
      status: 404,
    });
  });

  it.each([
    ["remove", "removed"],
    ["suspend", "suspended"],
  ] as const)("%s oculta la publicación a la comunidad", async (action, status) => {
    const { adminService, services, admin, ana, beto, publicationId } = await setup();

    await expect(
      adminService.moderatePublication(admin, publicationId, action),
    ).resolves.toMatchObject({ status });

    await expect(services.publicaciones.getDetail(publicationId, beto)).rejects.toMatchObject({
      status: 404,
    });
    await expect(services.publicaciones.getDetail(publicationId, ana)).resolves.toMatchObject({
      status,
    });
  });

  it("quien reclamó ya no ve la publicación moderada", async () => {
    const { adminService, services, db, admin, beto, publicationId } = await setup();
    const answers = db
      .questionsOf(publicationId)
      .map((question) => ({ questionId: question.id, answer: "Respuesta" }));
    await services.verificacion.submitClaim(publicationId, beto, answers);

    await services.publicaciones.getDetail(publicationId, beto);
    await adminService.moderatePublication(admin, publicationId, "suspend");

    await expect(services.publicaciones.getDetail(publicationId, beto)).rejects.toMatchObject({
      status: 404,
    });
  });

  it("moderar cancela las reclamaciones abiertas sin bloquear a nadie y cierra el chat", async () => {
    const { adminService, services, db, admin, ana, beto, carla, publicationId } = await setup();
    const answers = db
      .questionsOf(publicationId)
      .map((question) => ({ questionId: question.id, answer: "Respuesta" }));
    const approved = await services.verificacion.submitClaim(publicationId, beto, answers);
    const pending = await services.verificacion.submitClaim(publicationId, carla, answers);
    const { chatId } = await services.verificacion.approve(approved.id, ana);

    await adminService.moderatePublication(admin, publicationId, "suspend");

    expect(db.claims.get(approved.id)!.status).toBe("cancelled");
    expect(db.claims.get(pending.id)!.status).toBe("cancelled");
    expect(db.chats.get(chatId)!.closedAt).not.toBeNull();
  });

  it("respeta los estados válidos", async () => {
    const { adminService, admin, db, publicationId } = await setup();

    await adminService.moderatePublication(admin, publicationId, "suspend");
    await expect(
      adminService.moderatePublication(admin, publicationId, "suspend"),
    ).rejects.toMatchObject({ status: 409 });

    await adminService.moderatePublication(admin, publicationId, "remove");
    await expect(
      adminService.moderatePublication(admin, publicationId, "remove"),
    ).rejects.toMatchObject({ status: 409 });

    db.updatePublication(publicationId, "resolved");
    await expect(
      adminService.moderatePublication(admin, publicationId, "suspend"),
    ).rejects.toMatchObject({ status: 409 });
  });

  describe("reactivación", () => {
    it("exige rol admin aunque se llame directo al servicio", async () => {
      const { adminService, beto, publicationId } = await setup();

      await expect(adminService.unsuspendPublication(beto, publicationId)).rejects.toMatchObject({
        status: 403,
        code: "ADMIN_REQUERIDO",
      });
    });

    it("devuelve la publicación a la comunidad", async () => {
      const { adminService, services, admin, beto, publicationId } = await setup();
      await adminService.moderatePublication(admin, publicationId, "suspend");

      await expect(adminService.unsuspendPublication(admin, publicationId)).resolves.toMatchObject({
        status: "active",
      });
      await expect(services.publicaciones.getDetail(publicationId, beto)).resolves.toMatchObject({
        status: "active",
      });
    });

    it("no se reactiva con reportes abiertos; sí cuando ya se atendieron", async () => {
      const { adminService, reports, admin, beto, db, publicationId } = await setup();
      const report = await reports.create(beto, publicationReport(publicationId));
      await adminService.moderatePublication(admin, publicationId, "suspend");

      await expect(adminService.unsuspendPublication(admin, publicationId)).rejects.toMatchObject({
        status: 409,
        code: "REPORTES_ABIERTOS",
      });
      expect(db.publications.get(publicationId)!.status).toBe("suspended");

      await adminService.decideReport(admin, report.id, "dismissed");
      await expect(adminService.unsuspendPublication(admin, publicationId)).resolves.toMatchObject({
        status: "active",
      });
    });

    it("quien tenía una reclamación puede volver a reclamar", async () => {
      const { adminService, services, db, admin, ana, beto, publicationId } = await setup();
      const answers = db
        .questionsOf(publicationId)
        .map((question) => ({ questionId: question.id, answer: "Respuesta" }));
      const claim = await services.verificacion.submitClaim(publicationId, beto, answers);
      const { chatId } = await services.verificacion.approve(claim.id, ana);
      await adminService.moderatePublication(admin, publicationId, "suspend");

      await adminService.unsuspendPublication(admin, publicationId);

      expect(db.chats.get(chatId)!.closedAt).not.toBeNull();
      await expect(
        services.verificacion.submitClaim(publicationId, beto, answers),
      ).resolves.toMatchObject({ status: "pending" });
    });

    it.each(["active", "in_process", "resolved", "cancelled", "removed"] as const)(
      "no reactiva una publicación en estado %s",
      async (status) => {
        const { adminService, admin, db, publicationId } = await setup();
        db.updatePublication(publicationId, status);

        await expect(adminService.unsuspendPublication(admin, publicationId)).rejects.toMatchObject({
          status: 409,
        });
        expect(db.publications.get(publicationId)!.status).toBe(status);
      },
    );

    it("una publicación inexistente responde 404", async () => {
      const { adminService, admin } = await setup();
      await expect(adminService.unsuspendPublication(admin, randomUUID())).rejects.toMatchObject({
        status: 404,
      });
    });
  });

  it("moderar una publicación inexistente responde 404", async () => {
    const { adminService, admin } = await setup();
    await expect(
      adminService.moderatePublication(admin, randomUUID(), "remove"),
    ).rejects.toMatchObject({ status: 404 });
  });
});
