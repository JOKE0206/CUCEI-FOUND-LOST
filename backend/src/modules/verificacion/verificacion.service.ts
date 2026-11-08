import type { Actor } from "../../shared/middlewares/auth.middleware";
import { conflict, forbidden, notFound, unprocessable } from "../../shared/utils/app-error";
import type { PublicProfileReader } from "../autenticacion/autenticacion.repository";
import type { Publication } from "../publicaciones/publicaciones.entity";
import type { PublicationReader } from "../publicaciones/publicaciones.repository";
import {
  assertPublicationOwner,
  loadVisiblePublication,
} from "../publicaciones/publicaciones.service";
import {
  normalizeVerificationQuestions,
  type Claim,
  type ClaimAnswer,
  type ClaimView,
  type VerificationQuestion,
} from "./verificacion.entity";
import type { VerificacionRepository } from "./verificacion.repository";

export class VerificacionService {
  constructor(
    private readonly repository: VerificacionRepository,
    private readonly publications: PublicationReader,
    private readonly profiles: PublicProfileReader,
  ) {}

  async listQuestions(publicationId: string, actor: Actor): Promise<VerificationQuestion[]> {
    await loadVisiblePublication(this.publications, publicationId, actor);
    return this.repository.listQuestions(publicationId);
  }

  async replaceQuestions(
    publicationId: string,
    actor: Actor,
    questions: string[],
  ): Promise<VerificationQuestion[]> {
    const publication = await loadVisiblePublication(this.publications, publicationId, actor);
    assertPublicationOwner(publication, actor);

    if (publication.status !== "active") {
      throw conflict("ESTADO_NO_VALIDO", "La publicación ya no está activa");
    }
    if ((await this.repository.countClaims(publicationId)) > 0) {
      throw conflict(
        "PREGUNTAS_BLOQUEADAS",
        "Las preguntas no se pueden cambiar si ya hay reclamaciones",
      );
    }

    const normalized = normalizeVerificationQuestions(publication.type, questions);
    await this.repository.replaceQuestions(publicationId, actor.id, normalized);
    return this.repository.listQuestions(publicationId);
  }

  async submitClaim(
    publicationId: string,
    actor: Actor,
    answers: ClaimAnswer[],
  ): Promise<ClaimView> {
    const publication = await loadVisiblePublication(this.publications, publicationId, actor);

    if (publication.userId === actor.id) {
      throw forbidden("SIN_PERMISO", "No puedes reclamar tu propia publicación");
    }
    if (publication.status !== "active") {
      throw conflict("ESTADO_NO_VALIDO", "La publicación no está abierta a reclamaciones");
    }
    if (await this.repository.hasRejectedClaim(publicationId, actor.id)) {
      throw forbidden(
        "RECLAMACION_RECHAZADA",
        "Tu reclamación para esta publicación fue rechazada previamente y no puedes volver a intentar",
      );
    }
    if (await this.repository.findOpenClaim(publicationId, actor.id)) {
      throw conflict("RECLAMACION_EXISTENTE", "Ya tienes una reclamación abierta");
    }

    const questions = await this.repository.listQuestions(publicationId);
    const expected = new Set(questions.map((question) => question.id));
    const answered = new Set(answers.map((item) => item.questionId));

    if (
      answers.length !== expected.size ||
      answered.size !== expected.size ||
      [...answered].some((id) => !expected.has(id))
    ) {
      throw unprocessable("RESPUESTAS_NO_VALIDAS", "Debes responder cada pregunta exactamente una vez");
    }

    const claimId = await this.repository.submitClaim(publicationId, actor.id, answers);
    return this.getClaim(claimId, actor);
  }

  async listForPublication(publicationId: string, actor: Actor): Promise<ClaimView[]> {
    const publication = await loadVisiblePublication(this.publications, publicationId, actor);
    assertPublicationOwner(publication, actor);
    return this.toViews(await this.repository.listClaimsByPublication(publicationId));
  }

  async listMine(actor: Actor): Promise<ClaimView[]> {
    return this.toViews(await this.repository.listClaimsByClaimant(actor.id));
  }

  async getClaim(claimId: string, actor: Actor): Promise<ClaimView> {
    const { claim } = await this.loadClaimForParticipant(claimId, actor);
    const [view] = await this.toViews([claim]);
    return view;
  }

  async approve(claimId: string, actor: Actor): Promise<{ claim: ClaimView; chatId: string }> {
    const { claim, publication } = await this.loadClaimForParticipant(claimId, actor);
    assertPublicationOwner(publication, actor);

    if (claim.status !== "pending" || publication.status !== "active") {
      throw conflict("ESTADO_NO_VALIDO", "La reclamación ya no se puede aprobar");
    }

    const chatId = await this.repository.approveClaim(claimId, actor.id);
    return { claim: await this.getClaim(claimId, actor), chatId };
  }

  async reject(claimId: string, actor: Actor): Promise<ClaimView> {
    const { publication } = await this.loadClaimForParticipant(claimId, actor);
    assertPublicationOwner(publication, actor);

    if (!(await this.repository.rejectIfPending(claimId))) {
      throw conflict("ESTADO_NO_VALIDO", "La reclamación ya no se puede rechazar");
    }

    return this.getClaim(claimId, actor);
  }

  // Quien reclama puede retirarse; quien publicó solo puede revocar una aprobación.
  async cancel(claimId: string, actor: Actor): Promise<ClaimView> {
    const { claim, publication } = await this.loadClaimForParticipant(claimId, actor);

    if (claim.status === "pending" && claim.claimantId !== actor.id) {
      throw forbidden("SIN_PERMISO", "Solo quien reclamó puede retirar una solicitud pendiente");
    }
    if (claim.status === "rejected" || claim.status === "cancelled") {
      throw conflict("ESTADO_NO_VALIDO", "La reclamación ya está cerrada");
    }
    if (claim.status === "approved" && publication.status !== "in_process") {
      throw conflict("ESTADO_NO_VALIDO", "La entrega ya concluyó");
    }

    await this.repository.cancelClaim(claimId, actor.id);
    return this.getClaim(claimId, actor);
  }

  // Quien no participa recibe 404, para no revelar que la reclamación existe.
  private async loadClaimForParticipant(
    claimId: string,
    actor: Actor,
  ): Promise<{ claim: Claim; publication: Publication }> {
    const claim = await this.repository.findClaim(claimId);
    if (!claim) throw notFound("Reclamación no encontrada");

    const publication = await this.publications.findById(claim.publicationId);
    if (!publication) throw notFound("Reclamación no encontrada");

    if (claim.claimantId !== actor.id && publication.userId !== actor.id) {
      throw notFound("Reclamación no encontrada");
    }

    return { claim, publication };
  }

  private async toViews(claims: Claim[]): Promise<ClaimView[]> {
    const [responses, profiles] = await Promise.all([
      this.repository.listResponses(claims.map((claim) => claim.id)),
      this.profiles.findPublicProfiles([...new Set(claims.map((claim) => claim.claimantId))]),
    ]);

    return claims.map((claim) => ({
      ...claim,
      claimant: profiles.find((profile) => profile.id === claim.claimantId) ?? null,
      responses: responses
        .filter((response) => response.claimId === claim.id)
        .map(({ questionId, question, answer }) => ({ questionId, question, answer })),
    }));
  }
}
