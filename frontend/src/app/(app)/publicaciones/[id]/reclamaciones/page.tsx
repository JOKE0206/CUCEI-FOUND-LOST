"use client";

import { useParams } from "next/navigation";
import { ClaimTicket } from "@/components/claim-ticket";
import { BackLink, EmptyState, ErrorState, LoadingState } from "@/components/ui";
import type { Chat, Claim, Publication } from "@/lib/types";
import { useApi } from "@/lib/use-api";

export default function ReclamacionesPage() {
  const { id } = useParams<{ id: string }>();
  const publication = useApi<Publication>(`/publicaciones/${id}`);
  const claims = useApi<Claim[]>(`/publicaciones/${id}/reclamaciones`);
  const chats = useApi<Chat[]>("/chats");

  const backHref = `/publicaciones/${id}`;
  const loadError = (!publication.data && publication.error) || (!claims.data && claims.error);

  function reloadAll() {
    publication.reload();
    claims.reload();
    chats.reload();
  }

  return (
    <main className="mx-auto max-w-xl px-4 pt-[calc(0.5rem+env(safe-area-inset-top,0px))] lg:pt-6">
      <BackLink href={backHref} label="Volver a la publicación" />

      {loadError ? (
        <ErrorState message={loadError.message} onRetry={reloadAll} />
      ) : !publication.data || !claims.data ? (
        <LoadingState label="Cargando reclamaciones" />
      ) : (
        <>
          <h1 className="page-title mt-2">Reclamaciones de {publication.data.title}</h1>
          {claims.data.length === 0 ? (
            <EmptyState title="Todavía nadie ha reclamado este objeto" description="Te aparecerán aquí con sus respuestas." />
          ) : (
            <div className="mt-5 space-y-4">
              {claims.data.map((claim) => (
                <ClaimTicket
                  key={claim.id}
                  claim={claim}
                  publicationStatus={publication.data?.status ?? "active"}
                  chatId={chats.data?.find((chat) => chat.claimId === claim.id)?.id}
                  onChanged={reloadAll}
                />
              ))}
            </div>
          )}
        </>
      )}
    </main>
  );
}
