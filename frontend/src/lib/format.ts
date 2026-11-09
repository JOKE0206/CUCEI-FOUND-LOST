import type { ClaimStatus, PublicationStatus, PublicationType, ReportStatus } from "./types";

// Las fechas de evento son días sin hora: se leen como locales para no cambiar de día.
function parseDay(value: string): Date {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day);
}

const dayFormat = new Intl.DateTimeFormat("es-MX", { day: "numeric", month: "short" });
const timeFormat = new Intl.DateTimeFormat("es-MX", { hour: "numeric", minute: "2-digit" });
const dateTimeFormat = new Intl.DateTimeFormat("es-MX", {
  day: "numeric",
  month: "short",
  hour: "numeric",
  minute: "2-digit",
});

export const formatDay = (value: string) => dayFormat.format(parseDay(value));
export const formatTime = (value: string) => timeFormat.format(new Date(value));
export const formatDateTime = (value: string) => dateTimeFormat.format(new Date(value));

export function localToday(): string {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${now.getFullYear()}-${month}-${day}`;
}

export const KIND_LABEL: Record<PublicationType, string> = {
  found: "Encontrado",
  lost: "Perdido",
};

export const PUBLICATION_STATUS_LABEL: Record<PublicationStatus, string> = {
  active: "Disponible",
  in_process: "En entrega",
  resolved: "Entregado",
  cancelled: "Cancelada",
  removed: "Dada de baja",
  suspended: "Suspendida",
};

export const CLAIM_STATUS_LABEL: Record<ClaimStatus, string> = {
  pending: "En revisión",
  approved: "Aprobada",
  rejected: "Rechazada",
  cancelled: "Cancelada",
};

export const REPORT_STATUS_LABEL: Record<ReportStatus, string> = {
  pending: "Pendiente",
  reviewing: "En revisión",
  resolved: "Resuelto",
  dismissed: "Descartado",
};
