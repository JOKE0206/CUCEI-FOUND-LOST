import cors from "cors";
import express from "express";
import { env, isSupabaseConfigured } from "./config/env";
import { createServices, type AppServices } from "./container";
import { createAdminRouter } from "./modules/admin/admin.routes";
import { createAutenticacionRouter } from "./modules/autenticacion/autenticacion.routes";
import { createCampusesRouter } from "./modules/campuses/campuses.routes";
import { createCategoriesRouter } from "./modules/categories/categories.routes";
import { createChatRouter } from "./modules/chat/chat.routes";
import { createPublicacionesRouter } from "./modules/publicaciones/publicaciones.routes";
import { createReportsRouter } from "./modules/reports/reports.routes";
import { createVerificacionRouter } from "./modules/verificacion/verificacion.routes";
import { createAuthMiddlewares } from "./shared/middlewares/auth.middleware";
import { errorHandler, notFoundHandler } from "./shared/middlewares/error.middleware";

export function createApp(services: AppServices) {
  const app = express();
  const auth = createAuthMiddlewares(services.autenticacion);

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

  app.use("/api/v1/auth", createAutenticacionRouter(services.autenticacion, auth));
  // Va antes de publicaciones porque ese router exige sesión a todo lo que recibe.
  app.use("/api/v1", createVerificacionRouter(services.verificacion, auth));
  app.use("/api/v1/publicaciones", createPublicacionesRouter(services.publicaciones, auth));
  app.use("/api/v1/chats", createChatRouter(services.chat, auth));
  app.use("/api/v1/campuses", createCampusesRouter(services.campuses, auth));
  app.use("/api/v1/categories", createCategoriesRouter(services.categories, auth));
  app.use("/api/v1/reports", createReportsRouter(services.reports, auth));
  app.use("/api/v1/admin", createAdminRouter(services.admin, auth));

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}

export const app = createApp(createServices());
