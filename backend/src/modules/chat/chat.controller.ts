import type { Request, Response } from "express";
import { z } from "zod";
import { getActor } from "../../shared/middlewares/auth.middleware";
import { parseUuid } from "../../shared/utils/validation";
import { MESSAGE_MAX_LENGTH } from "./chat.entity";
import type { ChatService } from "./chat.service";

const listMessagesSchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(50),
  before: z.iso.datetime({ offset: true }).optional(),
});

const sendMessageSchema = z.strictObject({
  content: z.string().trim().min(1).max(MESSAGE_MAX_LENGTH),
});

export function createChatController(service: ChatService) {
  return {
    listMine: async (req: Request, res: Response) => {
      res.json(await service.listMine(getActor(req)));
    },

    getChat: async (req: Request, res: Response) => {
      res.json(await service.getChat(parseUuid(req.params.id), getActor(req)));
    },

    listMessages: async (req: Request, res: Response) => {
      const options = listMessagesSchema.parse(req.query);
      res.json(await service.listMessages(parseUuid(req.params.id), getActor(req), options));
    },

    sendMessage: async (req: Request, res: Response) => {
      const { content } = sendMessageSchema.parse(req.body);
      const message = await service.sendMessage(parseUuid(req.params.id), getActor(req), content);
      res.status(201).json(message);
    },
  };
}
