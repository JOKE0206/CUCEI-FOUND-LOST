import { getSupabase } from "../../config/supabase";
import { unwrap } from "../../shared/utils/supabase-result";
import type {
  Claim,
  ClaimAnswer,
  ClaimResponse,
  VerificationQuestion,
} from "./verificacion.entity";

export interface VerificacionRepository {
  listQuestions(publicationId: string): Promise<VerificationQuestion[]>;
  replaceQuestions(publicationId: string, userId: string, questions: string[]): Promise<void>;
  countClaims(publicationId: string): Promise<number>;
  findClaim(id: string): Promise<Claim | null>;
  findOpenClaim(publicationId: string, claimantId: string): Promise<Claim | null>;
  hasRejectedClaim(publicationId: string, claimantId: string): Promise<boolean>;
  listClaimsByPublication(publicationId: string): Promise<Claim[]>;
  listClaimsByClaimant(claimantId: string): Promise<Claim[]>;
  listResponses(claimIds: string[]): Promise<ClaimResponse[]>;
  submitClaim(publicationId: string, claimantId: string, answers: ClaimAnswer[]): Promise<string>;
  approveClaim(claimId: string, publisherId: string): Promise<string>;
  rejectIfPending(claimId: string): Promise<boolean>;
  cancelClaim(claimId: string, actorId: string): Promise<void>;
}

interface QuestionRow {
  id: string;
  publication_id: string;
  question: string;
  position: number;
}

interface ClaimRow {
  id: string;
  publication_id: string;
  claimant_id: string;
  status: Claim["status"];
  reviewed_at: string | null;
  created_at: string;
}

interface ResponseRow {
  claim_id: string;
  question_id: string;
  answer: string;
}

const CLAIM_COLUMNS = "id, publication_id, claimant_id, status, reviewed_at, created_at";

function toClaim(row: ClaimRow): Claim {
  return {
    id: row.id,
    publicationId: row.publication_id,
    claimantId: row.claimant_id,
    status: row.status,
    reviewedAt: row.reviewed_at,
    createdAt: row.created_at,
  };
}

export class SupabaseVerificacionRepository implements VerificacionRepository {
  async listQuestions(publicationId: string): Promise<VerificationQuestion[]> {
    const rows = unwrap<QuestionRow[]>(
      await getSupabase()
        .from("verification_questions")
        .select("id, publication_id, question, position")
        .eq("publication_id", publicationId)
        .order("position", { ascending: true }),
    );
    return rows.map((row) => ({
      id: row.id,
      publicationId: row.publication_id,
      question: row.question,
      position: row.position,
    }));
  }

  async replaceQuestions(publicationId: string, userId: string, questions: string[]): Promise<void> {
    unwrap(
      await getSupabase().rpc("replace_verification_questions", {
        p_publication_id: publicationId,
        p_user_id: userId,
        p_questions: questions,
      }),
    );
  }

  async countClaims(publicationId: string): Promise<number> {
    const result = await getSupabase()
      .from("claims")
      .select("id", { count: "exact", head: true })
      .eq("publication_id", publicationId);
    unwrap(result);
    return result.count ?? 0;
  }

  async findClaim(id: string): Promise<Claim | null> {
    const row = unwrap<ClaimRow | null>(
      await getSupabase().from("claims").select(CLAIM_COLUMNS).eq("id", id).maybeSingle(),
    );
    return row ? toClaim(row) : null;
  }

  async findOpenClaim(publicationId: string, claimantId: string): Promise<Claim | null> {
    const row = unwrap<ClaimRow | null>(
      await getSupabase()
        .from("claims")
        .select(CLAIM_COLUMNS)
        .eq("publication_id", publicationId)
        .eq("claimant_id", claimantId)
        .in("status", ["pending", "approved"])
        .maybeSingle(),
    );
    return row ? toClaim(row) : null;
  }

  async hasRejectedClaim(publicationId: string, claimantId: string): Promise<boolean> {
    const rows = unwrap<{ id: string }[]>(
      await getSupabase()
        .from("claims")
        .select("id")
        .eq("publication_id", publicationId)
        .eq("claimant_id", claimantId)
        .eq("status", "rejected")
        .limit(1),
    );
    return rows.length > 0;
  }

  async listClaimsByPublication(publicationId: string): Promise<Claim[]> {
    const rows = unwrap<ClaimRow[]>(
      await getSupabase()
        .from("claims")
        .select(CLAIM_COLUMNS)
        .eq("publication_id", publicationId)
        .order("created_at", { ascending: false }),
    );
    return rows.map(toClaim);
  }

  async listClaimsByClaimant(claimantId: string): Promise<Claim[]> {
    const rows = unwrap<ClaimRow[]>(
      await getSupabase()
        .from("claims")
        .select(CLAIM_COLUMNS)
        .eq("claimant_id", claimantId)
        .order("created_at", { ascending: false }),
    );
    return rows.map(toClaim);
  }

  async listResponses(claimIds: string[]): Promise<ClaimResponse[]> {
    if (claimIds.length === 0) return [];

    const rows = unwrap<ResponseRow[]>(
      await getSupabase()
        .from("claim_responses")
        .select("claim_id, question_id, answer")
        .in("claim_id", claimIds),
    );
    if (rows.length === 0) return [];

    const questions = unwrap<Pick<QuestionRow, "id" | "question">[]>(
      await getSupabase()
        .from("verification_questions")
        .select("id, question")
        .in("id", [...new Set(rows.map((row) => row.question_id))]),
    );
    const textById = new Map(questions.map((question) => [question.id, question.question]));

    return rows.map((row) => ({
      claimId: row.claim_id,
      questionId: row.question_id,
      question: textById.get(row.question_id) ?? "",
      answer: row.answer,
    }));
  }

  async submitClaim(
    publicationId: string,
    claimantId: string,
    answers: ClaimAnswer[],
  ): Promise<string> {
    return unwrap<string>(
      await getSupabase().rpc("submit_claim", {
        p_publication_id: publicationId,
        p_claimant_id: claimantId,
        p_question_ids: answers.map((item) => item.questionId),
        p_answers: answers.map((item) => item.answer),
      }),
    );
  }

  async approveClaim(claimId: string, publisherId: string): Promise<string> {
    return unwrap<string>(
      await getSupabase().rpc("approve_claim", {
        p_claim_id: claimId,
        p_publisher_id: publisherId,
      }),
    );
  }

  async rejectIfPending(claimId: string): Promise<boolean> {
    const rows = unwrap<{ id: string }[]>(
      await getSupabase()
        .from("claims")
        .update({ status: "rejected" })
        .eq("id", claimId)
        .eq("status", "pending")
        .select("id"),
    );
    return rows.length > 0;
  }

  async cancelClaim(claimId: string, actorId: string): Promise<void> {
    unwrap(
      await getSupabase().rpc("cancel_claim", { p_claim_id: claimId, p_actor_id: actorId }),
    );
  }
}
