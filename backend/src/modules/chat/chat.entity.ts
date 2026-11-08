import type { PublicProfile } from "../autenticacion/autenticacion.entity";

export interface Chat {
  id: string;
  claimId: string;
  publisherId: string;
  claimantId: string;
  closedAt: string | null;
  createdAt: string;
}

export interface Message {
  id: string;
  chatId: string;
  senderId: string;
  content: string;
  createdAt: string;
}

export interface ChatView extends Chat {
  counterpart: PublicProfile | null;
}

export const MESSAGE_MAX_LENGTH = 2000;
