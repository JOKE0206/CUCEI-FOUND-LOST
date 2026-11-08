import { getSupabase } from "../../config/supabase";
import { unwrap } from "../../shared/utils/supabase-result";
import type { Category } from "./categories.entity";

export interface CategoriesRepository {
  listActive(): Promise<Category[]>;
}

export class SupabaseCategoriesRepository implements CategoriesRepository {
  async listActive(): Promise<Category[]> {
    return unwrap<Category[]>(
      await getSupabase()
        .from("categories")
        .select("id, name")
        .eq("is_active", true)
        .order("name", { ascending: true }),
    );
  }
}
