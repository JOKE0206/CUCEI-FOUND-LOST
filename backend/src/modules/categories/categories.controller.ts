import type { Request, Response } from "express";
import type { CategoriesService } from "./categories.service";

export function createCategoriesController(service: CategoriesService) {
  return {
    listActive: async (_req: Request, res: Response) => {
      res.json(await service.listActive());
    },
  };
}
