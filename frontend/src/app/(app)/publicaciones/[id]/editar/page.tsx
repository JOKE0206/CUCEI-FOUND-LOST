"use client";

import Image from "next/image";
import { useParams, useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { CloseIcon } from "@/components/icons";
import { PhotoAddButton } from "@/components/photo-input";
import { ObjectFields, validateObject, type ObjectErrors, type ObjectValues } from "@/components/publication-fields";
import { cleanQuestions, questionsProblem, QuestionsEditor } from "@/components/questions-editor";
import { BackLink, ErrorState, FormError, LoadingState } from "@/components/ui";
import { api, errorMessage } from "@/lib/api";
import { useCurrentProfile } from "@/lib/auth";
import { MAX_PHOTOS, photoProblem, uploadPhoto } from "@/lib/photos";
import type { Claim, Publication, VerificationQuestion } from "@/lib/types";
import { useApi } from "@/lib/use-api";

function Photos({ publication, onChanged }: { publication: Publication; onChanged: () => void }) {
  const [busy, setBusy] = useState(false);

  async function add(files: File[]) {
    const room = MAX_PHOTOS - publication.photos.length;
    const valid = files.filter((file) => {
      const problem = photoProblem(file);
      if (problem) toast.error(problem);
      return !problem;
    });
    if (valid.length > room) toast.error(`Solo puedes tener ${MAX_PHOTOS} fotos.`);

    setBusy(true);
    let failed = 0;
    for (const file of valid.slice(0, room)) {
      try {
        await uploadPhoto(publication.id, file);
      } catch {
        failed += 1;
      }
    }
    setBusy(false);
    if (failed > 0) toast.error(failed === 1 ? "Una foto no se subió." : `${failed} fotos no se subieron.`);
    onChanged();
  }

  async function remove(photoId: string) {
    try {
      await api(`/publicaciones/${publication.id}/fotos/${photoId}`, { method: "DELETE" });
      onChanged();
    } catch (caught) {
      toast.error(errorMessage(caught));
    }
  }

  return (
    <section aria-labelledby="fotos" className="space-y-3">
      <h2 id="fotos" className="section-title">Fotos</h2>
      {publication.type === "found" && (
        <p className="prose-body">No muestres lo que vas a preguntar.</p>
      )}
      {publication.photos.length > 0 && (
        <ul className="grid grid-cols-3 gap-2">
          {publication.photos.map((photo, index) => (
            <li key={photo.id} className="relative aspect-square overflow-hidden rounded-lg bg-superficie">
              <Image src={photo.url} alt={`Foto ${index + 1}`} fill unoptimized className="object-cover" />
              <button
                type="button"
                aria-label={`Borrar foto ${index + 1}`}
                className="absolute top-1 right-1 flex h-11 w-11 items-center justify-center rounded-full bg-pizarron text-gis"
                onClick={() => remove(photo.id)}
              >
                <CloseIcon width={18} height={18} />
              </button>
            </li>
          ))}
        </ul>
      )}
      <PhotoAddButton count={publication.photos.length} onFiles={add} disabled={busy} />
      {busy && <p role="status" className="muted">Subiendo fotos</p>}
    </section>
  );
}

function Questions({
  publication,
  initial,
  locked,
}: {
  publication: Publication;
  initial: VerificationQuestion[];
  locked: boolean;
}) {
  const [questions, setQuestions] = useState(initial.length > 0 ? initial.map((item) => item.question) : [""]);
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function save() {
    const problem = questionsProblem(publication.type, questions);
    setFormError(problem);
    if (problem) return;

    setBusy(true);
    try {
      await api(`/publicaciones/${publication.id}/preguntas`, {
        method: "PUT",
        body: { questions: cleanQuestions(questions) },
      });
      toast.success("Preguntas guardadas");
    } catch (caught) {
      setFormError(errorMessage(caught));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section aria-labelledby="preguntas" className="space-y-3">
      <h2 id="preguntas" className="section-title">Preguntas de verificación</h2>
      {locked && <p className="prose-body">Ya hay reclamaciones, así que las preguntas no se pueden cambiar.</p>}
      <QuestionsEditor questions={questions} onChange={setQuestions} disabled={locked} />
      <FormError message={formError} />
      {!locked && (
        <button type="button" className="btn btn-secondary w-full" disabled={busy} onClick={save}>
          {busy ? "Guardando" : "Guardar preguntas"}
        </button>
      )}
    </section>
  );
}

function ObjectForm({ publication }: { publication: Publication }) {
  const router = useRouter();
  const [values, setValues] = useState<ObjectValues>({
    type: publication.type,
    title: publication.title,
    description: publication.description,
    categoryId: publication.categoryId,
    campusId: publication.campusId,
    locationId: publication.locationId ?? "",
    eventDate: publication.eventDate,
  });
  const [errors, setErrors] = useState<ObjectErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    const problems = validateObject(values);
    setErrors(problems);
    if (Object.keys(problems).length > 0) return;

    setFormError(null);
    setBusy(true);
    try {
      await api(`/publicaciones/${publication.id}`, {
        method: "PATCH",
        body: {
          title: values.title.trim(),
          description: values.description.trim(),
          categoryId: values.categoryId,
          locationId: values.locationId || null,
          eventDate: values.eventDate,
        },
      });
      toast.success("Cambios guardados");
      router.replace(`/publicaciones/${publication.id}`);
    } catch (caught) {
      setFormError(errorMessage(caught));
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} noValidate className="space-y-4">
      <ObjectFields fixedOrigin values={values} errors={errors} onChange={(changes) => setValues({ ...values, ...changes })} />
      <FormError message={formError} />
      <button type="submit" className="btn btn-primary w-full" disabled={busy}>
        {busy ? "Guardando" : "Guardar cambios"}
      </button>
    </form>
  );
}

export default function EditarPage() {
  const { id } = useParams<{ id: string }>();
  const profile = useCurrentProfile();
  const publication = useApi<Publication>(`/publicaciones/${id}`);
  const questions = useApi<VerificationQuestion[]>(`/publicaciones/${id}/preguntas`);
  const claims = useApi<Claim[]>(`/publicaciones/${id}/reclamaciones`);

  const backHref = `/publicaciones/${id}`;
  const loadError = publication.error ?? questions.error ?? claims.error;
  const item = publication.data;

  return (
    <main className="mx-auto max-w-xl px-4 pt-[calc(0.5rem+env(safe-area-inset-top,0px))] lg:pt-6">
      <BackLink href={backHref} label="Volver a la publicación" />

      {loadError && !item ? (
        <ErrorState message={loadError.message} />
      ) : !item || !questions.data || !claims.data ? (
        <LoadingState />
      ) : item.userId !== profile.id || item.status !== "active" ? (
        <ErrorState message="Solo puedes editar tus publicaciones que sigan disponibles." />
      ) : (
        <div className="space-y-9">
          <div>
            <h1 className="page-title mt-2 mb-5">Editar publicación</h1>
            <ObjectForm publication={item} />
          </div>
          <Photos publication={item} onChanged={publication.reload} />
          <Questions publication={item} initial={questions.data} locked={claims.data.length > 0} />
        </div>
      )}
    </main>
  );
}
