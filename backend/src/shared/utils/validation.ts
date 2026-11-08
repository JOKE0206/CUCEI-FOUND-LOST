import { z } from "zod";

export const uuidSchema = z.uuid();

export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(20),
});

export function parseUuid(value: unknown): string {
  return uuidSchema.parse(value);
}
