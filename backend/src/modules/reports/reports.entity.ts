export type ReportStatus = "pending" | "reviewing" | "resolved" | "dismissed";
export type ReportDecision = "resolved" | "dismissed";

export interface Report {
  id: string;
  reporterId: string;
  targetPublicationId: string | null;
  targetUserId: string | null;
  reason: string;
  status: ReportStatus;
  reviewedBy: string | null;
  reviewedAt: string | null;
  createdAt: string;
}

// Un reporte apunta exactamente a una publicación o a un usuario.
export type ReportTarget =
  | { targetPublicationId: string; targetUserId: null }
  | { targetPublicationId: null; targetUserId: string };

export type NewReportInput = ReportTarget & { reason: string };
export type NewReport = NewReportInput & { reporterId: string };

// Lo que ve quien reportó: no incluye quién lo revisó.
export type ReporterReportView = Omit<Report, "reporterId" | "reviewedBy" | "reviewedAt">;

export interface ReportFilters {
  status?: ReportStatus;
  page: number;
  pageSize: number;
}
