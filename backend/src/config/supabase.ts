import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { env } from "./env";

let client: SupabaseClient | undefined;

// El cliente se crea al primer uso para que el servidor pueda iniciar
// aunque Supabase todavía no esté configurado.
export function getSupabase(): SupabaseClient {
  if (!env.supabaseUrl || !env.supabaseServiceRoleKey) {
    throw new Error(
      "Supabase no está configurado: define SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY en backend/.env",
    );
  }

  client ??= createClient(env.supabaseUrl, env.supabaseServiceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  return client;
}
