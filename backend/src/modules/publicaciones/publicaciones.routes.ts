import { Router } from "express";
import type { AuthMiddlewares } from "../../shared/middlewares/auth.middleware";
import { createPublicacionesController } from "./publicaciones.controller";
import type { PublicacionesService } from "./publicaciones.service";

export function createPublicacionesRouter(service: PublicacionesService, auth: AuthMiddlewares) {
  const controller = createPublicacionesController(service);
  const router = Router();

  router.use(auth.requireActiveUser);

  router.get("/", controller.list);
  router.post("/", controller.create);
  router.get("/mias", controller.listMine);
  router.get("/:id", controller.getDetail);
  router.patch("/:id", controller.update);
  router.post("/:id/cancelar", controller.cancel);
  router.post("/:id/resolver", controller.resolve);
  router.post("/:id/fotos/url-subida", controller.requestPhotoUpload);
  router.post("/:id/fotos", controller.registerPhoto);
  router.delete("/:id/fotos/:photoId", controller.deletePhoto);

  return router;
}
