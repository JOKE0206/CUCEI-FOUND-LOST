"use client";

import { CloseIcon } from "./icons";
import { Field } from "./ui";
import type { PublicationType } from "@/lib/types";

const MAX_QUESTIONS = 5;

export function questionsProblem(type: PublicationType, questions: string[]): string | null {
  const cleaned = questions.map((question) => question.trim()).filter(Boolean);

  if (type === "found" && cleaned.length === 0) return "Escribe al menos una pregunta para verificar a quien reclame.";
  if (cleaned.some((question) => question.length < 3)) return "Cada pregunta debe tener al menos 3 caracteres.";
  if (new Set(cleaned.map((question) => question.toLowerCase())).size !== cleaned.length) {
    return "Las preguntas no pueden repetirse.";
  }
  return null;
}

export function cleanQuestions(questions: string[]): string[] {
  return questions.map((question) => question.trim()).filter(Boolean);
}

export function QuestionsEditor({
  questions,
  onChange,
  disabled = false,
}: {
  questions: string[];
  onChange: (questions: string[]) => void;
  disabled?: boolean;
}) {
  function update(index: number, value: string) {
    onChange(questions.map((question, position) => (position === index ? value : question)));
  }

  return (
    <div className="space-y-3">
      {questions.map((question, index) => (
        <div key={index} className="flex items-end gap-2">
          <div className="min-w-0 flex-1">
            <Field label={`Pregunta ${index + 1}`}>
              {(props) => (
                <input
                  {...props}
                  className="control"
                  maxLength={300}
                  disabled={disabled}
                  value={question}
                  onChange={(event) => update(index, event.target.value)}
                />
              )}
            </Field>
          </div>
          {questions.length > 1 && !disabled && (
            <button
              type="button"
              aria-label={`Quitar pregunta ${index + 1}`}
              className="btn btn-secondary px-3"
              onClick={() => onChange(questions.filter((_, position) => position !== index))}
            >
              <CloseIcon width={20} height={20} />
            </button>
          )}
        </div>
      ))}
      {questions.length < MAX_QUESTIONS && !disabled && (
        <button type="button" className="btn-link" onClick={() => onChange([...questions, ""])}>
          Agregar otra pregunta
        </button>
      )}
    </div>
  );
}
