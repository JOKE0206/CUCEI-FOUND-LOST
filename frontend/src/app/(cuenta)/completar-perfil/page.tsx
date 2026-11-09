"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { Field, FormError, LoadingState } from "@/components/ui";
import { api, ApiError, errorMessage } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import type { Campus } from "@/lib/types";
import { useApi } from "@/lib/use-api";

export default function CompletarPerfilPage() {
  const { auth, refresh, signOut } = useAuth();
  const router = useRouter();
  const signedIn = auth.status === "signed-in";
  const campuses = useApi<Campus[]>(signedIn ? "/campuses" : null);
  const [displayName, setDisplayName] = useState("");
  const [selectedCampus, setSelectedCampus] = useState<string | null>(null);
  const [nameError, setNameError] = useState<string>();
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const campusId = selectedCampus ?? campuses.data?.[0]?.id ?? "";

  useEffect(() => {
    if (auth.status === "signed-out") router.replace("/entrar");
    if (auth.status === "signed-in" && auth.me.profile) router.replace("/");
  }, [auth, router]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    const name = displayName.trim();
    if (!name) {
      setNameError("Escribe cómo quieres que te vean.");
      return;
    }

    setNameError(undefined);
    setFormError(null);
    setBusy(true);
    try {
      await api("/auth/perfil", {
        method: "POST",
        body: { displayName: name, campusId: campusId || null },
      });
      refresh();
    } catch (caught) {
      const profileExists = caught instanceof ApiError && caught.code === "PERFIL_EXISTENTE";
      if (profileExists) refresh();
      else setFormError(errorMessage(caught));
    } finally {
      setBusy(false);
    }
  }

  if (auth.status !== "signed-in" || auth.me.profile) {
    return (
      <main className="mx-auto max-w-md px-5 py-10">
        <LoadingState label="Abriendo tu cuenta" />
      </main>
    );
  }

  return (
    <main className="mx-auto flex min-h-svh max-w-md flex-col justify-center px-5 py-10">
      <h1 className="page-title">Completa tu perfil</h1>
      <p className="muted mt-1">Tu correo no se muestra. Los demás solo verán tu nombre.</p>

      <form onSubmit={submit} noValidate className="mt-6 space-y-4">
        <Field label="Nombre visible" error={nameError}>
          {(props) => (
            <input
              {...props}
              className="control"
              name="displayName"
              autoComplete="given-name"
              maxLength={80}
              value={displayName}
              onChange={(event) => setDisplayName(event.target.value)}
            />
          )}
        </Field>

        <Field label="Campus">
          {(props) => (
            <select
              {...props}
              className="control"
              value={campusId}
              disabled={!campuses.data}
              onChange={(event) => setSelectedCampus(event.target.value)}
            >
              {campuses.data?.map((campus) => (
                <option key={campus.id} value={campus.id}>
                  {campus.name}
                </option>
              ))}
            </select>
          )}
        </Field>

        <FormError message={formError ?? campuses.error?.message} />
        <button type="submit" className="btn btn-primary w-full" disabled={busy}>
          {busy ? "Guardando" : "Guardar perfil"}
        </button>
      </form>

      <button type="button" className="btn-link mt-3 self-start" onClick={signOut}>
        Cerrar sesión
      </button>
    </main>
  );
}
