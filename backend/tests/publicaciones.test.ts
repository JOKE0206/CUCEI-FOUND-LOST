import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { createTestContext, foundPublication } from "./helpers/context";

function setup() {
  const context = createTestContext();
  return {
    ...context,
    service: context.services.publicaciones,
    ana: context.addUser("ana"),
    beto: context.addUser("beto"),
  };
}

describe("creación de publicaciones", () => {
  it("asigna como dueño al usuario autenticado", async () => {
    const { service, ana } = setup();
    const publication = await service.create(ana, foundPublication());

    expect(publication.userId).toBe(ana.id);
    expect(publication.status).toBe("active");
    expect(publication.publisher).toEqual({ id: ana.id, displayName: "ana" });
  });

  it("no deja que los datos de entrada suplanten al dueño", async () => {
    const { service, ana, beto } = setup();
    const forged = { ...foundPublication(), userId: beto.id };

    const publication = await service.create(ana, forged);
    expect(publication.userId).toBe(ana.id);
  });

  it("guarda las preguntas sin espacios sobrantes", async () => {
    const { service, ana, db } = setup();
    const publication = await service.create(
      ana,
      foundPublication({ questions: ["  ¿Qué marca es?  "] }),
    );

    expect(db.questionsOf(publication.id).map((q) => q.question)).toEqual(["¿Qué marca es?"]);
  });

  it("exige preguntas en objetos encontrados", async () => {
    const { service, ana, db } = setup();

    await expect(
      service.create(ana, foundPublication({ questions: [] })),
    ).rejects.toMatchObject({ status: 422, code: "PREGUNTAS_NO_VALIDAS" });
    expect(db.publications.size).toBe(0);
  });

  it("permite objetos perdidos sin preguntas", async () => {
    const { service, ana } = setup();
    const publication = await service.create(ana, foundPublication({ type: "lost", questions: [] }));

    expect(publication.type).toBe("lost");
  });

  it.each([
    ["más de cinco", ["aaa?", "bbb?", "ccc?", "ddd?", "eee?", "fff?"]],
    ["repetidas", ["¿Color?", "¿COLOR?"]],
    ["demasiado corta", ["a"]],
    ["en blanco", ["     "]],
  ])("rechaza preguntas: %s", async (_name, questions) => {
    const { service, ana } = setup();

    await expect(service.create(ana, foundPublication({ questions }))).rejects.toMatchObject({
      status: 422,
    });
  });
});

describe("visibilidad", () => {
  it("una publicación activa es visible para la comunidad", async () => {
    const { service, ana, beto } = setup();
    const { id } = await service.create(ana, foundPublication());

    await expect(service.getDetail(id, beto)).resolves.toMatchObject({ id });
  });

  it("una publicación no activa responde 404 a terceros", async () => {
    const { service, ana, beto, db } = setup();
    const { id } = await service.create(ana, foundPublication());
    db.updatePublication(id, "in_process");

    await expect(service.getDetail(id, beto)).rejects.toMatchObject({ status: 404 });
    await expect(service.getDetail(id, ana)).resolves.toMatchObject({ id });
  });

  it("una publicación inexistente responde 404", async () => {
    const { service, ana } = setup();
    await expect(service.getDetail(randomUUID(), ana)).rejects.toMatchObject({ status: 404 });
  });
});

describe("autorización sobre publicaciones ajenas", () => {
  it("solo quien publicó puede editar", async () => {
    const { service, ana, beto, db } = setup();
    const { id } = await service.create(ana, foundPublication());

    await expect(service.update(id, beto, { title: "Hackeado" })).rejects.toMatchObject({
      status: 403,
      code: "SIN_PERMISO",
    });
    expect(db.publications.get(id)!.title).toBe("Cartera negra");

    await expect(service.update(id, ana, { title: "Cartera azul" })).resolves.toMatchObject({
      title: "Cartera azul",
    });
  });

  it("solo quien publicó puede cancelar", async () => {
    const { service, ana, beto, db } = setup();
    const { id } = await service.create(ana, foundPublication());

    await expect(service.cancel(id, beto)).rejects.toMatchObject({ status: 403 });
    expect(db.publications.get(id)!.status).toBe("active");

    await expect(service.cancel(id, ana)).resolves.toMatchObject({ status: "cancelled" });
  });

  it("no se edita una publicación que ya no está activa", async () => {
    const { service, ana, db } = setup();
    const { id } = await service.create(ana, foundPublication());
    db.updatePublication(id, "resolved");

    await expect(service.update(id, ana, { title: "Nuevo título" })).rejects.toMatchObject({
      status: 409,
    });
  });

  it("solo se resuelve con una entrega en curso", async () => {
    const { service, ana, db } = setup();
    const { id } = await service.create(ana, foundPublication());

    await expect(service.resolve(id, ana)).rejects.toMatchObject({ status: 409 });

    db.updatePublication(id, "in_process");
    await expect(service.resolve(id, ana)).resolves.toMatchObject({ status: "resolved" });
  });
});

describe("fotos", () => {
  async function withPublication() {
    const context = setup();
    const { id } = await context.service.create(context.ana, foundPublication());
    return { ...context, id };
  }

  it("solo quien publicó pide URL de subida, dentro de su carpeta", async () => {
    const { service, ana, beto, id } = await withPublication();

    await expect(service.requestPhotoUpload(id, beto, "image/png")).rejects.toMatchObject({
      status: 403,
    });

    const upload = await service.requestPhotoUpload(id, ana, "image/png");
    expect(upload.path).toMatch(new RegExp(`^${id}/.+\\.png$`));
  });

  it("registra una foto subida y devuelve URL firmada, no la ruta", async () => {
    const { service, ana, db, id } = await withPublication();
    const { path } = await service.requestPhotoUpload(id, ana, "image/jpeg");
    db.files.add(path);

    const photo = await service.registerPhoto(id, ana, path);
    expect(photo.url).toContain("firmada");
    expect(photo).not.toHaveProperty("storagePath");

    const detail = await service.getDetail(id, ana);
    expect(JSON.stringify(detail)).not.toContain(path);
  });

  it("rechaza rutas de otra publicación", async () => {
    const { service, ana, db, id } = await withPublication();
    const other = await service.create(ana, foundPublication());
    const { path } = await service.requestPhotoUpload(other.id, ana, "image/jpeg");
    db.files.add(path);

    await expect(service.registerPhoto(id, ana, path)).rejects.toMatchObject({
      status: 422,
      code: "FOTO_NO_VALIDA",
    });
  });

  it("rechaza archivos que no se subieron", async () => {
    const { service, ana, id } = await withPublication();
    const { path } = await service.requestPhotoUpload(id, ana, "image/jpeg");

    await expect(service.registerPhoto(id, ana, path)).rejects.toMatchObject({ status: 422 });
  });

  it("limita a cinco fotos", async () => {
    const { service, ana, db, id } = await withPublication();
    for (let i = 0; i < 5; i += 1) {
      const { path } = await service.requestPhotoUpload(id, ana, "image/webp");
      db.files.add(path);
      await service.registerPhoto(id, ana, path);
    }

    await expect(service.requestPhotoUpload(id, ana, "image/webp")).rejects.toMatchObject({
      status: 409,
      code: "LIMITE_DE_FOTOS",
    });
  });

  it("borra la foto y su archivo; terceros no pueden", async () => {
    const { service, ana, beto, db, id } = await withPublication();
    const { path } = await service.requestPhotoUpload(id, ana, "image/jpeg");
    db.files.add(path);
    const photo = await service.registerPhoto(id, ana, path);

    await expect(service.deletePhoto(id, photo.id, beto)).rejects.toMatchObject({ status: 403 });
    expect(db.files.has(path)).toBe(true);

    await service.deletePhoto(id, photo.id, ana);
    expect(db.files.has(path)).toBe(false);
    expect(db.photos.has(photo.id)).toBe(false);
  });
});
