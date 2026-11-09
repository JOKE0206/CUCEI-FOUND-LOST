"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { ConfirmSheet } from "./sheet";
import { api, errorMessage } from "@/lib/api";
import { CLAIM_STATUS_LABEL, formatDateTime } from "@/lib/format";
import type { Claim, PublicationStatus } from "@/lib/types";

// Boleto de reclamación para quien publicó. Al aprobar, el talón se desprende y
// se convierte en el acceso al chat. El enlace existe y funciona desde el primer
// cuadro: la animación solo mueve el talón y nunca retrasa la navegación.
export function ClaimTicket({
  claim,
  publicationStatus,
  chatId,
  onChanged,
}: {
  claim: Claim;
  publicationStatus: PublicationStatus;
  chatId?: string;
  onChanged: () => void;
}) {
  const [approvedChatId, setApprovedChatId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState<"reject" | "revoke" | null>(null);
  const openChatRef = useRef<HTMLAnchorElement>(null);

  const justTorn = approvedChatId !== null;
  const torn = justTorn || claim.status === "approved";
  const conversation = approvedChatId ?? chatId;
  const claimant = claim.claimant?.displayName ?? "Usuario";

  // El botón pulsado desaparece: el foco pasa a la acción que lo reemplaza.
  useEffect(() => {
    if (justTorn) openChatRef.current?.focus({ preventScroll: true });
  }, [justTorn]);

  async function approve() {
    setBusy(true);
    try {
      const result = await api<{ chatId: string }>(`/reclamaciones/${claim.id}/aprobar`, { method: "POST" });
      setApprovedChatId(result.chatId);
      toast.success("Reclamación aprobada");
      onChanged();
    } catch (caught) {
      toast.error(errorMessage(caught));
    } finally {
      setBusy(false);
    }
  }

  return (
    <article className="ticket" data-state={torn ? "torn" : "whole"} data-just-torn={justTorn}>
      <div className="ticket-body">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="section-title wrap-anywhere">{claimant}</h2>
          <span className="status-label">{CLAIM_STATUS_LABEL[justTorn ? "approved" : claim.status]}</span>
        </div>
        <p className="muted text-sm">{formatDateTime(claim.createdAt)}</p>

        {claim.responses.length > 0 && (
          <dl className="mt-3 space-y-3">
            {claim.responses.map((response) => (
              <div key={response.questionId}>
                <dt className="muted">{response.question}</dt>
                <dd className="prose-body font-medium">{response.answer}</dd>
              </div>
            ))}
          </dl>
        )}
      </div>

      <div aria-hidden="true" className="perforation" />

      <div className="ticket-stub">
        {torn ? (
          <div className="space-y-2">
            <p className="font-semibold wrap-anywhere">Aprobaste a {claimant}.</p>
            <Link ref={openChatRef} href={conversation ? `/chats/${conversation}` : "/chats"} className="btn btn-open-chat w-full">
              Abrir conversación
            </Link>
            {publicationStatus !== "resolved" && (
              <button type="button" className="btn-link text-pizarron decoration-pizarron" onClick={() => setConfirming("revoke")}>
                Revocar aprobación
              </button>
            )}
          </div>
        ) : claim.status === "pending" ? (
          publicationStatus === "active" ? (
            <div className="flex gap-3">
              <button type="button" className="btn btn-primary flex-1" disabled={busy} onClick={approve}>
                {busy ? "Aprobando" : "Aprobar"}
              </button>
              <button type="button" className="btn btn-danger flex-1" disabled={busy} onClick={() => setConfirming("reject")}>
                Rechazar
              </button>
            </div>
          ) : (
            <p className="muted">Hay una entrega en curso. Podrás revisar esta reclamación si se revoca.</p>
          )
        ) : (
          <p className="muted">Esta reclamación ya está cerrada.</p>
        )}
      </div>

      <ConfirmSheet
        open={confirming === "reject"}
        onOpenChange={(open) => !open && setConfirming(null)}
        title={`¿Rechazar a ${claimant}?`}
        description="Esta persona no podrá volver a reclamar este objeto."
        confirmLabel="Rechazar reclamación"
        danger
        onConfirm={async () => {
          await api(`/reclamaciones/${claim.id}/rechazar`, { method: "POST" });
          toast.success("Reclamación rechazada");
          onChanged();
        }}
      />
      <ConfirmSheet
        open={confirming === "revoke"}
        onOpenChange={(open) => !open && setConfirming(null)}
        title="¿Revocar la aprobación?"
        description="La conversación se cerrará y el objeto volverá a estar disponible."
        confirmLabel="Revocar aprobación"
        danger
        onConfirm={async () => {
          await api(`/reclamaciones/${claim.id}/cancelar`, { method: "POST" });
          setApprovedChatId(null);
          toast.success("Aprobación revocada");
          onChanged();
        }}
      />
    </article>
  );
}
