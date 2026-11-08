import type { Request, Response } from "express";
import { z } from "zod";
import { getActor } from "../../shared/middlewares/auth.middleware";
import type { ReportsService } from "./reports.service";

const reason = z.string().trim().min(3).max(1000);

// Quien reporta sale del token: strict rechaza cualquier reporterId enviado.
const createReportSchema = z.union([
  z.strictObject({ targetPublicationId: z.uuid(), reason }),
  z.strictObject({ targetUserId: z.uuid(), reason }),
]);

export function createReportsController(service: ReportsService) {
  return {
    create: async (req: Request, res: Response) => {
      const body = createReportSchema.parse(req.body);
      const report = await service.create(
        getActor(req),
        "targetPublicationId" in body
          ? { targetPublicationId: body.targetPublicationId, targetUserId: null, reason: body.reason }
          : { targetPublicationId: null, targetUserId: body.targetUserId, reason: body.reason },
      );
      res.status(201).json(report);
    },
  };
}
