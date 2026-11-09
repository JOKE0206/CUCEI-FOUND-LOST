"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { ApiError } from "./api";
import { getSupabase, isSupabaseConfigured } from "./supabase";
import type { CurrentUser } from "./types";
import { useApi } from "./use-api";

export type AuthState =
  | { status: "loading" }
  | { status: "signed-out" }
  | { status: "error"; error: ApiError }
  | { status: "signed-in"; me: CurrentUser };

interface AuthContextValue {
  auth: AuthState;
  refresh: () => void;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  // undefined: la sesión guardada aún no se ha leído.
  const [userId, setUserId] = useState<string | null | undefined>(isSupabaseConfigured ? undefined : null);

  useEffect(() => {
    const supabase = getSupabase();
    if (!supabase) return;

    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      setUserId(session?.user.id ?? null);
    });
    return () => data.subscription.unsubscribe();
  }, []);

  const { data: me, error, reload } = useApi<CurrentUser>(userId ? "/auth/me" : null, userId ?? "");

  const signOut = useCallback(async () => {
    await getSupabase()?.auth.signOut();
  }, []);

  const auth = useMemo<AuthState>(() => {
    if (userId === undefined) return { status: "loading" };
    if (userId === null) return { status: "signed-out" };
    if (error?.status === 401) return { status: "signed-out" };
    if (error) return { status: "error", error };
    if (me) return { status: "signed-in", me };
    return { status: "loading" };
  }, [userId, me, error]);

  const value = useMemo(() => ({ auth, refresh: reload, signOut }), [auth, reload, signOut]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth debe usarse dentro de AuthProvider");
  return context;
}

// Dentro del área protegida el perfil siempre existe.
export function useCurrentProfile() {
  const { auth } = useAuth();
  if (auth.status !== "signed-in" || !auth.me.profile) {
    throw new Error("useCurrentProfile requiere un perfil activo");
  }
  return { ...auth.me.profile, email: auth.me.email };
}
