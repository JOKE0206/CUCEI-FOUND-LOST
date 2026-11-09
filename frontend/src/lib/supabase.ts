import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();

// Los valores copiados tal cual de .env.example cuentan como no configurados.
const configured = Boolean(url && anonKey && !/^(https:\/\/)?tu-/.test(url) && !/^tu-/.test(anonKey));

let client: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient | null {
  if (!configured || typeof window === "undefined") return null;
  client ??= createClient(url as string, anonKey as string);
  return client;
}

export const isSupabaseConfigured = configured;

export const PHOTOS_BUCKET = "publication-photos";
