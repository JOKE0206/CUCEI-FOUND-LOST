"use client";

import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { Sheet } from "./sheet";
import { Field, FormError } from "./ui";
import { api, errorMessage } from "@/lib/api";

export function ReportSheet({
  open,
  onOpenChange,
  publicationId,
  user,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  publicationId?: string;
  user?: { id: string; displayName: string } | null;
}) {
  const [target, setTarget] = useState<"publication" | "user">(publicationId ? "publication" : "user");
  const [reason, setReason] = useState("");
  const [reasonError, setReasonError] = useState<string>();
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    const text = reason.trim();
    if (text.length < 3) {
      setReasonError("Cuéntanos qué ocurre, con al menos 3 caracteres.");
      return;
    }

    setReasonError(undefined);
    setFormError(null);
    setBusy(true);
    try {
      await api("/reports", {
        method: "POST",
        body:
          target === "publication"
            ? { targetPublicationId: publicationId, reason: text }
            : { targetUserId: user?.id, reason: text },
      });
      toast.success("Reporte enviado");
      setReason("");
      onOpenChange(false);
    } catch (caught) {
      setFormError(errorMessage(caught));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange} title="Reportar" description="Quien administra la plataforma revisará tu reporte.">
      <form onSubmit={submit} noValidate className="space-y-4">
        {publicationId && user && (
          <fieldset>
            <legend className="mb-1.5 font-semibold">¿Qué quieres reportar?</legend>
            <div className="space-y-2">
              <label className="choice">
                <input type="radio" name="target" checked={target === "publication"} onChange={() => setTarget("publication")} />
                Esta publicación
              </label>
              <label className="choice">
                <input type="radio" name="target" checked={target === "user"} onChange={() => setTarget("user")} />
                A {user.displayName}
              </label>
            </div>
          </fieldset>
        )}
        <Field label="Motivo" error={reasonError}>
          {(props) => (
            <textarea
              {...props}
              className="control"
              rows={3}
              maxLength={1000}
              value={reason}
              onChange={(event) => setReason(event.target.value)}
            />
          )}
        </Field>
        <FormError message={formError} />
        <button type="submit" className="btn btn-primary w-full" disabled={busy}>
          {busy ? "Enviando" : "Enviar reporte"}
        </button>
      </form>
    </Sheet>
  );
}
