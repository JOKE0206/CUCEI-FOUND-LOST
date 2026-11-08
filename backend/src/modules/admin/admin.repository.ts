import { getSupabase } from "../../config/supabase";
import { unwrap } from "../../shared/utils/supabase-result";
import type { ReportedPublication } from "./admin.entity";

export interface AdminRepository {
  findPublications(ids: string[]): Promise<ReportedPublication[]>;
  moderatePublication(id: string, status: "removed" | "suspended"): Promise<void>;
  reactivateIfSuspended(id: string): Promise<boolean>;
}

interface ReportedPublicationRow {
  id: string;
  user_id: string;
  title: string;
  description: string;
  status: ReportedPublication["status"];
}

export class SupabaseAdminRepository implements AdminRepository {
  async findPublications(ids: string[]): Promise<ReportedPublication[]> {
    if (ids.length === 0) return [];

    const rows = unwrap<ReportedPublicationRow[]>(
      await getSupabase()
        .from("publications")
        .select("id, user_id, title, description, status")
        .in("id", ids),
    );
    return rows.map((row) => ({
      id: row.id,
      userId: row.user_id,
      title: row.title,
      description: row.description,
      status: row.status,
    }));
  }

  async moderatePublication(id: string, status: "removed" | "suspended"): Promise<void> {
    unwrap(
      await getSupabase().rpc("moderate_publication", {
        p_publication_id: id,
        p_status: status,
      }),
    );
  }

  async reactivateIfSuspended(id: string): Promise<boolean> {
    const rows = unwrap<{ id: string }[]>(
      await getSupabase()
        .from("publications")
        .update({ status: "active" })
        .eq("id", id)
        .eq("status", "suspended")
        .select("id"),
    );
    return rows.length > 0;
  }
}
