"use client";

import { useState, type ReactNode } from "react";
import { Drawer } from "vaul";
import { FormError } from "./ui";
import { errorMessage } from "@/lib/api";

// Hoja inferior. Vaul resuelve arrastre, velocidad, foco y tecla Escape.
export function Sheet({
  open,
  onOpenChange,
  title,
  description,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <Drawer.Root open={open} onOpenChange={onOpenChange}>
      <Drawer.Portal>
        <Drawer.Overlay className="fixed inset-0 z-40 bg-black/60" />
        <Drawer.Content
          {...(description ? {} : { "aria-describedby": undefined })}
          className="fixed inset-x-0 bottom-0 z-50 mx-auto flex max-h-[88dvh] max-w-lg flex-col rounded-t-[20px] bg-superficie outline-none"
        >
          <div aria-hidden="true" className="mx-auto mt-3 mb-3 h-1.5 w-10 shrink-0 rounded-full bg-ceniza" />
          <div className="sheet-body">
            <Drawer.Title className="section-title">{title}</Drawer.Title>
            {description && <Drawer.Description className="muted mt-1">{description}</Drawer.Description>}
            <div className="mt-4">{children}</div>
          </div>
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  );
}

// Confirmación de acciones que no se pueden deshacer fácilmente.
export function ConfirmSheet({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  danger = false,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  confirmLabel: string;
  danger?: boolean;
  onConfirm: () => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function confirm() {
    setBusy(true);
    setError(null);
    try {
      await onConfirm();
      onOpenChange(false);
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange} title={title} description={description}>
      <div className="space-y-3">
        <FormError message={error} />
        <button
          type="button"
          className={`btn w-full ${danger ? "btn-danger" : "btn-primary"}`}
          disabled={busy}
          onClick={confirm}
        >
          {busy ? "Un momento" : confirmLabel}
        </button>
        <button type="button" className="btn btn-secondary w-full" onClick={() => onOpenChange(false)}>
          Volver
        </button>
      </div>
    </Sheet>
  );
}
