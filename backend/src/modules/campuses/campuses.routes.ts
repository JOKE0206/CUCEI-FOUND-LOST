import { Router } from "express";
import type { AuthMiddlewares } from "../../shared/middlewares/auth.middleware";
import { createCampusesController } from "./campuses.controller";
import type { CampusesService } from "./campuses.service";

export function createCampusesRouter(service: CampusesService, auth: AuthMiddlewares) {
  const controller = createCampusesController(service);
  const router = Router();

  // Solo sesión: quien aún no tiene perfil debe poder elegir campus al crearlo.
  router.get("/", auth.requireSession, controller.listActive);
  router.get("/:id/locations", auth.requireActiveUser, controller.listLocations);

  return router;
}
