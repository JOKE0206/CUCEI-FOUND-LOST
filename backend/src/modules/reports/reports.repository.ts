import { getSupabase } from "../../config/supabase";
import { unwrap } from "../../shared/utils/supabase-result";
import type {
  NewReport,
  Report,
  ReportDecision,
  ReportFilters,
  ReportTarget,
} from "./reports.entity";

export interface ReportsRepository {
  create(report: NewReport): Promise<Report>;
  hasOpenReport(reporterId: string, target: ReportTarget): Promise<boolean>;
  hasOpenReportsOnPublication(publicationId: string): Promise<boolean>;
  findById(id: string): Promise<Report | null>;
  list(filters: ReportFilters): Promise<{ items: Report[]; total: number }>;
  closeIfOpen(id: string, reviewerId: string, decision: ReportDecision): Promise<Report | null>;
}

interface ReportRow {
  id: string;
  reporter_id: string;
  target_publication_id: string | null;
  target_user_id: string | null;
  reason: string;
  status: Report["status"];
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
}

const REPORT_COLUMNS =
  "id, reporter_id, target_publication_id, target_user_id, reason, status, reviewed_by, reviewed_at, created_at";
const OPEN_STATUSES = ["pending", "reviewing"];

function toReport(row: ReportRow): Report {
  return {
    id: row.id,
    reporterId: row.reporter_id,
    targetPublicationId: row.target_publication_id,
    targetUserId: row.target_user_id,
    reason: row.reason,
    status: row.status,
    reviewedBy: row.reviewed_by,
    reviewedAt: row.reviewed_at,
    createdAt: row.created_at,
  };
}

export class SupabaseReportsRepository implements ReportsRepository {
  async create(report: NewReport): Promise<Report> {
    const row = unwrap<ReportRow>(
      await getSupabase()
        .from("reports")
        .insert({
          reporter_id: report.reporterId,
          target_publication_id: report.targetPublicationId,
          target_user_id: report.targetUserId,
          reason: report.reason,
        })
        .select(REPORT_COLUMNS)
        .single(),
    );
    return toReport(row);
  }

  async hasOpenReport(reporterId: string, target: ReportTarget): Promise<boolean> {
    let query = getSupabase()
      .from("reports")
      .select("id")
      .eq("reporter_id", reporterId)
      .in("status", OPEN_STATUSES);

    query = target.targetPublicationId
      ? query.eq("target_publication_id", target.targetPublicationId)
      : query.eq("target_user_id", target.targetUserId as string);

    return unwrap<{ id: string }[]>(await query.limit(1)).length > 0;
  }

  async hasOpenReportsOnPublication(publicationId: string): Promise<boolean> {
    const rows = unwrap<{ id: string }[]>(
      await getSupabase()
        .from("reports")
        .select("id")
        .eq("target_publication_id", publicationId)
        .in("status", OPEN_STATUSES)
        .limit(1),
    );
    return rows.length > 0;
  }

  async findById(id: string): Promise<Report | null> {
    const row = unwrap<ReportRow | null>(
      await getSupabase().from("reports").select(REPORT_COLUMNS).eq("id", id).maybeSingle(),
    );
    return row ? toReport(row) : null;
  }

  async list(filters: ReportFilters): Promise<{ items: Report[]; total: number }> {
    const start = (filters.page - 1) * filters.pageSize;
    let query = getSupabase().from("reports").select(REPORT_COLUMNS, { count: "exact" });
    if (filters.status) query = query.eq("status", filters.status);

    const result = await query
      .order("created_at", { ascending: false })
      .range(start, start + filters.pageSize - 1);

    return {
      items: unwrap<ReportRow[]>(result).map(toReport),
      total: result.count ?? 0,
    };
  }

  async closeIfOpen(
    id: string,
    reviewerId: string,
    decision: ReportDecision,
  ): Promise<Report | null> {
    const row = unwrap<ReportRow | null>(
      await getSupabase()
        .from("reports")
        .update({
          status: decision,
          reviewed_by: reviewerId,
          reviewed_at: new Date().toISOString(),
        })
        .eq("id", id)
        .in("status", OPEN_STATUSES)
        .select(REPORT_COLUMNS)
        .maybeSingle(),
    );
    return row ? toReport(row) : null;
  }
}
