import path from "node:path";

// Funciona desde src/config (tsx) y desde dist/config (build).
const envFile = path.resolve(__dirname, "../../.env");

try {
  process.loadEnvFile(envFile);
} catch (error) {
  // El archivo .env es opcional: en producción las variables las da la plataforma.
  if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
}

// Los valores copiados tal cual de .env.example cuentan como no configurados.
function readSecret(name: string): string | undefined {
  const value = process.env[name]?.trim();
  if (!value || /^(https:\/\/)?tu-/.test(value)) return undefined;
  return value;
}

const DEFAULT_ALLOWED_EMAIL_DOMAINS = ["udg.mx", "alumnos.udg.mx"];

function readDomainList(name: string): string[] {
  const domains = (process.env[name] ?? "")
    .split(",")
    .map((domain) => domain.trim().toLowerCase())
    .filter(Boolean);
  return domains.length > 0 ? domains : DEFAULT_ALLOWED_EMAIL_DOMAINS;
}

export const env = {
  port: Number(process.env.PORT) || 4000,
  frontendUrl: process.env.FRONTEND_URL?.trim() || "http://localhost:3000",
  allowedEmailDomains: readDomainList("ALLOWED_EMAIL_DOMAINS"),
  supabaseUrl: readSecret("SUPABASE_URL"),
  supabaseServiceRoleKey: readSecret("SUPABASE_SERVICE_ROLE_KEY"),
};

export const isSupabaseConfigured = Boolean(
  env.supabaseUrl && env.supabaseServiceRoleKey,
);
