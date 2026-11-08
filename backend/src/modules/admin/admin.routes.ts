import { Router } from "express";
import type { AuthMiddlewares } from "../../shared/middlewares/auth.middleware";
import { createAdminController } from "./admin.controller";
import type { AdminService } from "./admin.service";

export function createAdminRouter(service: AdminService, auth: AuthMiddlewares) {
  const controller = createAdminController(service);
  const router = Router();

  router.use(auth.requireAdmin);

  router.get("/reports", controller.listReports);
  router.patch("/reports/:id", controller.decideReport);
  router.post("/publications/:id/moderate", controller.moderatePublication);
  router.post("/publications/:id/unsuspend", controller.unsuspendPublication);

  return router;
}
