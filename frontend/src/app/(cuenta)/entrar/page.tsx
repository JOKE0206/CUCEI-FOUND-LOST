"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { Field, FormError } from "@/components/ui";
import { useAuth } from "@/lib/auth";
import { getSupabase, isSupabaseConfigured } from "@/lib/supabase";

// Aviso temprano para evitar un correo inútil. Quien autoriza es el backend.
const INSTITUTIONAL_EMAIL = /^[^\s@]+@(alumnos\.)?udg\.mx$/i;

export default function EntrarPage() {
  const { auth } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [fieldError, setFieldError] = useState<string>();
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [sentTo, setSentTo] = useState<string | null>(null);

  useEffect(() => {
    if (auth.status === "signed-in") router.replace("/");
  }, [auth.status, router]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    const address = email.trim();

    if (!INSTITUTIONAL_EMAIL.test(address)) {
      setFieldError("Ese correo no es de la UDG. Usa tu cuenta @alumnos.udg.mx o @udg.mx.");
      return;
    }

    const supabase = getSupabase();
    if (!supabase) return;

    setFieldError(undefined);
    setFormError(null);
    setBusy(true);
    const { error } = await supabase.auth.signInWithOtp({
      email: address,
      options: { emailRedirectTo: window.location.origin },
    });
    setBusy(false);

    if (error) {
      setFormError("No pudimos enviar el enlace. Espera un momento e inténtalo de nuevo.");
      return;
    }
    setSentTo(address);
  }

  return (
    <main className="mx-auto flex min-h-svh max-w-md flex-col justify-center px-5 py-10">
      <div className="tag" data-kind="found">
        <span aria-hidden="true" className="tag-hole" />
        <div className="px-6 pt-12 pb-7">
          <h1 className="object-title text-[3.25rem]">CUCEI Found &amp; Lost</h1>
          <p className="mt-3 text-lg font-medium">
            Reporta lo que perdiste o lo que encontraste en el campus.
          </p>
        </div>
      </div>

      {sentTo ? (
        <div className="mt-8" role="status">
          <h2 className="section-title">Revisa tu correo</h2>
          <p className="prose-body mt-1">
            Te enviamos un enlace a <strong className="font-semibold">{sentTo}</strong>. Ábrelo en este dispositivo para entrar.
          </p>
          <button type="button" className="btn-link mt-2" onClick={() => setSentTo(null)}>
            Usar otro correo
          </button>
        </div>
      ) : (
        <form onSubmit={submit} noValidate className="mt-8 space-y-4">
          <Field label="Correo institucional" error={fieldError}>
            {(props) => (
              <input
                {...props}
                className="control"
                type="email"
                name="email"
                autoComplete="email"
                autoCapitalize="none"
                autoCorrect="off"
                enterKeyHint="send"
                placeholder="nombre@alumnos.udg.mx"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
              />
            )}
          </Field>
          <FormError message={formError} />
          {!isSupabaseConfigured && <FormError message="El acceso todavía no está configurado en este entorno." />}
          <button type="submit" className="btn btn-primary w-full" disabled={busy || !isSupabaseConfigured}>
            {busy ? "Enviando enlace" : "Enviar enlace de acceso"}
          </button>
        </form>
      )}
    </main>
  );
}
