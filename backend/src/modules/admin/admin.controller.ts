import type { Request, Response } from "express";
import { z } from "zod";
import { getActor } from "../../shared/middlewares/auth.middleware";
import { paginationSchema, parseUuid } from "../../shared/utils/validation";
import type { AdminService } from "./admin.service";

const listReportsSchema = paginationSchema.extend({
  status: z.enum(["pending", "reviewing", "resolved", "dismissed"]).optional(),
});

const decideReportSchema = z.strictObject({
  status: z.enum(["resolved", "dismissed"]),
});

const moderateSchema = z.strictObject({
  action: z.enum(["remove", "suspend"]),
});

export function createAdminController(service: AdminService) {
  return {
    listReports: async (req: Request, res: Response) => {
      res.json(await service.listReports(getActor(req), listReportsSchema.parse(req.query)));
    },

    decideReport: async (req: Request, res: Response) => {
      const { status } = decideReportSchema.parse(req.body);
      res.json(await service.decideReport(getActor(req), parseUuid(req.params.id), status));
    },

    moderatePublication: async (req: Request, res: Response) => {
      const { action } = moderateSchema.parse(req.body);
      res.json(await service.moderatePublication(getActor(req), parseUuid(req.params.id), action));
    },

    unsuspendPublication: async (req: Request, res: Response) => {
      res.json(await service.unsuspendPublication(getActor(req), parseUuid(req.params.id)));
    },
  };
}
