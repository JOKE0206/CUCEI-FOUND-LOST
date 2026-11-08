import type { Actor } from "../../shared/middlewares/auth.middleware";
import { conflict, notFound, unprocessable } from "../../shared/utils/app-error";
import type { PublicProfileReader } from "../autenticacion/autenticacion.repository";
import type { PublicationReader } from "../publicaciones/publicaciones.repository";
import { loadVisiblePublication } from "../publicaciones/publicaciones.service";
import type { NewReportInput, ReporterReportView } from "./reports.entity";
import type { ReportsRepository } from "./reports.repository";

export class ReportsService {
  constructor(
    private readonly repository: ReportsRepository,
    private readonly publications: PublicationReader,
    private readonly profiles: PublicProfileReader,
  ) {}

  async create(actor: Actor, input: NewReportInput): Promise<ReporterReportView> {
    await this.assertReportableTarget(actor, input);

    if (await this.repository.hasOpenReport(actor.id, input)) {
      throw conflict("REPORTE_EXISTENTE", "Ya tienes un reporte abierto sobre este objetivo");
    }

    const report = await this.repository.create({ ...input, reporterId: actor.id });
    return {
      id: report.id,
      targetPublicationId: report.targetPublicationId,
      targetUserId: report.targetUserId,
      reason: report.reason,
      status: report.status,
      createdAt: report.createdAt,
    };
  }

  private async assertReportableTarget(actor: Actor, input: NewReportInput): Promise<void> {
    if (input.targetPublicationId) {
      const publication = await loadVisiblePublication(
        this.publications,
        input.targetPublicationId,
        actor,
      );
      if (publication.userId === actor.id) {
        throw unprocessable("REPORTE_NO_VALIDO", "No puedes reportar tu propia publicación");
      }
      return;
    }

    if (input.targetUserId === actor.id) {
      throw unprocessable("REPORTE_NO_VALIDO", "No puedes reportarte a ti mismo");
    }

    const [target] = await this.profiles.findPublicProfiles([input.targetUserId as string]);
    if (!target) throw notFound("Usuario no encontrado");
  }
}
