import { getSupabase } from "../../config/supabase";
import { unwrap } from "../../shared/utils/supabase-result";
import type { Campus, Location } from "./campuses.entity";

export interface CampusesRepository {
  listActive(): Promise<Campus[]>;
  isActive(campusId: string): Promise<boolean>;
  listActiveLocations(campusId: string): Promise<Location[]>;
}

interface CampusRow {
  id: string;
  name: string;
  code: string;
  email_domain: string | null;
}

interface LocationRow {
  id: string;
  campus_id: string;
  name: string;
}

export class SupabaseCampusesRepository implements CampusesRepository {
  async listActive(): Promise<Campus[]> {
    const rows = unwrap<CampusRow[]>(
      await getSupabase()
        .from("campuses")
        .select("id, name, code, email_domain")
        .eq("is_active", true)
        .order("name", { ascending: true }),
    );
    return rows.map((row) => ({
      id: row.id,
      name: row.name,
      code: row.code,
      emailDomain: row.email_domain,
    }));
  }

  async isActive(campusId: string): Promise<boolean> {
    const row = unwrap<{ id: string } | null>(
      await getSupabase()
        .from("campuses")
        .select("id")
        .eq("id", campusId)
        .eq("is_active", true)
        .maybeSingle(),
    );
    return row !== null;
  }

  async listActiveLocations(campusId: string): Promise<Location[]> {
    const rows = unwrap<LocationRow[]>(
      await getSupabase()
        .from("locations")
        .select("id, campus_id, name")
        .eq("campus_id", campusId)
        .eq("is_active", true)
        .order("name", { ascending: true }),
    );
    return rows.map((row) => ({ id: row.id, campusId: row.campus_id, name: row.name }));
  }
}
