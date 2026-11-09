"use client";

import { type ChangeEvent } from "react";
import { MAX_PHOTOS, PHOTO_TYPES } from "@/lib/photos";

export function PhotoAddButton({
  count,
  onFiles,
  disabled = false,
}: {
  count: number;
  onFiles: (files: File[]) => void;
  disabled?: boolean;
}) {
  function change(event: ChangeEvent<HTMLInputElement>) {
    onFiles(Array.from(event.target.files ?? []));
    // Permite volver a elegir el mismo archivo después de quitarlo.
    event.target.value = "";
  }

  if (count >= MAX_PHOTOS) return <p className="muted">Ya tienes las {MAX_PHOTOS} fotos permitidas.</p>;

  return (
    <label className={`btn btn-secondary w-full cursor-pointer has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-manila ${disabled ? "opacity-55" : ""}`}>
      Agregar fotos
      <input
        type="file"
        accept={PHOTO_TYPES.join(",")}
        multiple
        className="sr-only"
        disabled={disabled}
        onChange={change}
      />
    </label>
  );
}
