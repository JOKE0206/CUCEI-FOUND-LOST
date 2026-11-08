import { Router } from "express";
import type { AuthMiddlewares } from "../../shared/middlewares/auth.middleware";
import { createVerificacionController } from "./verificacion.controller";
import type { VerificacionService } from "./verificacion.service";

// Va montado en /api/v1 y comparte el prefijo /publicaciones con otro módulo,
// así que la autenticación se declara ruta por ruta.
export function createVerificacionRouter(service: VerificacionService, auth: AuthMiddlewares) {
  const controller = createVerificacionController(service);
  const router = Router();
  const active = auth.requireActiveUser;

  router.get("/publicaciones/:id/preguntas", active, controller.listQuestions);
  router.put("/publicaciones/:id/preguntas", active, controller.replaceQuestions);
  router.post("/publicaciones/:id/reclamaciones", active, controller.submitClaim);
  router.get("/publicaciones/:id/reclamaciones", active, controller.listForPublication);

  router.get("/reclamaciones/mias", active, controller.listMine);
  router.get("/reclamaciones/:id", active, controller.getClaim);
  router.post("/reclamaciones/:id/aprobar", active, controller.approve);
  router.post("/reclamaciones/:id/rechazar", active, controller.reject);
  router.post("/reclamaciones/:id/cancelar", active, controller.cancel);

  return router;
}
