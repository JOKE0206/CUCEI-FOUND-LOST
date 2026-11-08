import { assertAdmin, type Actor } from "../../shared/middlewares/auth.middleware";
import { conflict, notFound } from "../../shared/utils/app-error";
import type { PublicProfileReader } from "../autenticacion/autenticacion.repository";
import type { Report, ReportDecision, ReportFilters } from "../reports/reports.entity";
import type { ReportsRepository } from "../reports/reports.repository";
import {
  MODERATION_STATUS,
  type AdminReportView,
  type ModerationAction,
  type ReportedPublication,
} from "./admin.entity";
import type { AdminRepository } from "./admin.repository";

// Este servicio no tiene acceso a mensajes ni a respuestas de verificación.
export class AdminService {
  constructor(
    private readonly repository: AdminRepository,
    private readonly reports: ReportsRepository,
    private readonly profiles: PublicProfileReader,
  ) {}

  async listReports(actor: Actor, filters: ReportFilters) {
    assertAdmin(actor);

    const { items, total } = await this.reports.list(filters);
    return {
      items: await this.toViews(items),
      total,
      page: filters.page,
      pageSize: filters.pageSize,
    };
  }

  async decideReport(
    actor: Actor,
    reportId: string,
    decision: ReportDecision,
  ): Promise<AdminReportView> {
    assertAdmin(actor);

    if (!(await this.reports.findById(reportId))) throw notFound("Reporte no encontrado");

    const closed = await this.reports.closeIfOpen(reportId, actor.id, decision);
    if (!closed) throw conflict("REPORTE_CERRADO", "El reporte ya fue atendido");

    const [view] = await this.toViews([closed]);
    return view;
  }

  async moderatePublication(
    actor: Actor,
    publicationId: string,
    action: ModerationAction,
  ): Promise<ReportedPublication> {
    assertAdmin(actor);

    const publication = await this.findPublication(publicationId);
    if (
      publication.status === "removed" ||
      (action === "suspend" && !["active", "in_process"].includes(publication.status))
    ) {
      throw conflict("ESTADO_NO_VALIDO", "La publicación no admite esta acción en su estado actual");
    }

    await this.repository.moderatePublication(publicationId, MODERATION_STATUS[action]);
    return this.findPublication(publicationId);
  }

  // Vuelve a activa: las reclamaciones se cancelaron al suspender y no se
  // restauran, así que esas personas pueden reclamar de nuevo.
  async unsuspendPublication(actor: Actor, publicationId: string): Promise<ReportedPublication> {
    assertAdmin(actor);

    const publication = await this.findPublication(publicationId);
    if (publication.status !== "suspended") {
      throw conflict("ESTADO_NO_VALIDO", "La publicación no está suspendida");
    }
    if (await this.reports.hasOpenReportsOnPublication(publicationId)) {
      throw conflict(
        "REPORTES_ABIERTOS",
        "Atiende los reportes abiertos de esta publicación antes de reactivarla",
      );
    }
    if (!(await this.repository.reactivateIfSuspended(publicationId))) {
      throw conflict("ESTADO_NO_VALIDO", "La publicación no está suspendida");
    }

    return this.findPublication(publicationId);
  }

  private async findPublication(publicationId: string): Promise<ReportedPublication> {
    const [publication] = await this.repository.findPublications([publicationId]);
    if (!publication) throw notFound("Publicación no encontrada");
    return publication;
  }

  private async toViews(reports: Report[]): Promise<AdminReportView[]> {
    const profileIds = reports.flatMap((report) =>
      report.targetUserId ? [report.reporterId, report.targetUserId] : [report.reporterId],
    );
    const publicationIds = reports.flatMap((report) =>
      report.targetPublicationId ? [report.targetPublicationId] : [],
    );
    const [profiles, publications] = await Promise.all([
      this.profiles.findPublicProfiles([...new Set(profileIds)]),
      this.repository.findPublications([...new Set(publicationIds)]),
    ]);

    return reports.map((report) => ({
      ...report,
      reporter: profiles.find((profile) => profile.id === report.reporterId) ?? null,
      targetUser: profiles.find((profile) => profile.id === report.targetUserId) ?? null,
      targetPublication:
        publications.find((publication) => publication.id === report.targetPublicationId) ?? null,
    }));
  }
}
