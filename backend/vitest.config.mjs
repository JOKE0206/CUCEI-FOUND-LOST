import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["tests/**/*.test.ts"],
    // Vacías a propósito: las pruebas nunca deben poder llegar a un proyecto real.
    env: {
      SUPABASE_URL: "",
      SUPABASE_SERVICE_ROLE_KEY: "",
      ALLOWED_EMAIL_DOMAINS: "udg.mx,alumnos.udg.mx",
    },
  },
});
