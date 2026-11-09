"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { ConfirmSheet } from "@/components/sheet";
import { EmptyState, ErrorState, LoadingState, Segmented } from "@/components/ui";
import { api, errorMessage } from "@/lib/api";
import { useCurrentProfile } from "@/lib/auth";
import { formatDateTime, PUBLICATION_STATUS_LABEL, REPORT_STATUS_LABEL } from "@/lib/format";
import type { AdminReport, Paginated, ReportStatus } from "@/lib/types";
import { useApi } from "@/lib/use-api";

type Filter = ReportStatus | "all";

function ReportCard({ report, onChanged }: { report: AdminReport; onChanged: () => void }) {
  const [busy, setBusy] = useState(false);
  const [confirmingRemove, setConfirmingRemove] = useState(false);
  const open = report.status === "pending" || report.status === "reviewing";
  const publication = report.targetPublication;

  async function run(action: () => Promise<unknown>, success: string) {
    setBusy(true);
    try {
      await action();
      toast.success(success);
      onChanged();
    } catch (caught) {
      toast.error(errorMessage(caught));
    } finally {
      setBusy(false);
    }
  }

  const decide = (status: "resolved" | "dismissed") =>
    run(
      () => api(`/admin/reports/${report.id}`, { method: "PATCH", body: { status } }),
      status === "resolved" ? "Reporte resuelto" : "Reporte descartado",
    );

  const moderate = (action: "suspend" | "remove") =>
    api(`/admin/publications/${publication?.id}/moderate`, { method: "POST", body: { action } });

  return (
    <article className="rounded-xl bg-superficie p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="section-title">{publication ? "Publicación reportada" : "Usuario reportado"}</h2>
        <span className="status-label">{REPORT_STATUS_LABEL[report.status]}</span>
      </div>
      <p className="muted text-sm wrap-anywhere">
        Reportó {report.reporter?.displayName ?? "Usuario"}, {formatDateTime(report.createdAt)}
      </p>
      <p className="prose-body mt-3 font-medium">{report.reason}</p>

      {publication && (
        <div className="mt-3 border-t border-linea pt-3">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-semibold wrap-anywhere">{publication.title}</h3>
            <span className="status-label">{PUBLICATION_STATUS_LABEL[publication.status]}</span>
          </div>
          <p className="prose-body muted mt-1">{publication.description}</p>
        </div>
      )}
      {report.targetUser && <p className="mt-3 font-semibold wrap-anywhere">{report.targetUser.displayName}</p>}

      <div className="mt-4 space-y-2">
        {publication && (
          <div className="flex flex-wrap gap-2">
            {(publication.status === "active" || publication.status === "in_process") && (
              <button type="button" className="btn btn-secondary flex-1" disabled={busy} onClick={() => run(() => moderate("suspend"), "Publicación suspendida")}>
                Suspender
              </button>
            )}
            {publication.status === "suspended" && (
              <button
                type="button"
                className="btn btn-secondary flex-1"
                disabled={busy}
                onClick={() => run(() => api(`/admin/publications/${publication.id}/unsuspend`, { method: "POST" }), "Publicación reactivada")}
              >
                Reactivar
              </button>
            )}
            {publication.status !== "removed" && (
              <button type="button" className="btn btn-danger flex-1" disabled={busy} onClick={() => setConfirmingRemove(true)}>
                Dar de baja
              </button>
            )}
          </div>
        )}
        {open && (
          <div className="flex gap-2">
            <button type="button" className="btn btn-primary flex-1" disabled={busy} onClick={() => decide("resolved")}>
              Resolver
            </button>
            <button type="button" className="btn btn-secondary flex-1" disabled={busy} onClick={() => decide("dismissed")}>
              Descartar
            </button>
          </div>
        )}
      </div>

      <ConfirmSheet
        open={confirmingRemove}
        onOpenChange={setConfirmingRemove}
        title="¿Dar de baja esta publicación?"
        description="Es definitivo: no se puede reactivar. Sus reclamaciones abiertas se cancelarán."
        confirmLabel="Dar de baja"
        danger
        onConfirm={async () => {
          await moderate("remove");
          toast.success("Publicación dada de baja");
          onChanged();
        }}
      />
    </article>
  );
}

export default function AdminPage() {
  const profile = useCurrentProfile();
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const filter = (params.get("estado") ?? "pending") as Filter;
  const query = filter === "all" ? "" : `&status=${filter}`;
  const isAdmin = profile.role === "admin";
  const reports = useApi<Paginated<AdminReport>>(isAdmin ? `/admin/reports?page=1&pageSize=50${query}` : null);

  if (!isAdmin) {
    return (
      <main className="mx-auto max-w-xl px-4 pt-5">
        <ErrorState message="Esta sección es solo para administración." />
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-2xl px-4 pt-[calc(1.25rem+env(safe-area-inset-top,0px))] lg:pt-8">
      <h1 className="page-title">Reportes</h1>
      <div className="mt-4">
        <Segmented<Filter>
          label="Estado"
          value={filter}
          options={[
            { value: "pending", label: "Pendientes" },
            { value: "resolved", label: "Resueltos" },
            { value: "dismissed", label: "Descartados" },
            { value: "all", label: "Todos" },
          ]}
          onChange={(value) => router.replace(`${pathname}?estado=${value}`, { scroll: false })}
        />
      </div>

      <div className="mt-5">
        {reports.error && !reports.data ? (
          <ErrorState message={reports.error.message} onRetry={reports.reload} />
        ) : !reports.data ? (
          <LoadingState label="Cargando reportes" />
        ) : reports.data.items.length === 0 ? (
          <EmptyState title="No hay reportes en esta vista" />
        ) : (
          <div className="space-y-4">
            {reports.data.items.map((report) => (
              <ReportCard key={report.id} report={report} onChanged={reports.reload} />
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
