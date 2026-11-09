"use client";

import Image from "next/image";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { ReportSheet } from "@/components/report-sheet";
import { ConfirmSheet } from "@/components/sheet";
import { BackLink, ErrorState, LoadingState } from "@/components/ui";
import { api } from "@/lib/api";
import { useCurrentProfile } from "@/lib/auth";
import { useCatalog } from "@/lib/catalog";
import { CLAIM_STATUS_LABEL, formatDay, KIND_LABEL, PUBLICATION_STATUS_LABEL } from "@/lib/format";
import type { Chat, Claim, Publication } from "@/lib/types";
import { useApi } from "@/lib/use-api";

function OwnerActions({ publication, onChanged }: { publication: Publication; onChanged: () => void }) {
  const [confirming, setConfirming] = useState<"cancel" | "resolve" | null>(null);

  return (
    <div className="space-y-3">
      {(publication.status === "active" || publication.status === "in_process") && (
        <Link href={`/publicaciones/${publication.id}/reclamaciones`} className="btn btn-primary w-full">
          Revisar reclamaciones
        </Link>
      )}
      {publication.status === "in_process" && (
        <button type="button" className="btn btn-secondary w-full" onClick={() => setConfirming("resolve")}>
          Marcar como entregado
        </button>
      )}
      {publication.status === "active" && (
        <div className="flex gap-3">
          <Link href={`/publicaciones/${publication.id}/editar`} className="btn btn-secondary flex-1">
            Editar
          </Link>
          <button type="button" className="btn btn-danger flex-1" onClick={() => setConfirming("cancel")}>
            Cancelar publicación
          </button>
        </div>
      )}
      {(publication.status === "suspended" || publication.status === "removed") && (
        <p className="prose-body">Quien administra la plataforma retiró esta publicación. Solo tú puedes verla.</p>
      )}

      <ConfirmSheet
        open={confirming === "cancel"}
        onOpenChange={(open) => !open && setConfirming(null)}
        title="¿Cancelar esta publicación?"
        description="Dejará de verse en el listado y se rechazarán las reclamaciones pendientes."
        confirmLabel="Cancelar publicación"
        danger
        onConfirm={async () => {
          await api(`/publicaciones/${publication.id}/cancelar`, { method: "POST" });
          toast.success("Publicación cancelada");
          onChanged();
        }}
      />
      <ConfirmSheet
        open={confirming === "resolve"}
        onOpenChange={(open) => !open && setConfirming(null)}
        title="¿Ya se entregó el objeto?"
        description="Se cerrará la conversación y se rechazarán las reclamaciones pendientes."
        confirmLabel="Marcar como entregado"
        onConfirm={async () => {
          await api(`/publicaciones/${publication.id}/resolver`, { method: "POST" });
          toast.success("Objeto marcado como entregado");
          onChanged();
        }}
      />
    </div>
  );
}

function VisitorActions({ publication, onChanged }: { publication: Publication; onChanged: () => void }) {
  const claims = useApi<Claim[]>("/reclamaciones/mias");
  const chats = useApi<Chat[]>("/chats");
  const [withdrawing, setWithdrawing] = useState(false);

  if (claims.error) return <ErrorState message={claims.error.message} onRetry={claims.reload} />;
  if (!claims.data) return <div className="placeholder-block h-12" />;

  const claim = claims.data.find((item) => item.publicationId === publication.id);
  const open = publication.status === "active";
  const chat = claim && chats.data?.find((item) => item.claimId === claim.id);
  const canWithdraw = claim?.status === "pending" || (claim?.status === "approved" && publication.status === "in_process");

  return (
    <div className="space-y-3">
      {claim && (
        <p className="font-medium">
          Tu reclamación: <span className="status-label ml-1">{CLAIM_STATUS_LABEL[claim.status]}</span>
        </p>
      )}
      {claim?.status === "rejected" && (
        <p className="prose-body">Tu reclamación fue rechazada y no puedes volver a intentarlo en esta publicación.</p>
      )}
      {claim?.status === "approved" && chat && (
        <Link href={`/chats/${chat.id}`} className="btn btn-primary w-full">
          Abrir conversación
        </Link>
      )}
      {open && (!claim || claim.status === "cancelled") && (
        <Link href={`/publicaciones/${publication.id}/reclamar`} className="btn btn-primary w-full">
          Reclamar este objeto
        </Link>
      )}
      {claim && canWithdraw && (
        <button type="button" className="btn btn-secondary w-full" onClick={() => setWithdrawing(true)}>
          Retirar mi reclamación
        </button>
      )}
      {claim && (
        <ConfirmSheet
          open={withdrawing}
          onOpenChange={setWithdrawing}
          title="¿Retirar tu reclamación?"
          description={claim.status === "approved" ? "La conversación se cerrará y el objeto volverá a estar disponible." : "Podrás reclamar de nuevo mientras el objeto siga disponible."}
          confirmLabel="Retirar reclamación"
          danger
          onConfirm={async () => {
            await api(`/reclamaciones/${claim.id}/cancelar`, { method: "POST" });
            toast.success("Reclamación retirada");
            claims.reload();
            onChanged();
          }}
        />
      )}
    </div>
  );
}

export default function PublicacionPage() {
  const { id } = useParams<{ id: string }>();
  const profile = useCurrentProfile();
  const { locationName, categoryName, campusName } = useCatalog();
  const publication = useApi<Publication>(`/publicaciones/${id}`);
  const [reporting, setReporting] = useState(false);

  if (publication.error && !publication.data) {
    return (
      <main className="mx-auto max-w-xl px-4 pt-5">
        <BackLink href="/" label="Volver a buscar" />
        <ErrorState
          message={publication.error.status === 404 ? "Esta publicación ya no está disponible." : publication.error.message}
          onRetry={publication.error.status === 404 ? undefined : publication.reload}
        />
      </main>
    );
  }

  if (!publication.data) {
    return (
      <main className="mx-auto max-w-xl px-4 pt-5">
        <LoadingState label="Cargando publicación" />
      </main>
    );
  }

  const item = publication.data;
  const isOwner = item.userId === profile.id;
  const place = locationName(item.locationId) ?? campusName(item.campusId);

  return (
    <main className="mx-auto max-w-xl px-4 pt-[calc(0.5rem+env(safe-area-inset-top,0px))] lg:pt-6">
      <BackLink href="/" label="Volver a buscar" />

      <article className="tag mt-2" data-kind={item.type}>
        <span aria-hidden="true" className="tag-hole" />
        {item.photos.length > 0 && (
          <div className="flex snap-x snap-mandatory overflow-x-auto" tabIndex={item.photos.length > 1 ? 0 : undefined} aria-label={item.photos.length > 1 ? "Fotos del objeto" : undefined}>
            {item.photos.map((photo, index) => (
              <div key={photo.id} className="relative aspect-[4/3] w-full shrink-0 snap-start bg-superficie">
                <Image src={photo.url} alt={`Foto ${index + 1} de ${item.title}`} fill unoptimized loading={index === 0 ? "eager" : "lazy"} className="object-cover" sizes="(min-width: 640px) 36rem, 100vw" />
              </div>
            ))}
          </div>
        )}
        <div className={`px-5 pb-5 ${item.photos.length > 0 ? "pt-4" : "pt-9"}`}>
          <div className="flex flex-wrap items-center gap-2">
            <span className="kind-label">{KIND_LABEL[item.type]}</span>
            <span className="status-label">{PUBLICATION_STATUS_LABEL[item.status]}</span>
          </div>
          <h1 className="object-title mt-2 text-[2.5rem]">{item.title}</h1>
          <p className="mt-1 font-medium">{[place, formatDay(item.eventDate)].filter(Boolean).join(", ")}</p>
        </div>
      </article>

      <div className="mt-5 space-y-5">
        <p className="prose-body">{item.description}</p>
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1">
          <dt className="muted">Categoría</dt>
          <dd>{categoryName(item.categoryId) ?? "Sin categoría"}</dd>
          <dt className="muted">Publicó</dt>
          <dd className="wrap-anywhere">{isOwner ? "Tú" : (item.publisher?.displayName ?? "Usuario")}</dd>
        </dl>

        {isOwner ? (
          <OwnerActions publication={item} onChanged={publication.reload} />
        ) : (
          <VisitorActions publication={item} onChanged={publication.reload} />
        )}

        {!isOwner && (
          <button type="button" className="btn-link" onClick={() => setReporting(true)}>
            Reportar
          </button>
        )}
      </div>

      {!isOwner && <ReportSheet open={reporting} onOpenChange={setReporting} publicationId={item.id} user={item.publisher} />}
    </main>
  );
}
