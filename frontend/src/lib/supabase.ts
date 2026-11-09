import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();

// Los valores copiados tal cual de .env.example cuentan como no configurados.
const configured = Boolean(url && anonKey && !/^(https:\/\/)?tu-/.test(url) && !/^tu-/.test(anonKey));

export const supabaseConfig = configured ? { url: url as string, anonKey: anonKey as string } : null;

let client: SupabaseClient | null = null;

// El cliente SSR guarda sesión y verificador PKCE en cookies para que /auth/callback pueda leerlos.
export function getSupabase(): SupabaseClient | null {
  if (!supabaseConfig || typeof window === "undefined") return null;
  client ??= createBrowserClient(supabaseConfig.url, supabaseConfig.anonKey);
  return client;
}

export const isSupabaseConfigured = configured;

export const PHOTOS_BUCKET = "publication-photos";
