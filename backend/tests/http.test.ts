import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import { randomUUID } from "node:crypto";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createApp } from "../src/app";
import { createTestContext, foundPublication, type TestUser } from "./helpers/context";

let server: Server | undefined;

afterEach(() => {
  server?.close();
  server = undefined;
  vi.restoreAllMocks();
});

async function start() {
  const context = createTestContext();
  const app = createApp(context.services);
  await new Promise<void>((resolve) => {
    server = app.listen(0, () => resolve());
  });
  const { port } = server!.address() as AddressInfo;

  async function request(
    method: string,
    path: string,
    options: { user?: TestUser; token?: string; body?: unknown; rawBody?: string } = {},
  ) {
    const token = options.user?.token ?? options.token;
    const response = await fetch(`http://127.0.0.1:${port}${path}`, {
      method,
      headers: {
        "content-type": "application/json",
        ...(token ? { authorization: `Bearer ${token}` } : {}),
      },
      body: options.rawBody ?? (options.body === undefined ? undefined : JSON.stringify(options.body)),
    });
    const text = await response.text();
    return { status: response.status, text, json: text ? JSON.parse(text) : null };
  }

  return { ...context, request };
}

const id = randomUUID();

const protectedRoutes: [string, string][] = [
  ["GET", "/api/v1/auth/me"],
  ["POST", "/api/v1/auth/perfil"],
  ["GET", "/api/v1/publicaciones"],
  ["POST", "/api/v1/publicaciones"],
  ["GET", "/api/v1/publicaciones/mias"],
  ["GET", `/api/v1/publicaciones/${id}`],
  ["PATCH", `/api/v1/publicaciones/${id}`],
  ["POST", `/api/v1/publicaciones/${id}/cancelar`],
  ["POST", `/api/v1/publicaciones/${id}/resolver`],
  ["POST", `/api/v1/publicaciones/${id}/fotos/url-subida`],
  ["POST", `/api/v1/publicaciones/${id}/fotos`],
  ["DELETE", `/api/v1/publicaciones/${id}/fotos/${id}`],
  ["GET", `/api/v1/publicaciones/${id}/preguntas`],
  ["PUT", `/api/v1/publicaciones/${id}/preguntas`],
  ["GET", `/api/v1/publicaciones/${id}/reclamaciones`],
  ["POST", `/api/v1/publicaciones/${id}/reclamaciones`],
  ["GET", "/api/v1/reclamaciones/mias"],
  ["GET", `/api/v1/reclamaciones/${id}`],
  ["POST", `/api/v1/reclamaciones/${id}/aprobar`],
  ["POST", `/api/v1/reclamaciones/${id}/rechazar`],
  ["POST", `/api/v1/reclamaciones/${id}/cancelar`],
  ["GET", "/api/v1/chats"],
  ["GET", `/api/v1/chats/${id}`],
  ["GET", `/api/v1/chats/${id}/mensajes`],
  ["POST", `/api/v1/chats/${id}/mensajes`],
  ["GET", "/api/v1/campuses"],
  ["GET", `/api/v1/campuses/${id}/locations`],
  ["GET", "/api/v1/categories"],
  ["POST", "/api/v1/reports"],
  ["GET", "/api/v1/admin/reports"],
  ["PATCH", `/api/v1/admin/reports/${id}`],
  ["POST", `/api/v1/admin/publications/${id}/moderate`],
  ["POST", `/api/v1/admin/publications/${id}/unsuspend`],
];

const sessionOnlyRoutes = ["/api/v1/campuses"];
const sessionOnlyPrefixes = ["/api/v1/auth"];
const adminRoutes = protectedRoutes.filter(([, path]) => path.startsWith("/api/v1/admin"));

describe("protección de rutas", () => {
  it("/health responde sin sesión", async () => {
    const { request } = await start();
    const response = await request("GET", "/health");

    expect(response.status).toBe(200);
    expect(response.json.status).toBe("ok");
  });

  it.each(protectedRoutes)("%s %s exige sesión", async (method, path) => {
    const { request } = await start();

    expect((await request(method, path)).status).toBe(401);
    expect((await request(method, path, { token: "token-falso" })).status).toBe(401);
  });

  it.each(
    protectedRoutes.filter(
      ([, path]) =>
        !sessionOnlyRoutes.includes(path) && !sessionOnlyPrefixes.some((p) => path.startsWith(p)),
    ),
  )(
    "%s %s rechaza a quien no tiene perfil",
    async (method, path) => {
      const { request, addUser } = await start();
      const response = await request(method, path, { user: addUser("nuevo", { profile: false }) });

      expect(response.status).toBe(403);
      expect(response.json.error.code).toBe("PERFIL_REQUERIDO");
    },
  );

  it("una cuenta de Gmail no crea perfil por HTTP", async () => {
    const { request, addUser, db } = await start();
    const user = addUser("externo", { email: "externo@gmail.com", profile: false });

    const response = await request("POST", "/api/v1/auth/perfil", {
      user,
      body: { displayName: "Externo" },
    });

    expect(response.status).toBe(403);
    expect(response.json.error.code).toBe("DOMINIO_NO_PERMITIDO");
    expect(db.profiles.size).toBe(0);
  });

  it("no acepta asignarse rol al crear el perfil", async () => {
    const { request, addUser, db } = await start();
    const user = addUser("nuevo", { profile: false });

    const response = await request("POST", "/api/v1/auth/perfil", {
      user,
      body: { displayName: "Nuevo", role: "admin", status: "active" },
    });

    expect(response.status).toBe(201);
    expect(db.profiles.get(user.id)!.role).toBe("user");
  });
});

describe("validación de entrada", () => {
  it("rechaza un id que no es UUID", async () => {
    const { request, addUser } = await start();
    const response = await request("GET", "/api/v1/publicaciones/abc", { user: addUser("ana") });

    expect(response.status).toBe(400);
  });

  it.each([["userId"], ["status"]])("rechaza %s en el cuerpo", async (field) => {
    const { request, addUser, db } = await start();
    const user = addUser("ana");

    const response = await request("POST", "/api/v1/publicaciones", {
      user,
      body: { ...foundPublication(), [field]: "active" },
    });

    expect(response.status).toBe(400);
    expect(db.publications.size).toBe(0);
  });

  it("rechaza tipos de foto no permitidos", async () => {
    const { request, addUser, services } = await start();
    const user = addUser("ana");
    const { id: publicationId } = await services.publicaciones.create(user, foundPublication());

    const response = await request("POST", `/api/v1/publicaciones/${publicationId}/fotos/url-subida`, {
      user,
      body: { mimeType: "application/pdf" },
    });

    expect(response.status).toBe(400);
  });

  it("responde 400 ante JSON mal formado", async () => {
    const { request, addUser } = await start();
    const response = await request("POST", "/api/v1/publicaciones", {
      user: addUser("ana"),
      rawBody: "{no es json",
    });

    expect(response.status).toBe(400);
  });

  it("responde 404 en rutas desconocidas", async () => {
    const { request } = await start();
    expect((await request("GET", "/no-existe")).status).toBe(404);
  });
});

describe("errores", () => {
  it("un error interno no expone detalles", async () => {
    const { request, addUser, services } = await start();
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    vi.spyOn(services.publicaciones, "listMine").mockRejectedValue(
      new Error("detalle secreto de la base de datos"),
    );

    const response = await request("GET", "/api/v1/publicaciones/mias", { user: addUser("ana") });

    expect(response.status).toBe(500);
    expect(response.text).not.toContain("secreto");
  });
});

describe("campus", () => {
  it("devuelve los activos a una sesión aún sin perfil", async () => {
    const { request, addUser, db } = await start();
    db.campuses.push({ id, name: "CUCEI", code: "CUCEI", emailDomain: "alumnos.udg.mx" });

    const response = await request("GET", "/api/v1/campuses", {
      user: addUser("nuevo", { profile: false }),
    });

    expect(response.status).toBe(200);
    expect(response.json).toEqual([
      { id, name: "CUCEI", code: "CUCEI", emailDomain: "alumnos.udg.mx" },
    ]);
  });
});

describe("catálogos", () => {
  it("devuelve las categorías", async () => {
    const { request, addUser, db } = await start();
    db.categories.push({ id, name: "Otros" });

    const response = await request("GET", "/api/v1/categories", { user: addUser("ana") });

    expect(response.status).toBe(200);
    expect(response.json).toEqual([{ id, name: "Otros" }]);
  });

  it("devuelve solo las ubicaciones del campus indicado", async () => {
    const { request, addUser, db } = await start();
    const otherCampus = randomUUID();
    const user = addUser("ana");
    db.campuses.push(
      { id, name: "CUCEI", code: "CUCEI", emailDomain: null },
      { id: otherCampus, name: "Otro", code: "OTRO", emailDomain: null },
    );
    db.locations.push(
      { id: randomUUID(), campusId: id, name: "Biblioteca" },
      { id: randomUUID(), campusId: otherCampus, name: "Cafetería" },
    );

    const response = await request("GET", `/api/v1/campuses/${id}/locations`, { user });

    expect(response.status).toBe(200);
    expect(response.json.map((location: { name: string }) => location.name)).toEqual(["Biblioteca"]);
  });

  it("un campus inexistente responde 404 y un id inválido 400", async () => {
    const { request, addUser } = await start();
    const user = addUser("ana");

    expect((await request("GET", `/api/v1/campuses/${randomUUID()}/locations`, { user })).status).toBe(404);
    expect((await request("GET", "/api/v1/campuses/abc/locations", { user })).status).toBe(400);
  });
});

describe("unificación de rutas", () => {
  it.each(["auth/me", "publicaciones", "publicaciones/mias", "reclamaciones/mias", "chats"])(
    "la ruta anterior /api/%s ya no existe",
    async (path) => {
      const { request, addUser } = await start();
      const response = await request("GET", `/api/${path}`, { user: addUser("ana") });

      expect(response.status).toBe(404);
    },
  );
});

describe("reactivación por HTTP", () => {
  it("un admin reactiva una publicación suspendida tras descartar el reporte", async () => {
    const { request, addUser, services } = await start();
    const ana = addUser("ana");
    const beto = addUser("beto");
    const admin = addUser("admin", { role: "admin" });
    const publication = await services.publicaciones.create(ana, foundPublication());
    const base = `/api/v1/admin/publications/${publication.id}`;

    const report = await request("POST", "/api/v1/reports", {
      user: beto,
      body: { targetPublicationId: publication.id, reason: "Parece fraudulento" },
    });
    await request("POST", `${base}/moderate`, { user: admin, body: { action: "suspend" } });

    const blocked = await request("POST", `${base}/unsuspend`, { user: admin });
    expect(blocked.status).toBe(409);
    expect(blocked.json.error.code).toBe("REPORTES_ABIERTOS");

    await request("PATCH", `/api/v1/admin/reports/${report.json.id}`, {
      user: admin,
      body: { status: "dismissed" },
    });

    const reactivated = await request("POST", `${base}/unsuspend`, { user: admin });
    expect(reactivated.status).toBe(200);
    expect(reactivated.json.status).toBe("active");
  });
});

describe("re-reclamación por HTTP", () => {
  it("responde 403 con el motivo tras un rechazo", async () => {
    const { request, addUser, services, db } = await start();
    const ana = addUser("ana");
    const beto = addUser("beto");
    const publication = await services.publicaciones.create(ana, foundPublication());
    const body = {
      answers: db
        .questionsOf(publication.id)
        .map((question) => ({ questionId: question.id, answer: "Respuesta" })),
    };
    const path = `/api/v1/publicaciones/${publication.id}/reclamaciones`;

    const claim = await request("POST", path, { user: beto, body });
    await request("POST", `/api/v1/reclamaciones/${claim.json.id}/rechazar`, { user: ana });
    const retry = await request("POST", path, { user: beto, body });

    expect(retry.status).toBe(403);
    expect(retry.json.error).toEqual({
      code: "RECLAMACION_RECHAZADA",
      message:
        "Tu reclamación para esta publicación fue rechazada previamente y no puedes volver a intentar",
    });
  });
});

describe("reportes por HTTP", () => {
  it("crea un reporte de publicación", async () => {
    const { request, addUser, services } = await start();
    const ana = addUser("ana");
    const publication = await services.publicaciones.create(ana, foundPublication());

    const response = await request("POST", "/api/v1/reports", {
      user: addUser("beto"),
      body: { targetPublicationId: publication.id, reason: "Es fraudulento" },
    });

    expect(response.status).toBe(201);
    expect(response.json.status).toBe("pending");
  });

  it.each([
    ["suplantar a quien reporta", { targetUserId: id, reason: "Motivo", reporterId: id }],
    ["dos objetivos", { targetUserId: id, targetPublicationId: id, reason: "Motivo" }],
    ["sin objetivo", { reason: "Motivo" }],
    ["motivo vacío", { targetUserId: id, reason: "   " }],
    ["fijar el estado", { targetUserId: id, reason: "Motivo", status: "resolved" }],
  ])("rechaza: %s", async (_name, body) => {
    const { request, addUser, db } = await start();
    const response = await request("POST", "/api/v1/reports", { user: addUser("beto"), body });

    expect(response.status).toBe(400);
    expect(db.reports.size).toBe(0);
  });
});

describe("administración por HTTP", () => {
  it.each(adminRoutes)("%s %s rechaza a usuarios sin rol admin", async (method, path) => {
    const { request, addUser } = await start();
    const response = await request(method, path, {
      user: addUser("beto"),
      body: method === "GET" ? undefined : { status: "resolved", action: "remove" },
    });

    expect(response.status).toBe(403);
    expect(response.json.error.code).toBe("ADMIN_REQUERIDO");
  });

  it("no se puede hacer pasar por admin desde la petición", async () => {
    const { request, addUser } = await start();
    const response = await request("GET", "/api/v1/admin/reports?role=admin", {
      user: addUser("beto"),
    });

    expect(response.status).toBe(403);
  });

  it("un admin suspendido pierde el acceso", async () => {
    const { request, addUser } = await start();
    const response = await request("GET", "/api/v1/admin/reports", {
      user: addUser("admin", { role: "admin", status: "suspended" }),
    });

    expect(response.status).toBe(403);
    expect(response.json.error.code).toBe("CUENTA_SUSPENDIDA");
  });

  it("valida el filtro, la decisión y la acción", async () => {
    const { request, addUser } = await start();
    const admin = addUser("admin", { role: "admin" });

    expect((await request("GET", "/api/v1/admin/reports?status=otro", { user: admin })).status).toBe(400);
    expect(
      (await request("PATCH", `/api/v1/admin/reports/${id}`, { user: admin, body: { status: "pending" } })).status,
    ).toBe(400);
    expect(
      (await request("POST", `/api/v1/admin/publications/${id}/moderate`, { user: admin, body: { action: "borrar" } })).status,
    ).toBe(400);
  });

  it("atiende un reporte de principio a fin sin ver respuestas, mensajes ni correos", async () => {
    const { request, addUser, services, db } = await start();
    const ana = addUser("ana");
    const beto = addUser("beto");
    const carla = addUser("carla");
    const admin = addUser("admin", { role: "admin" });
    const publication = await services.publicaciones.create(ana, foundPublication());
    const answers = db
      .questionsOf(publication.id)
      .map((question) => ({ questionId: question.id, answer: "Respuesta secreta" }));
    const claim = await services.verificacion.submitClaim(publication.id, beto, answers);
    const { chatId } = await services.verificacion.approve(claim.id, ana);
    await services.chat.sendMessage(chatId, beto, "Mensaje privado");

    const report = await request("POST", "/api/v1/reports", {
      user: carla,
      body: { targetUserId: ana.id, reason: "Se hace pasar por otra persona" },
    });
    await request("POST", "/api/v1/reports", {
      user: beto,
      body: { targetPublicationId: publication.id, reason: "Contenido inapropiado" },
    });

    const list = await request("GET", "/api/v1/admin/reports?status=pending", { user: admin });
    expect(list.status).toBe(200);
    expect(list.json.total).toBe(2);

    const moderated = await request("POST", `/api/v1/admin/publications/${publication.id}/moderate`, {
      user: admin,
      body: { action: "remove" },
    });
    expect(moderated.json.status).toBe("removed");

    const decided = await request("PATCH", `/api/v1/admin/reports/${report.json.id}`, {
      user: admin,
      body: { status: "resolved" },
    });
    expect(decided.status).toBe(200);
    expect(decided.json.reviewedBy).toBe(admin.id);

    for (const body of [list.text, moderated.text, decided.text]) {
      expect(body).not.toContain("Respuesta secreta");
      expect(body).not.toContain("Mensaje privado");
      expect(body).not.toContain("@alumnos.udg.mx");
    }
  });
});

describe("ciclo completo por HTTP", () => {
  it("publicar, reclamar, aprobar, conversar y resolver, sin filtrar datos", async () => {
    const { request, addUser } = await start();
    const ana = addUser("ana");
    const beto = addUser("beto");
    const carla = addUser("carla");
    const leaked: string[] = [];
    const call = async (...args: Parameters<typeof request>) => {
      const response = await request(...args);
      leaked.push(response.text);
      return response;
    };

    const created = await call("POST", "/api/v1/publicaciones", { user: ana, body: foundPublication() });
    expect(created.status).toBe(201);
    const publicationId = created.json.id;

    const questions = await call("GET", `/api/v1/publicaciones/${publicationId}/preguntas`, { user: beto });
    expect(questions.status).toBe(200);

    const claim = await call("POST", `/api/v1/publicaciones/${publicationId}/reclamaciones`, {
      user: beto,
      body: {
        answers: questions.json.map((question: { id: string }) => ({
          questionId: question.id,
          answer: "Respuesta privada",
        })),
      },
    });
    expect(claim.status).toBe(201);

    const asThirdParty = await request("GET", `/api/v1/reclamaciones/${claim.json.id}`, { user: carla });
    expect(asThirdParty.status).toBe(404);
    expect(asThirdParty.text).not.toContain("Respuesta privada");

    const stolen = await request("POST", `/api/v1/reclamaciones/${claim.json.id}/aprobar`, { user: beto });
    expect(stolen.status).toBe(403);

    const approved = await call("POST", `/api/v1/reclamaciones/${claim.json.id}/aprobar`, { user: ana });
    expect(approved.status).toBe(200);
    const chatId = approved.json.chatId;

    const sent = await call("POST", `/api/v1/chats/${chatId}/mensajes`, {
      user: beto,
      body: { content: "¿Dónde nos vemos?" },
    });
    expect(sent.status).toBe(201);
    expect(sent.json.senderId).toBe(beto.id);

    const intruder = await request("GET", `/api/v1/chats/${chatId}/mensajes`, { user: carla });
    expect(intruder.status).toBe(404);

    const history = await call("GET", `/api/v1/chats/${chatId}/mensajes`, { user: ana });
    expect(history.json).toHaveLength(1);

    const resolved = await call("POST", `/api/v1/publicaciones/${publicationId}/resolver`, { user: ana });
    expect(resolved.json.status).toBe("resolved");

    const closed = await request("POST", `/api/v1/chats/${chatId}/mensajes`, {
      user: beto,
      body: { content: "Gracias" },
    });
    expect(closed.status).toBe(409);

    for (const body of leaked) {
      expect(body).not.toContain("@alumnos.udg.mx");
      expect(body).not.toContain("token-");
    }
  });
});
