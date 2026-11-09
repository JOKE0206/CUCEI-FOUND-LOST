import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,
  partialPrefetching: true,
  experimental: {
    // El área protegida depende de la sesión del navegador y no puede prerenderizarse.
    instantInsights: { validationLevel: "manual-warning" },
  },
  turbopack: {
    // Evita que Next.js tome como raíz el lockfile de la raíz del repositorio.
    root: path.resolve(__dirname),
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
