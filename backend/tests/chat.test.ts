import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { createTestContext, foundPublication } from "./helpers/context";

async function setup() {
  const context = createTestContext();
  const ana = context.addUser("ana");
  const beto = context.addUser("beto");
  const carla = context.addUser("carla");
  const publication = await context.services.publicaciones.create(ana, foundPublication());
  const answers = context.db
    .questionsOf(publication.id)
    .map((question) => ({ questionId: question.id, answer: "Respuesta" }));
  const claim = await context.services.verificacion.submitClaim(publication.id, beto, answers);
  const { chatId } = await context.services.verificacion.approve(claim.id, ana);

  return { ...context, ana, beto, carla, service: context.services.chat, chatId, claim };
}

describe("chat", () => {
  it("cada participante ve a la otra persona, solo id y nombre", async () => {
    const { service, ana, beto, chatId } = await setup();

    await expect(service.getChat(chatId, ana)).resolves.toMatchObject({
      counterpart: { id: beto.id, displayName: "beto" },
    });
    const view = await service.getChat(chatId, beto);
    expect(view.counterpart).toEqual({ id: ana.id, displayName: "ana" });
  });

  it("los participantes envían y leen", async () => {
    const { service, ana, beto, chatId } = await setup();
    const message = await service.sendMessage(chatId, beto, "Hola");

    expect(message.senderId).toBe(beto.id);
    await expect(service.listMessages(chatId, ana, { limit: 50 })).resolves.toHaveLength(1);
  });

  it("un tercero recibe 404 en todo", async () => {
    const { service, carla, chatId, db } = await setup();

    await expect(service.getChat(chatId, carla)).rejects.toMatchObject({ status: 404 });
    await expect(service.listMessages(chatId, carla, { limit: 50 })).rejects.toMatchObject({
      status: 404,
    });
    await expect(service.sendMessage(chatId, carla, "Intruso")).rejects.toMatchObject({
      status: 404,
    });
    expect(db.messages).toHaveLength(0);
  });

  it("un chat inexistente responde 404", async () => {
    const { service, ana } = await setup();
    await expect(service.getChat(randomUUID(), ana)).rejects.toMatchObject({ status: 404 });
  });

  it("solo lista los chats propios", async () => {
    const { service, ana, carla } = await setup();

    await expect(service.listMine(ana)).resolves.toHaveLength(1);
    await expect(service.listMine(carla)).resolves.toHaveLength(0);
  });

  it("un chat cerrado no acepta mensajes, pero conserva el historial", async () => {
    const { service, services, ana, beto, chatId, claim } = await setup();
    await service.sendMessage(chatId, beto, "Hola");
    await services.verificacion.cancel(claim.id, ana);

    await expect(service.sendMessage(chatId, beto, "Otro")).rejects.toMatchObject({
      status: 409,
      code: "CHAT_CERRADO",
    });
    await expect(service.listMessages(chatId, beto, { limit: 50 })).resolves.toHaveLength(1);
  });
});
