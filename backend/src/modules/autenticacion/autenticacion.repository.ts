import { getSupabase } from "../../config/supabase";
import type { SessionUser } from "../../shared/middlewares/auth.middleware";
import { unwrap } from "../../shared/utils/supabase-result";
import type { NewProfile, PublicProfile, UserProfile } from "./autenticacion.entity";

export interface PublicProfileReader {
  findPublicProfiles(ids: string[]): Promise<PublicProfile[]>;
}

export interface AutenticacionRepository extends PublicProfileReader {
  findSessionUser(token: string): Promise<SessionUser | null>;
  findProfile(id: string): Promise<UserProfile | null>;
  createProfile(profile: NewProfile): Promise<UserProfile>;
}

interface UserRow {
  id: string;
  display_name: string;
  campus_id: string | null;
  role: UserProfile["role"];
  status: UserProfile["status"];
  created_at: string;
}

const USER_COLUMNS = "id, display_name, campus_id, role, status, created_at";

function toProfile(row: UserRow): UserProfile {
  return {
    id: row.id,
    displayName: row.display_name,
    campusId: row.campus_id,
    role: row.role,
    status: row.status,
    createdAt: row.created_at,
  };
}

export class SupabaseAutenticacionRepository implements AutenticacionRepository {
  async findSessionUser(token: string): Promise<SessionUser | null> {
    const { data, error } = await getSupabase().auth.getUser(token);

    if (error) {
      // Un token rechazado es un 401; una caída del servicio no debe parecerlo.
      if (error.status && error.status >= 400 && error.status < 500) return null;
      throw new Error(`Error de Supabase Auth: ${error.message}`);
    }

    return {
      id: data.user.id,
      email: data.user.email ?? null,
      emailConfirmed: Boolean(data.user.email_confirmed_at),
    };
  }

  async findProfile(id: string): Promise<UserProfile | null> {
    const row = unwrap<UserRow | null>(
      await getSupabase().from("users").select(USER_COLUMNS).eq("id", id).maybeSingle(),
    );
    return row ? toProfile(row) : null;
  }

  async createProfile(profile: NewProfile): Promise<UserProfile> {
    const row = unwrap<UserRow>(
      await getSupabase()
        .from("users")
        .insert({
          id: profile.id,
          display_name: profile.displayName,
          campus_id: profile.campusId,
        })
        .select(USER_COLUMNS)
        .single(),
    );
    return toProfile(row);
  }

  async findPublicProfiles(ids: string[]): Promise<PublicProfile[]> {
    if (ids.length === 0) return [];

    const rows = unwrap<Pick<UserRow, "id" | "display_name">[]>(
      await getSupabase().from("users").select("id, display_name").in("id", ids),
    );
    return rows.map((row) => ({ id: row.id, displayName: row.display_name }));
  }
}
