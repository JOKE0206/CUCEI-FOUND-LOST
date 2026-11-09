"use client";

import Link from "next/link";
import { useId, type ReactNode } from "react";
import { BackIcon } from "./icons";

export interface FieldControlProps {
  id: string;
  "aria-describedby"?: string;
  "aria-invalid"?: boolean;
}

export function Field({
  label,
  hint,
  error,
  children,
}: {
  label: string;
  hint?: string;
  error?: string;
  children: (props: FieldControlProps) => ReactNode;
}) {
  const id = useId();
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;
  const describedBy = [hint ? hintId : null, error ? errorId : null].filter(Boolean).join(" ");

  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block font-semibold">
        {label}
      </label>
      {children({
        id,
        "aria-describedby": describedBy || undefined,
        "aria-invalid": error ? true : undefined,
      })}
      {hint && (
        <p id={hintId} className="muted mt-1.5 text-sm">
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} className="mt-1.5 text-sm font-medium text-coral">
          {error}
        </p>
      )}
    </div>
  );
}

export function FormError({ message }: { message?: string | null }) {
  if (!message) return null;
  return (
    <p role="alert" className="font-medium text-coral">
      {message}
    </p>
  );
}

export function BackLink({ href, label }: { href: string; label: string }) {
  return (
    <Link href={href} className="btn-link -ml-1 gap-1 no-underline">
      <BackIcon width={20} height={20} />
      {label}
    </Link>
  );
}

export function LoadingState({ label = "Cargando" }: { label?: string }) {
  return (
    <div role="status" className="space-y-4 py-2">
      <span className="sr-only">{label}</span>
      <div className="placeholder-block h-7 w-2/3" />
      <div className="placeholder-block h-44" />
      <div className="placeholder-block h-24" />
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div role="alert" className="py-10">
      <p className="prose-body font-medium">{message}</p>
      {onRetry && (
        <button type="button" className="btn btn-secondary mt-4" onClick={onRetry}>
          Intentar de nuevo
        </button>
      )}
    </div>
  );
}

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="py-10">
      <h2 className="section-title">{title}</h2>
      {description && <p className="muted prose-body mt-1">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function Segmented<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (value: T) => void;
}) {
  return (
    <div role="group" aria-label={label} className="segmented">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          className="segmented-item"
          aria-pressed={option.value === value}
          onClick={() => onChange(option.value)}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
