import { getSupabase } from "../../config/supabase";
import { unwrap } from "../../shared/utils/supabase-result";
import type { Chat, Message } from "./chat.entity";

export interface ChatRepository {
  findById(id: string): Promise<Chat | null>;
  listByParticipant(userId: string): Promise<Chat[]>;
  listMessages(chatId: string, limit: number, before?: string): Promise<Message[]>;
  addMessage(chatId: string, senderId: string, content: string): Promise<Message>;
}

interface ChatRow {
  id: string;
  claim_id: string;
  publisher_id: string;
  claimant_id: string;
  closed_at: string | null;
  created_at: string;
}

interface MessageRow {
  id: string;
  chat_id: string;
  sender_id: string;
  content: string;
  created_at: string;
}

const CHAT_COLUMNS = "id, claim_id, publisher_id, claimant_id, closed_at, created_at";
const MESSAGE_COLUMNS = "id, chat_id, sender_id, content, created_at";

function toChat(row: ChatRow): Chat {
  return {
    id: row.id,
    claimId: row.claim_id,
    publisherId: row.publisher_id,
    claimantId: row.claimant_id,
    closedAt: row.closed_at,
    createdAt: row.created_at,
  };
}

function toMessage(row: MessageRow): Message {
  return {
    id: row.id,
    chatId: row.chat_id,
    senderId: row.sender_id,
    content: row.content,
    createdAt: row.created_at,
  };
}

export class SupabaseChatRepository implements ChatRepository {
  async findById(id: string): Promise<Chat | null> {
    const row = unwrap<ChatRow | null>(
      await getSupabase().from("chats").select(CHAT_COLUMNS).eq("id", id).maybeSingle(),
    );
    return row ? toChat(row) : null;
  }

  async listByParticipant(userId: string): Promise<Chat[]> {
    const rows = unwrap<ChatRow[]>(
      await getSupabase()
        .from("chats")
        .select(CHAT_COLUMNS)
        .or(`publisher_id.eq.${userId},claimant_id.eq.${userId}`)
        .order("created_at", { ascending: false }),
    );
    return rows.map(toChat);
  }

  async listMessages(chatId: string, limit: number, before?: string): Promise<Message[]> {
    let query = getSupabase().from("messages").select(MESSAGE_COLUMNS).eq("chat_id", chatId);
    if (before) query = query.lt("created_at", before);

    const rows = unwrap<MessageRow[]>(
      await query.order("created_at", { ascending: false }).limit(limit),
    );
    return rows.map(toMessage);
  }

  async addMessage(chatId: string, senderId: string, content: string): Promise<Message> {
    const row = unwrap<MessageRow>(
      await getSupabase()
        .from("messages")
        .insert({ chat_id: chatId, sender_id: senderId, content })
        .select(MESSAGE_COLUMNS)
        .single(),
    );
    return toMessage(row);
  }
}
