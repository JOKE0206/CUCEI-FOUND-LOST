"use client";

import { useCallback, useEffect, useState } from "react";
import { api, ApiError } from "./api";

interface Settled<T> {
  id: string;
  version: number;
  data?: T;
  error?: ApiError;
}

// Lectura de un recurso. Al recargar conserva los datos anteriores en pantalla.
export function useApi<T>(path: string | null, scope = "") {
  const id = path === null ? null : `${scope}|${path}`;
  const [settled, setSettled] = useState<Settled<T> | null>(null);
  const [version, setVersion] = useState(0);

  useEffect(() => {
    if (path === null || id === null) return;
    let active = true;

    api<T>(path)
      .then((data) => {
        if (active) setSettled({ id, version, data });
      })
      .catch((caught: unknown) => {
        if (!active) return;
        const error =
          caught instanceof ApiError ? caught : new ApiError(0, "ERROR", "Algo falló. Inténtalo de nuevo.");
        setSettled({ id, version, error });
      });

    return () => {
      active = false;
    };
  }, [id, path, version]);

  const reload = useCallback(() => setVersion((current) => current + 1), []);

  const current = settled && settled.id === id ? settled : null;

  return {
    data: current?.data,
    error: current?.error,
    loading: id !== null && (current === null || current.version !== version),
    reload,
  };
}
