"use client";

import Link from "next/link";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui";
import { formatDateTime } from "@/lib/format";
import type { Chat } from "@/lib/types";
import { useApi } from "@/lib/use-api";

export default function ChatsPage() {
  const chats = useApi<Chat[]>("/chats");

  return (
    <main className="mx-auto max-w-xl px-4 pt-[calc(1.25rem+env(safe-area-inset-top,0px))] lg:pt-8">
      <h1 className="page-title">Conversaciones</h1>

      {chats.error && !chats.data ? (
        <ErrorState message={chats.error.message} onRetry={chats.reload} />
      ) : !chats.data ? (
        <LoadingState label="Cargando conversaciones" />
      ) : chats.data.length === 0 ? (
        <EmptyState
          title="No tienes conversaciones"
          description="Se abre una cuando se aprueba una reclamación, para acordar la entrega."
        />
      ) : (
        <ul className="mt-3 divide-y divide-linea">
          {chats.data.map((chat) => (
            <li key={chat.id}>
              <Link href={`/chats/${chat.id}`} className="flex min-h-16 items-center justify-between gap-3 py-3">
                <span className="min-w-0">
                  <span className="block font-semibold wrap-anywhere">{chat.counterpart?.displayName ?? "Usuario"}</span>
                  <span className="muted block text-sm">{formatDateTime(chat.createdAt)}</span>
                </span>
                {chat.closedAt && <span className="status-label shrink-0">Cerrada</span>}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
