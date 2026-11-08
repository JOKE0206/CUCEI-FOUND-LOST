import type { Request, Response } from "express";
import { z } from "zod";
import { getActor } from "../../shared/middlewares/auth.middleware";
import { parseUuid } from "../../shared/utils/validation";
import type { VerificacionService } from "./verificacion.service";

const replaceQuestionsSchema = z.strictObject({
  questions: z.array(z.string()),
});

const submitClaimSchema = z.strictObject({
  answers: z
    .array(
      z.strictObject({
        questionId: z.uuid(),
        answer: z.string().trim().min(1).max(1000),
      }),
    )
    .max(20),
});

export function createVerificacionController(service: VerificacionService) {
  return {
    listQuestions: async (req: Request, res: Response) => {
      res.json(await service.listQuestions(parseUuid(req.params.id), getActor(req)));
    },

    replaceQuestions: async (req: Request, res: Response) => {
      const { questions } = replaceQuestionsSchema.parse(req.body);
      res.json(await service.replaceQuestions(parseUuid(req.params.id), getActor(req), questions));
    },

    submitClaim: async (req: Request, res: Response) => {
      const { answers } = submitClaimSchema.parse(req.body);
      const claim = await service.submitClaim(parseUuid(req.params.id), getActor(req), answers);
      res.status(201).json(claim);
    },

    listForPublication: async (req: Request, res: Response) => {
      res.json(await service.listForPublication(parseUuid(req.params.id), getActor(req)));
    },

    listMine: async (req: Request, res: Response) => {
      res.json(await service.listMine(getActor(req)));
    },

    getClaim: async (req: Request, res: Response) => {
      res.json(await service.getClaim(parseUuid(req.params.id), getActor(req)));
    },

    approve: async (req: Request, res: Response) => {
      res.json(await service.approve(parseUuid(req.params.id), getActor(req)));
    },

    reject: async (req: Request, res: Response) => {
      res.json(await service.reject(parseUuid(req.params.id), getActor(req)));
    },

    cancel: async (req: Request, res: Response) => {
      res.json(await service.cancel(parseUuid(req.params.id), getActor(req)));
    },
  };
}
