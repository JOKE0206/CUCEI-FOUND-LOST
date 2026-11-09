import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse, type NextRequest } from "next/server";
import { supabaseConfig } from "@/lib/supabase";

// Destino del enlace de acceso: cambia el código por una sesión guardada en cookies.
// La ruta principal decide después si falta completar el perfil.
export async function GET(request: NextRequest) {
  const { origin, searchParams } = request.nextUrl;
  const code = searchParams.get("code");

  if (code && supabaseConfig) {
    const cookieStore = await cookies();
    const supabase = createServerClient(supabaseConfig.url, supabaseConfig.anonKey, {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (cookiesToSet) => {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        },
      },
    });

    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(new URL("/", origin));
  }

  return NextResponse.redirect(new URL("/entrar?error=enlace", origin));
}
