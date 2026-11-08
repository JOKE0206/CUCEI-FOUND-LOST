import { unprocessable } from "../../shared/utils/app-error";
import type { PublicProfile } from "../autenticacion/autenticacion.entity";
import type { PublicationType } from "../publicaciones/publicaciones.entity";

export type ClaimStatus = "pending" | "approved" | "rejected" | "cancelled";

// Solo el texto de la pregunta: quien publica evalúa las respuestas manualmente.
export interface VerificationQuestion {
  id: string;
  publicationId: string;
  question: string;
  position: number;
}

export interface Claim {
  id: string;
  publicationId: string;
  claimantId: string;
  status: ClaimStatus;
  reviewedAt: string | null;
  createdAt: string;
}

export interface ClaimResponse {
  claimId: string;
  questionId: string;
  question: string;
  answer: string;
}

export interface ClaimAnswer {
  questionId: string;
  answer: string;
}

export interface ClaimView extends Claim {
  claimant: PublicProfile | null;
  responses: Omit<ClaimResponse, "claimId">[];
}

export const MAX_QUESTIONS_PER_PUBLICATION = 5;
const QUESTION_MIN_LENGTH = 3;
const QUESTION_MAX_LENGTH = 300;

// Sin preguntas no hay forma de evaluar a quien reclama un objeto encontrado.
export function normalizeVerificationQuestions(
  type: PublicationType,
  questions: string[],
): string[] {
  const normalized = questions.map((question) => question.trim());

  if (normalized.length > MAX_QUESTIONS_PER_PUBLICATION) {
    throw unprocessable(
      "PREGUNTAS_NO_VALIDAS",
      `Máximo ${MAX_QUESTIONS_PER_PUBLICATION} preguntas por publicación`,
    );
  }
  if (type === "found" && normalized.length === 0) {
    throw unprocessable(
      "PREGUNTAS_NO_VALIDAS",
      "Un objeto encontrado requiere al menos una pregunta de verificación",
    );
  }
  if (
    normalized.some(
      (question) =>
        question.length < QUESTION_MIN_LENGTH || question.length > QUESTION_MAX_LENGTH,
    )
  ) {
    throw unprocessable(
      "PREGUNTAS_NO_VALIDAS",
      `Cada pregunta debe tener entre ${QUESTION_MIN_LENGTH} y ${QUESTION_MAX_LENGTH} caracteres`,
    );
  }
  if (new Set(normalized.map((question) => question.toLowerCase())).size !== normalized.length) {
    throw unprocessable("PREGUNTAS_NO_VALIDAS", "Las preguntas no pueden repetirse");
  }

  return normalized;
}
