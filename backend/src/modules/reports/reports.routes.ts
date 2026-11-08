import { Router } from "express";
import type { AuthMiddlewares } from "../../shared/middlewares/auth.middleware";
import { createReportsController } from "./reports.controller";
import type { ReportsService } from "./reports.service";

export function createReportsRouter(service: ReportsService, auth: AuthMiddlewares) {
  const controller = createReportsController(service);
  const router = Router();

  router.post("/", auth.requireActiveUser, controller.create);

  return router;
}
