import type { Request, Response } from "express";
import { z } from "zod";
import { getSessionUser } from "../../shared/middlewares/auth.middleware";
import type { AutenticacionService } from "./autenticacion.service";

const createProfileSchema = z.object({
  displayName: z.string().trim().min(1).max(80),
  campusId: z.uuid().nullish(),
});

export function createAutenticacionController(service: AutenticacionService) {
  return {
    me: async (req: Request, res: Response) => {
      res.json(await service.getCurrentUser(getSessionUser(req)));
    },

    createProfile: async (req: Request, res: Response) => {
      const body = createProfileSchema.parse(req.body);
      const profile = await service.createProfile(getSessionUser(req), {
        displayName: body.displayName,
        campusId: body.campusId ?? null,
      });
      res.status(201).json(profile);
    },
  };
}
