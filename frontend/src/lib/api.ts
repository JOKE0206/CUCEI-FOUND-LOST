import { getSupabase } from "./supabase";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

export interface ApiErrorDetail {
  path: string;
  message: string;
}

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly details: ApiErrorDetail[] = [],
  ) {
    super(message);
    this.name = "ApiError";
  }
}

async function accessToken(): Promise<string | undefined> {
  const { data } = (await getSupabase()?.auth.getSession()) ?? { data: null };
  return data?.session?.access_token;
}

export async function api<T>(path: string, init: { method?: string; body?: unknown } = {}): Promise<T> {
  const token = await accessToken();

  let response: Response;
  try {
    response = await fetch(`${API_URL}/api/v1${path}`, {
      method: init.method ?? "GET",
      headers: {
        ...(init.body === undefined ? {} : { "content-type": "application/json" }),
        ...(token ? { authorization: `Bearer ${token}` } : {}),
      },
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
    });
  } catch {
    throw new ApiError(0, "SIN_CONEXION", "No pudimos conectar con el servidor. Revisa tu conexión e inténtalo de nuevo.");
  }

  if (response.status === 204) return undefined as T;

  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    const error = payload?.error;
    throw new ApiError(
      response.status,
      error?.code ?? "ERROR",
      error?.message ?? "Algo falló en el servidor. Inténtalo de nuevo.",
      error?.details ?? [],
    );
  }

  return payload as T;
}

export function errorMessage(error: unknown): string {
  return error instanceof ApiError ? error.message : "Algo falló. Inténtalo de nuevo.";
}

export function buildQuery(params: Record<string, string | number | undefined | null>): string {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== "") query.set(key, String(value));
  }
  const text = query.toString();
  return text ? `?${text}` : "";
}
