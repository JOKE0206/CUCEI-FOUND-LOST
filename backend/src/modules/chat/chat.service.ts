import type { Actor } from "../../shared/middlewares/auth.middleware";
import { conflict, notFound } from "../../shared/utils/app-error";
import type { PublicProfileReader } from "../autenticacion/autenticacion.repository";
import type { Chat, ChatView, Message } from "./chat.entity";
import type { ChatRepository } from "./chat.repository";

export class ChatService {
  constructor(
    private readonly repository: ChatRepository,
    private readonly profiles: PublicProfileReader,
  ) {}

  async listMine(actor: Actor): Promise<ChatView[]> {
    return this.toViews(await this.repository.listByParticipant(actor.id), actor);
  }

  async getChat(chatId: string, actor: Actor): Promise<ChatView> {
    const chat = await this.loadForParticipant(chatId, actor);
    const [view] = await this.toViews([chat], actor);
    return view;
  }

  // Los mensajes se devuelven del más reciente al más antiguo.
  async listMessages(
    chatId: string,
    actor: Actor,
    options: { limit: number; before?: string },
  ): Promise<Message[]> {
    await this.loadForParticipant(chatId, actor);
    return this.repository.listMessages(chatId, options.limit, options.before);
  }

  async sendMessage(chatId: string, actor: Actor, content: string): Promise<Message> {
    const chat = await this.loadForParticipant(chatId, actor);
    if (chat.closedAt) throw conflict("CHAT_CERRADO", "La conversación está cerrada");
    return this.repository.addMessage(chatId, actor.id, content);
  }

  // Quien no participa recibe 404, para no revelar que el chat existe.
  private async loadForParticipant(chatId: string, actor: Actor): Promise<Chat> {
    const chat = await this.repository.findById(chatId);
    if (!chat || (chat.publisherId !== actor.id && chat.claimantId !== actor.id)) {
      throw notFound("Conversación no encontrada");
    }
    return chat;
  }

  private async toViews(chats: Chat[], actor: Actor): Promise<ChatView[]> {
    const counterpartOf = (chat: Chat) =>
      chat.publisherId === actor.id ? chat.claimantId : chat.publisherId;
    const profiles = await this.profiles.findPublicProfiles([
      ...new Set(chats.map(counterpartOf)),
    ]);

    return chats.map((chat) => ({
      ...chat,
      counterpart: profiles.find((profile) => profile.id === counterpartOf(chat)) ?? null,
    }));
  }
}
