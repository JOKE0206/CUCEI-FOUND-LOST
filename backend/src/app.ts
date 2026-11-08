import cors from "cors";
import express from "express";
import { env, isSupabaseConfigured } from "./config/env";

export const app = express();

app.use(cors({ origin: env.frontendUrl }));
app.use(express.json());

app.get("/health", (_req, res) => {
  res.json({
    status: "ok",
    service: "cucei-found-lost-backend",
    timestamp: new Date().toISOString(),
    supabaseConfigured: isSupabaseConfigured,
  });
});
