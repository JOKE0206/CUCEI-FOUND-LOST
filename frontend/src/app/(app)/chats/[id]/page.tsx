"use client";

import { useParams } from "next/navigation";
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { toast } from "sonner";
import { ReportSheet } from "@/components/report-sheet";
import { BackLink, ErrorState, LoadingState } from "@/components/ui";
import { api, errorMessage } from "@/lib/api";
import { useCurrentProfile } from "@/lib/auth";
import { formatTime } from "@/lib/format";
import { getSupabase } from "@/lib/supabase";
import type { Chat, Message } from "@/lib/types";
import { useApi } from "@/lib/use-api";

const PAGE_SIZE = 50;

interface MessageRow {
  id: string;
  chat_id: string;
  sender_id: string;
  content: string;
  created_at: string;
}

// Une mensajes de la API y de Realtime sin duplicar, en orden cronológico.
function merge(current: Message[], incoming: Message[]): Message[] {
  const byId = new Map(current.map((message) => [message.id, message]));
  for (const message of incoming) byId.set(message.id, message);
  return [...byId.values()].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

export default function ChatPage() {
  const { id } = useParams<{ id: string }>();
  const profile = useCurrentProfile();
  const chat = useApi<Chat>(`/chats/${id}`);
  const [messages, setMessages] = useState<Message[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [hasOlder, setHasOlder] = useState(false);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [reporting, setReporting] = useState(false);
  const [offline, setOffline] = useState(false);

  const scroller = useRef<HTMLDivElement>(null);
  const stickToBottom = useRef(true);
  const keepOffsetFrom = useRef<number | null>(null);

  const loadLatest = useCallback(async () => {
    try {
      const latest = await api<Message[]>(`/chats/${id}/mensajes?limit=${PAGE_SIZE}`);
      setMessages((current) => merge(current ?? [], latest));
      setHasOlder((current) => current || latest.length === PAGE_SIZE);
      setLoadError(null);
    } catch (caught) {
      setLoadError(errorMessage(caught));
    }
  }, [id]);

  useEffect(() => {
    // Los mensajes que llegaron sin conexión se recuperan al volver a la app.
    let active = true;
    const refresh = () => {
      if (active) void loadLatest();
    };
    const onVisible = () => {
      if (document.visibilityState === "visible") refresh();
    };

    refresh();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      active = false;
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [loadLatest]);

  useEffect(() => {
    const supabase = getSupabase();
    if (!supabase) return;

    let wasDisconnected = false;
    const channel = supabase
      .channel(`chat:${id}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages", filter: `chat_id=eq.${id}` },
        (payload) => {
          const row = payload.new as MessageRow;
          setMessages((current) =>
            merge(current ?? [], [
              { id: row.id, chatId: row.chat_id, senderId: row.sender_id, content: row.content, createdAt: row.created_at },
            ]),
          );
        },
      )
      .subscribe((status) => {
        if (status === "SUBSCRIBED") {
          setOffline(false);
          if (wasDisconnected) void loadLatest();
          wasDisconnected = false;
        } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          wasDisconnected = true;
          setOffline(true);
        }
      });

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [id, loadLatest]);

  // Mantiene la vista abajo con mensajes nuevos, y en su lugar al cargar anteriores.
  useLayoutEffect(() => {
    const element = scroller.current;
    if (!element) return;
    if (keepOffsetFrom.current !== null) {
      element.scrollTop += element.scrollHeight - keepOffsetFrom.current;
      keepOffsetFrom.current = null;
    } else if (stickToBottom.current) {
      element.scrollTop = element.scrollHeight;
    }
  }, [messages]);

  function onScroll() {
    const element = scroller.current;
    if (element) stickToBottom.current = element.scrollHeight - element.scrollTop - element.clientHeight < 80;
  }

  async function loadOlder() {
    if (!messages?.length) return;
    setLoadingOlder(true);
    try {
      const older = await api<Message[]>(
        `/chats/${id}/mensajes?limit=${PAGE_SIZE}&before=${encodeURIComponent(messages[0].createdAt)}`,
      );
      keepOffsetFrom.current = scroller.current?.scrollHeight ?? null;
      setMessages((current) => merge(current ?? [], older));
      setHasOlder(older.length === PAGE_SIZE);
    } catch (caught) {
      toast.error(errorMessage(caught));
    } finally {
      setLoadingOlder(false);
    }
  }

  async function send(event?: FormEvent) {
    event?.preventDefault();
    const content = draft.trim();
    if (!content || sending) return;

    setSending(true);
    try {
      const message = await api<Message>(`/chats/${id}/mensajes`, { method: "POST", body: { content } });
      stickToBottom.current = true;
      setMessages((current) => merge(current ?? [], [message]));
      setDraft("");
    } catch (caught) {
      toast.error(errorMessage(caught));
      chat.reload();
    } finally {
      setSending(false);
    }
  }

  function onKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    // En teléfono, Intro hace salto de línea y se envía con el botón.
    const hasKeyboard = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
    if (hasKeyboard && event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault();
      void send();
    }
  }

  if (chat.error && !chat.data) {
    return (
      <main className="mx-auto max-w-xl px-4 pt-5">
        <BackLink href="/chats" label="Conversaciones" />
        <ErrorState message={chat.error.status === 404 ? "Esta conversación no existe o no participas en ella." : chat.error.message} />
      </main>
    );
  }

  const name = chat.data?.counterpart?.displayName ?? "Usuario";
  const closed = Boolean(chat.data?.closedAt);

  return (
    <main className="mx-auto flex h-dvh max-w-xl flex-col lg:h-[calc(100dvh-4rem)]">
      <header className="border-b border-linea px-4 pt-[env(safe-area-inset-top,0px)]">
        <div className="flex items-center justify-between gap-3">
          <BackLink href="/chats" label="Conversaciones" />
          {chat.data?.counterpart && (
            <button type="button" className="btn-link shrink-0" onClick={() => setReporting(true)}>
              Reportar
            </button>
          )}
        </div>
        <h1 className="section-title pb-3 wrap-anywhere">{chat.data ? name : "Cargando"}</h1>
      </header>

      <div ref={scroller} onScroll={onScroll} className="chat-scroll flex-1 px-4 py-3" aria-live="polite">
        {loadError && messages === null ? (
          <ErrorState message={loadError} onRetry={loadLatest} />
        ) : messages === null ? (
          <LoadingState label="Cargando mensajes" />
        ) : (
          <>
            {hasOlder && (
              <button type="button" className="btn-link mb-2" disabled={loadingOlder} onClick={loadOlder}>
                {loadingOlder ? "Cargando" : "Ver mensajes anteriores"}
              </button>
            )}
            {messages.length === 0 && <p className="muted py-6">Acuerden dónde y cuándo entregar el objeto.</p>}
            <ul className="space-y-2">
              {messages.map((message) => {
                const mine = message.senderId === profile.id;
                return (
                  <li key={message.id} className={`flex flex-col ${mine ? "items-end" : "items-start"}`}>
                    <div className="bubble" data-mine={mine}>
                      <span className="sr-only">{mine ? "Tú: " : `${name}: `}</span>
                      {message.content}
                    </div>
                    <time className="muted mt-0.5 text-xs" dateTime={message.createdAt}>
                      {formatTime(message.createdAt)}
                    </time>
                  </li>
                );
              })}
            </ul>
          </>
        )}
      </div>

      <div className="bottom-safe border-t border-linea bg-pizarron px-4">
        {offline && <p className="muted pt-2 text-sm">Reconectando. Los mensajes nuevos pueden tardar.</p>}
        {closed ? (
          <p className="py-4 font-medium">Esta conversación se cerró. Puedes leerla, pero ya no enviar mensajes.</p>
        ) : (
          <form onSubmit={send} className="flex items-end gap-2 py-3">
            <label htmlFor="mensaje" className="sr-only">
              Mensaje para {name}
            </label>
            <textarea
              id="mensaje"
              className="control max-h-32 min-w-0 flex-1 resize-none [field-sizing:content]"
              rows={1}
              maxLength={2000}
              placeholder="Escribe un mensaje"
              enterKeyHint="send"
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={onKeyDown}
            />
            <button type="submit" className="btn btn-primary shrink-0" disabled={sending || !draft.trim()}>
              Enviar
            </button>
          </form>
        )}
      </div>

      {chat.data?.counterpart && <ReportSheet open={reporting} onOpenChange={setReporting} user={chat.data.counterpart} />}
    </main>
  );
}
