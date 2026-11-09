"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { CloseIcon } from "@/components/icons";
import { PhotoAddButton } from "@/components/photo-input";
import { ObjectFields, validateObject, type ObjectErrors, type ObjectValues } from "@/components/publication-fields";
import { cleanQuestions, questionsProblem, QuestionsEditor } from "@/components/questions-editor";
import { FormError } from "@/components/ui";
import { api, ApiError, errorMessage } from "@/lib/api";
import { useCurrentProfile } from "@/lib/auth";
import { useCatalog } from "@/lib/catalog";
import { localToday } from "@/lib/format";
import { MAX_PHOTOS, photoProblem, uploadPhoto } from "@/lib/photos";
import type { Publication } from "@/lib/types";

interface PickedPhoto {
  id: string;
  file: File;
  url: string;
}

const STEPS = ["El objeto", "Fotos", "Preguntas"];

export default function PublicarPage() {
  const router = useRouter();
  const profile = useCurrentProfile();
  const { campuses } = useCatalog();
  const [step, setStep] = useState(0);
  const [values, setValues] = useState<ObjectValues>(() => ({
    type: "found",
    title: "",
    description: "",
    categoryId: "",
    campusId: profile.campusId ?? "",
    locationId: "",
    eventDate: localToday(),
  }));
  const [errors, setErrors] = useState<ObjectErrors>({});
  const [photos, setPhotos] = useState<PickedPhoto[]>([]);
  const [questions, setQuestions] = useState<string[]>([""]);
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const headingRef = useRef<HTMLHeadingElement>(null);
  const previews = useRef<PickedPhoto[]>([]);

  useEffect(() => {
    previews.current = photos;
  }, [photos]);

  // Libera las vistas previas al salir de la pantalla.
  useEffect(() => () => previews.current.forEach((photo) => URL.revokeObjectURL(photo.url)), []);

  // Con un solo campus no hay nada que elegir.
  const effectiveValues = { ...values, campusId: values.campusId || (campuses.length === 1 ? campuses[0].id : "") };

  function goTo(next: number) {
    setStep(next);
    setFormError(null);
    window.scrollTo({ top: 0 });
    headingRef.current?.focus({ preventScroll: true });
  }

  function continueFromObject() {
    const problems = validateObject(effectiveValues);
    setErrors(problems);
    if (Object.keys(problems).length === 0) goTo(1);
  }

  function addFiles(files: File[]) {
    const accepted: PickedPhoto[] = [];
    for (const file of files) {
      const problem = photoProblem(file);
      if (problem) toast.error(problem);
      else accepted.push({ id: crypto.randomUUID(), file, url: URL.createObjectURL(file) });
    }

    const room = MAX_PHOTOS - photos.length;
    if (accepted.length > room) toast.error(`Solo puedes subir ${MAX_PHOTOS} fotos.`);
    accepted.slice(room).forEach((photo) => URL.revokeObjectURL(photo.url));
    setPhotos([...photos, ...accepted.slice(0, room)]);
  }

  function removePhoto(photo: PickedPhoto) {
    URL.revokeObjectURL(photo.url);
    setPhotos(photos.filter((item) => item.id !== photo.id));
  }

  async function publish(event: FormEvent) {
    event.preventDefault();
    const problem = questionsProblem(effectiveValues.type, questions);
    if (problem) {
      setFormError(problem);
      return;
    }

    setFormError(null);
    setBusy("Publicando");

    let created: Publication;
    try {
      created = await api<Publication>("/publicaciones", {
        method: "POST",
        body: {
          type: effectiveValues.type,
          title: effectiveValues.title.trim(),
          description: effectiveValues.description.trim(),
          categoryId: effectiveValues.categoryId,
          campusId: effectiveValues.campusId,
          locationId: effectiveValues.locationId || null,
          eventDate: effectiveValues.eventDate,
          questions: cleanQuestions(questions),
        },
      });
    } catch (caught) {
      setBusy(null);
      setFormError(caught instanceof ApiError ? caught.message : errorMessage(caught));
      return;
    }

    let failed = 0;
    for (const [index, photo] of photos.entries()) {
      setBusy(`Subiendo foto ${index + 1} de ${photos.length}`);
      try {
        await uploadPhoto(created.id, photo.file);
      } catch {
        failed += 1;
      }
    }

    if (failed > 0) {
      toast.error(`Se publicó el objeto, pero ${failed === 1 ? "una foto no se subió" : `${failed} fotos no se subieron`}. Agrégalas desde Editar.`);
    } else {
      toast.success("Objeto publicado");
    }
    router.replace(`/publicaciones/${created.id}`);
  }

  const isFound = effectiveValues.type === "found";

  return (
    <main className="mx-auto max-w-xl px-4 pt-[calc(1.25rem+env(safe-area-inset-top,0px))] lg:pt-8">
      <p className="muted font-medium">
        Paso {step + 1} de {STEPS.length}
      </p>
      <h1 ref={headingRef} tabIndex={-1} className="page-title outline-none">
        {STEPS[step]}
      </h1>

      <div className="mt-6">
        {step === 0 && (
          <div className="space-y-6">
            <ObjectFields
              values={effectiveValues}
              errors={errors}
              onChange={(changes) => setValues({ ...effectiveValues, ...changes })}
            />
            <button type="button" className="btn btn-primary w-full" onClick={continueFromObject}>
              Continuar
            </button>
          </div>
        )}

        {step === 1 && (
          <div className="space-y-5">
            <p className="prose-body">
              {isFound
                ? "No muestres lo que vas a preguntar. Si la foto revela la respuesta, cualquiera podría reclamarlo."
                : "Si tienes una foto del objeto, ayudará a reconocerlo."}{" "}
              <span className="muted">Hasta {MAX_PHOTOS} fotos JPEG, PNG o WebP, de 5 MB como máximo.</span>
            </p>

            {photos.length > 0 && (
              <ul className="grid grid-cols-3 gap-2">
                {photos.map((photo, index) => (
                  <li key={photo.id} className="relative aspect-square overflow-hidden rounded-lg bg-superficie">
                    <Image src={photo.url} alt={`Foto ${index + 1}`} fill unoptimized className="object-cover" />
                    <button
                      type="button"
                      aria-label={`Quitar foto ${index + 1}`}
                      className="absolute top-1 right-1 flex h-11 w-11 items-center justify-center rounded-full bg-pizarron text-gis"
                      onClick={() => removePhoto(photo)}
                    >
                      <CloseIcon width={18} height={18} />
                    </button>
                  </li>
                ))}
              </ul>
            )}

            <PhotoAddButton count={photos.length} onFiles={addFiles} />

            <div className="flex gap-3">
              <button type="button" className="btn btn-secondary flex-1" onClick={() => goTo(0)}>
                Atrás
              </button>
              <button type="button" className="btn btn-primary flex-1" onClick={() => goTo(2)}>
                Continuar
              </button>
            </div>
          </div>
        )}

        {step === 2 && (
          <form onSubmit={publish} noValidate className="space-y-5">
            <p className="prose-body">
              {isFound
                ? "Pregunta algo que solo el dueño sabría. Tú revisas las respuestas antes de entregar el objeto."
                : "Son opcionales. Sirven para confirmar a quien diga tener tu objeto."}
            </p>
            <QuestionsEditor questions={questions} onChange={setQuestions} />
            <FormError message={formError} />
            <div className="flex gap-3">
              <button type="button" className="btn btn-secondary flex-1" disabled={busy !== null} onClick={() => goTo(1)}>
                Atrás
              </button>
              <button type="submit" className="btn btn-primary flex-1" disabled={busy !== null}>
                {busy ?? "Publicar objeto"}
              </button>
            </div>
          </form>
        )}
      </div>
    </main>
  );
}
