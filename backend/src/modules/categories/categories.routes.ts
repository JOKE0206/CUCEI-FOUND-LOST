import { Router } from "express";
import type { AuthMiddlewares } from "../../shared/middlewares/auth.middleware";
import { createCategoriesController } from "./categories.controller";
import type { CategoriesService } from "./categories.service";

export function createCategoriesRouter(service: CategoriesService, auth: AuthMiddlewares) {
  const controller = createCategoriesController(service);
  const router = Router();

  router.get("/", auth.requireActiveUser, controller.listActive);

  return router;
}
