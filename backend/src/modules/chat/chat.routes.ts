import { Router } from "express";
import type { AuthMiddlewares } from "../../shared/middlewares/auth.middleware";
import { createChatController } from "./chat.controller";
import type { ChatService } from "./chat.service";

export function createChatRouter(service: ChatService, auth: AuthMiddlewares) {
  const controller = createChatController(service);
  const router = Router();

  router.use(auth.requireActiveUser);

  router.get("/", controller.listMine);
  router.get("/:id", controller.getChat);
  router.get("/:id/mensajes", controller.listMessages);
  router.post("/:id/mensajes", controller.sendMessage);

  return router;
}
