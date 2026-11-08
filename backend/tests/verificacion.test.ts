import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { createTestContext, foundPublication } from "./helpers/context";

async function setup() {
  const context = createTestContext();
  const ana = context.addUser("ana");
  const beto = context.addUser("beto");
  const carla = context.addUser("carla");
  const service = context.services.verificacion;
  const publication = await context.services.publicaciones.create(ana, foundPublication());
  const answers = context.db
    .questionsOf(publication.id)
    .map((question) => ({ questionId: question.id, answer: "Una respuesta" }));

  return { ...context, ana, beto, carla, service, publicationId: publication.id, answers };
}

describe("preguntas de verificación", () => {
  it("son visibles y no incluyen respuesta correcta", async () => {
    const { service, beto, publicationId } = await setup();
    const questions = await service.listQuestions(publicationId, beto);

    expect(questions).toHaveLength(2);
    for (const question of questions) {
      expect(Object.keys(question).sort()).toEqual(["id", "position", "publicationId", "question"]);
    }
  });

  it("no son visibles si la publicación está oculta para esa persona", async () => {
    const { service, beto, db, publicationId } = await setup();
    db.updatePublication(publicationId, "cancelled");

    await expect(service.listQuestions(publicationId, beto)).rejects.toMatchObject({ status: 404 });
  });

  it("solo quien publicó las reemplaza", async () => {
    const { service, ana, beto, publicationId } = await setup();

    await expect(
      service.replaceQuestions(publicationId, beto, ["¿Otra pregunta?"]),
    ).rejects.toMatchObject({ status: 403 });

    const questions = await service.replaceQuestions(publicationId, ana, ["¿Otra pregunta?"]);
    expect(questions.map((q) => q.question)).toEqual(["¿Otra pregunta?"]);
  });

  it("se bloquean cuando ya hay reclamaciones", async () => {
    const { service, ana, beto, publicationId, answers } = await setup();
    await service.submitClaim(publicationId, beto, answers);

    await expect(
      service.replaceQuestions(publicationId, ana, ["¿Otra pregunta?"]),
    ).rejects.toMatchObject({ status: 409, code: "PREGUNTAS_BLOQUEADAS" });
  });

  it("un objeto encontrado no se queda sin preguntas", async () => {
    const { service, ana, publicationId } = await setup();

    await expect(service.replaceQuestions(publicationId, ana, [])).rejects.toMatchObject({
      status: 422,
    });
  });
});

describe("envío de reclamaciones", () => {
  it("crea una reclamación pendiente a nombre del usuario autenticado", async () => {
    const { service, beto, publicationId, answers } = await setup();
    const claim = await service.submitClaim(publicationId, beto, answers);

    expect(claim).toMatchObject({ status: "pending", claimantId: beto.id });
    expect(claim.responses).toHaveLength(2);
  });

  it("no permite reclamar la propia publicación", async () => {
    const { service, ana, publicationId, answers } = await setup();

    await expect(service.submitClaim(publicationId, ana, answers)).rejects.toMatchObject({
      status: 403,
    });
  });

  it("no permite dos reclamaciones abiertas", async () => {
    const { service, beto, publicationId, answers } = await setup();
    await service.submitClaim(publicationId, beto, answers);

    await expect(service.submitClaim(publicationId, beto, answers)).rejects.toMatchObject({
      status: 409,
      code: "RECLAMACION_EXISTENTE",
    });
  });

  it("bloquea volver a reclamar tras un rechazo", async () => {
    const { service, ana, beto, db, publicationId, answers } = await setup();
    const claim = await service.submitClaim(publicationId, beto, answers);
    await service.reject(claim.id, ana);

    await expect(service.submitClaim(publicationId, beto, answers)).rejects.toMatchObject({
      status: 403,
      code: "RECLAMACION_RECHAZADA",
      message:
        "Tu reclamación para esta publicación fue rechazada previamente y no puedes volver a intentar",
    });
    expect(db.claimsOf(publicationId)).toHaveLength(1);
  });

  it("el rechazo solo bloquea a esa persona y en esa publicación", async () => {
    const { service, services, ana, beto, carla, publicationId, answers, db } = await setup();
    const claim = await service.submitClaim(publicationId, beto, answers);
    await service.reject(claim.id, ana);

    await expect(service.submitClaim(publicationId, carla, answers)).resolves.toMatchObject({
      status: "pending",
    });

    const other = await services.publicaciones.create(ana, foundPublication());
    const otherAnswers = db
      .questionsOf(other.id)
      .map((question) => ({ questionId: question.id, answer: "Otra respuesta" }));
    await expect(service.submitClaim(other.id, beto, otherAnswers)).resolves.toMatchObject({
      status: "pending",
    });
  });

  it("quien retiró su solicitud sí puede volver a reclamar", async () => {
    const { service, beto, publicationId, answers } = await setup();
    const claim = await service.submitClaim(publicationId, beto, answers);
    await service.cancel(claim.id, beto);

    await expect(service.submitClaim(publicationId, beto, answers)).resolves.toMatchObject({
      status: "pending",
    });
  });

  it("no acepta publicaciones que no estén activas", async () => {
    const { service, ana, db, publicationId, answers } = await setup();
    const dani = createTestContext().addUser("dani");
    db.updatePublication(publicationId, "cancelled");

    await expect(service.submitClaim(publicationId, dani, answers)).rejects.toMatchObject({
      status: 404,
    });
    await expect(service.submitClaim(publicationId, ana, answers)).rejects.toMatchObject({
      status: 403,
    });
  });

  it("exige responder todas las preguntas exactamente una vez", async () => {
    const { service, beto, publicationId, answers } = await setup();
    const incomplete = [answers[0]];
    const repeated = [answers[0], answers[0]];
    const foreign = [answers[0], { questionId: randomUUID(), answer: "x" }];

    for (const invalid of [[], incomplete, repeated, foreign]) {
      await expect(service.submitClaim(publicationId, beto, invalid)).rejects.toMatchObject({
        status: 422,
        code: "RESPUESTAS_NO_VALIDAS",
      });
    }
  });
});

describe("acceso a reclamaciones", () => {
  it("solo quien publicó lista las de su publicación", async () => {
    const { service, ana, beto, carla, publicationId, answers } = await setup();
    await service.submitClaim(publicationId, beto, answers);

    await expect(service.listForPublication(publicationId, ana)).resolves.toHaveLength(1);
    await expect(service.listForPublication(publicationId, beto)).rejects.toMatchObject({
      status: 403,
    });
    await expect(service.listForPublication(publicationId, carla)).rejects.toMatchObject({
      status: 403,
    });
  });

  it("un tercero recibe 404 y no ve las respuestas", async () => {
    const { service, ana, beto, carla, publicationId, answers } = await setup();
    const claim = await service.submitClaim(publicationId, beto, answers);

    await expect(service.getClaim(claim.id, carla)).rejects.toMatchObject({ status: 404 });
    await expect(service.getClaim(claim.id, ana)).resolves.toMatchObject({ id: claim.id });
    await expect(service.getClaim(claim.id, beto)).resolves.toMatchObject({ id: claim.id });
  });

  it("cada persona ve solo sus reclamaciones", async () => {
    const { service, beto, carla, publicationId, answers } = await setup();
    await service.submitClaim(publicationId, beto, answers);

    await expect(service.listMine(beto)).resolves.toHaveLength(1);
    await expect(service.listMine(carla)).resolves.toHaveLength(0);
  });
});

describe("flujo de reclamaciones", () => {
  async function withClaim() {
    const context = await setup();
    const claim = await context.service.submitClaim(
      context.publicationId,
      context.beto,
      context.answers,
    );
    return { ...context, claimId: claim.id };
  }

  it("aprobar pone la publicación en proceso y crea el chat", async () => {
    const { service, ana, beto, db, publicationId, claimId } = await withClaim();
    const { claim, chatId } = await service.approve(claimId, ana);

    expect(claim.status).toBe("approved");
    expect(db.publications.get(publicationId)!.status).toBe("in_process");
    expect(db.chats.get(chatId)).toMatchObject({ publisherId: ana.id, claimantId: beto.id });
  });

  it.each(["beto", "carla"] as const)("%s no puede aprobar ni rechazar", async (name) => {
    const context = await withClaim();
    const actor = context[name];

    await expect(context.service.approve(context.claimId, actor)).rejects.toMatchObject({
      status: name === "beto" ? 403 : 404,
    });
    await expect(context.service.reject(context.claimId, actor)).rejects.toMatchObject({
      status: name === "beto" ? 403 : 404,
    });
    expect(context.db.claims.get(context.claimId)!.status).toBe("pending");
    expect(context.db.chats.size).toBe(0);
  });

  it("no se aprueba dos veces", async () => {
    const { service, ana, claimId } = await withClaim();
    await service.approve(claimId, ana);

    await expect(service.approve(claimId, ana)).rejects.toMatchObject({ status: 409 });
  });

  it("no se aprueba otra si ya hay entrega en curso", async () => {
    const { service, ana, carla, publicationId, answers, claimId } = await withClaim();
    const second = await service.submitClaim(publicationId, carla, answers);
    await service.approve(claimId, ana);

    await expect(service.approve(second.id, ana)).rejects.toMatchObject({ status: 409 });
  });

  it("rechazar deja la publicación abierta y sin chat", async () => {
    const { service, ana, db, publicationId, claimId } = await withClaim();

    await expect(service.reject(claimId, ana)).resolves.toMatchObject({ status: "rejected" });
    expect(db.publications.get(publicationId)!.status).toBe("active");
    expect(db.chats.size).toBe(0);
  });

  it("no se rechaza una reclamación ya resuelta", async () => {
    const { service, ana, claimId } = await withClaim();
    await service.approve(claimId, ana);

    await expect(service.reject(claimId, ana)).rejects.toMatchObject({ status: 409 });
  });

  it("quien reclamó retira su solicitud pendiente; quien publicó no", async () => {
    const { service, ana, beto, claimId } = await withClaim();

    await expect(service.cancel(claimId, ana)).rejects.toMatchObject({ status: 403 });
    await expect(service.cancel(claimId, beto)).resolves.toMatchObject({ status: "cancelled" });
    await expect(service.cancel(claimId, beto)).rejects.toMatchObject({ status: 409 });
  });

  it("revocar una aprobación reabre la publicación y cierra el chat", async () => {
    const { service, ana, db, publicationId, claimId } = await withClaim();
    const { chatId } = await service.approve(claimId, ana);

    await expect(service.cancel(claimId, ana)).resolves.toMatchObject({ status: "cancelled" });
    expect(db.publications.get(publicationId)!.status).toBe("active");
    expect(db.chats.get(chatId)!.closedAt).not.toBeNull();
  });

  it("un tercero no puede cancelar", async () => {
    const { service, carla, claimId } = await withClaim();
    await expect(service.cancel(claimId, carla)).rejects.toMatchObject({ status: 404 });
  });

  it("no se revoca tras concluir la entrega", async () => {
    const { service, services, ana, publicationId, claimId } = await withClaim();
    await service.approve(claimId, ana);
    await services.publicaciones.resolve(publicationId, ana);

    await expect(service.cancel(claimId, ana)).rejects.toMatchObject({ status: 409 });
  });

  it("resolver rechaza lo pendiente y cierra el chat", async () => {
    const { service, services, ana, carla, db, publicationId, answers, claimId } = await withClaim();
    const second = await service.submitClaim(publicationId, carla, answers);
    const { chatId } = await service.approve(claimId, ana);

    await services.publicaciones.resolve(publicationId, ana);

    expect(db.claims.get(second.id)!.status).toBe("rejected");
    expect(db.chats.get(chatId)!.closedAt).not.toBeNull();
  });
});
