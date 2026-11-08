import type { Request, Response } from "express";
import { parseUuid } from "../../shared/utils/validation";
import type { CampusesService } from "./campuses.service";

export function createCampusesController(service: CampusesService) {
  return {
    listActive: async (_req: Request, res: Response) => {
      res.json(await service.listActive());
    },

    listLocations: async (req: Request, res: Response) => {
      res.json(await service.listLocations(parseUuid(req.params.id)));
    },
  };
}
