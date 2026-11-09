"use client";

import { useParams, useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { BackLink, ErrorState, Field, FormError, LoadingState } from "@/components/ui";
import { api, errorMessage } from "@/lib/api";
import type { Publication, VerificationQuestion } from "@/lib/types";
import { useApi } from "@/lib/use-api";

export default function ReclamarPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const publication = useApi<Publication>(`/publicaciones/${id}`);
  const questions = useApi<VerificationQuestion[]>(`/publicaciones/${id}/preguntas`);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [missing, setMissing] = useState<string[]>([]);
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const backHref = `/publicaciones/${id}`;
  const loadError = publication.error ?? questions.error;

  if (loadError) {
    return (
      <main className="mx-auto max-w-xl px-4 pt-5">
        <BackLink href={backHref} label="Volver" />
        <ErrorState message={loadError.message} />
      </main>
    );
  }

  if (!publication.data || !questions.data) {
    return (
      <main className="mx-auto max-w-xl px-4 pt-5">
        <LoadingState />
      </main>
    );
  }

  const list = questions.data;

  async function submit(event: FormEvent) {
    event.preventDefault();
    const unanswered = list.filter((question) => !answers[question.id]?.trim()).map((question) => question.id);
    setMissing(unanswered);
    if (unanswered.length > 0) return;

    setFormError(null);
    setBusy(true);
    try {
      await api(`/publicaciones/${id}/reclamaciones`, {
        method: "POST",
        body: { answers: list.map((question) => ({ questionId: question.id, answer: answers[question.id].trim() })) },
      });
      toast.success("Reclamación enviada");
      router.replace(backHref);
    } catch (caught) {
      setFormError(errorMessage(caught));
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto max-w-xl px-4 pt-[calc(0.5rem+env(safe-area-inset-top,0px))] lg:pt-6">
      <BackLink href={backHref} label="Volver" />
      <h1 className="page-title mt-2">Reclamar: {publication.data.title}</h1>
      <p className="prose-body mt-2">
        Quien publicó leerá tus respuestas y decidirá. Si te rechaza, no podrás volver a reclamar este objeto.
      </p>

      <form onSubmit={submit} noValidate className="mt-6 space-y-4">
        {list.length === 0 && <p className="prose-body">Esta publicación no tiene preguntas. Envía tu reclamación para avisar a quien publicó.</p>}
        {list.map((question) => (
          <Field key={question.id} label={question.question} error={missing.includes(question.id) ? "Responde esta pregunta." : undefined}>
            {(props) => (
              <textarea
                {...props}
                className="control"
                rows={2}
                maxLength={1000}
                value={answers[question.id] ?? ""}
                onChange={(event) => setAnswers({ ...answers, [question.id]: event.target.value })}
              />
            )}
          </Field>
        ))}
        <FormError message={formError} />
        <button type="submit" className="btn btn-primary w-full" disabled={busy}>
          {busy ? "Enviando" : "Enviar reclamación"}
        </button>
      </form>
    </main>
  );
}
