"use client";

import { useState } from "react";
import { Field } from "./ui";
import { useCatalog } from "@/lib/catalog";
import { localToday } from "@/lib/format";
import type { PublicationType } from "@/lib/types";

export interface ObjectValues {
  type: PublicationType;
  title: string;
  description: string;
  categoryId: string;
  campusId: string;
  locationId: string;
  eventDate: string;
}

export type ObjectErrors = Partial<Record<keyof ObjectValues, string>>;

export function validateObject(values: ObjectValues): ObjectErrors {
  const errors: ObjectErrors = {};
  const title = values.title.trim();

  if (title.length < 3) errors.title = "Escribe qué objeto es, con al menos 3 caracteres.";
  if (!values.description.trim()) errors.description = "Describe el objeto y dónde estaba.";
  if (!values.categoryId) errors.categoryId = "Elige una categoría.";
  if (!values.campusId) errors.campusId = "Elige un campus.";
  if (!values.eventDate) errors.eventDate = "Indica la fecha.";
  return errors;
}

// Campos del objeto, compartidos por publicar y editar.
export function ObjectFields({
  values,
  errors,
  onChange,
  fixedOrigin = false,
}: {
  values: ObjectValues;
  errors: ObjectErrors;
  onChange: (changes: Partial<ObjectValues>) => void;
  /** Al editar, el backend no permite cambiar el tipo ni el campus. */
  fixedOrigin?: boolean;
}) {
  const { campuses, categories, locationsOf } = useCatalog();
  const [today] = useState(localToday);
  const locations = values.campusId ? locationsOf(values.campusId) : [];
  const verb = values.type === "found" ? "encontraste" : "perdiste";

  return (
    <div className="space-y-4">
      {!fixedOrigin && (
        <fieldset>
          <legend className="mb-1.5 font-semibold">¿Qué pasó?</legend>
          <div className="grid gap-2 sm:grid-cols-2">
            {(
              [
                ["found", "Encontré algo"],
                ["lost", "Perdí algo"],
              ] as const
            ).map(([type, label]) => (
              <label key={type} className="choice">
                <input
                  type="radio"
                  name="type"
                  checked={values.type === type}
                  onChange={() => onChange({ type })}
                />
                {label}
              </label>
            ))}
          </div>
        </fieldset>
      )}

      <Field label="Objeto" hint="Por ejemplo: Cartera negra" error={errors.title}>
        {(props) => (
          <input
            {...props}
            className="control"
            maxLength={120}
            value={values.title}
            onChange={(event) => onChange({ title: event.target.value })}
          />
        )}
      </Field>

      <Field label="Descripción" error={errors.description}>
        {(props) => (
          <textarea
            {...props}
            className="control"
            rows={4}
            maxLength={2000}
            value={values.description}
            onChange={(event) => onChange({ description: event.target.value })}
          />
        )}
      </Field>

      <Field label="Categoría" error={errors.categoryId}>
        {(props) => (
          <select
            {...props}
            className="control"
            value={values.categoryId}
            onChange={(event) => onChange({ categoryId: event.target.value })}
          >
            <option value="">Elige una categoría</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
        )}
      </Field>

      {!fixedOrigin && (
        <Field label="Campus" error={errors.campusId}>
          {(props) => (
            <select
              {...props}
              className="control"
              value={values.campusId}
              onChange={(event) => onChange({ campusId: event.target.value, locationId: "" })}
            >
              <option value="">Elige un campus</option>
              {campuses.map((campus) => (
                <option key={campus.id} value={campus.id}>
                  {campus.name}
                </option>
              ))}
            </select>
          )}
        </Field>
      )}

      {locations.length > 0 && (
        <Field label="Ubicación (opcional)">
          {(props) => (
            <select
              {...props}
              className="control"
              value={values.locationId}
              onChange={(event) => onChange({ locationId: event.target.value })}
            >
              <option value="">Sin especificar</option>
              {locations.map((location) => (
                <option key={location.id} value={location.id}>
                  {location.name}
                </option>
              ))}
            </select>
          )}
        </Field>
      )}

      <Field label={`¿Cuándo lo ${verb}?`} error={errors.eventDate}>
        {(props) => (
          <input
            {...props}
            className="control"
            type="date"
            max={today}
            value={values.eventDate}
            onChange={(event) => onChange({ eventDate: event.target.value })}
          />
        )}
      </Field>
    </div>
  );
}
