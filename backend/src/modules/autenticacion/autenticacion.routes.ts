import { Router } from "express";
import type { AuthMiddlewares } from "../../shared/middlewares/auth.middleware";
import { createAutenticacionController } from "./autenticacion.controller";
import type { AutenticacionService } from "./autenticacion.service";

export function createAutenticacionRouter(service: AutenticacionService, auth: AuthMiddlewares) {
  const controller = createAutenticacionController(service);
  const router = Router();

  router.get("/me", auth.requireSession, controller.me);
  router.post("/perfil", auth.requireSession, controller.createProfile);

  return router;
}
