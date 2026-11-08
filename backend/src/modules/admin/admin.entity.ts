import type { PublicProfile } from "../autenticacion/autenticacion.entity";
import type { PublicationStatus } from "../publicaciones/publicaciones.entity";
import type { Report } from "../reports/reports.entity";

export type ModerationAction = "remove" | "suspend";

export const MODERATION_STATUS = {
  remove: "removed",
  suspend: "suspended",
} as const satisfies Record<ModerationAction, PublicationStatus>;

export interface ReportedPublication {
  id: string;
  userId: string;
  title: string;
  description: string;
  status: PublicationStatus;
}

export interface AdminReportView extends Report {
  reporter: PublicProfile | null;
  targetUser: PublicProfile | null;
  targetPublication: ReportedPublication | null;
}
