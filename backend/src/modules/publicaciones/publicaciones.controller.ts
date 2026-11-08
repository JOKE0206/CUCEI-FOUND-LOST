import type { Request, Response } from "express";
import { z } from "zod";
import { getActor } from "../../shared/middlewares/auth.middleware";
import { paginationSchema, parseUuid } from "../../shared/utils/validation";
import { PHOTO_EXTENSIONS, type PhotoMimeType } from "./publicaciones.entity";
import type { PublicacionesService } from "./publicaciones.service";

const title = z.string().trim().min(3).max(120);
const description = z.string().trim().min(1).max(2000);
const publicationType = z.enum(["lost", "found"]);

const listSchema = paginationSchema.extend({
  campusId: z.uuid().optional(),
  locationId: z.uuid().optional(),
  categoryId: z.uuid().optional(),
  type: publicationType.optional(),
  dateFrom: z.iso.date().optional(),
  dateTo: z.iso.date().optional(),
});

// La propiedad nunca se acepta del cliente: strict rechaza userId y status.
const createSchema = z.strictObject({
  campusId: z.uuid(),
  locationId: z.uuid().nullish(),
  categoryId: z.uuid(),
  type: publicationType,
  title,
  description,
  eventDate: z.iso.date(),
  questions: z.array(z.string()).default([]),
});

const updateSchema = z
  .strictObject({
    locationId: z.uuid().nullable().optional(),
    categoryId: z.uuid().optional(),
    title: title.optional(),
    description: description.optional(),
    eventDate: z.iso.date().optional(),
  })
  .refine((changes) => Object.keys(changes).length > 0, "Indica al menos un campo");

const photoMimeTypes = Object.keys(PHOTO_EXTENSIONS) as [PhotoMimeType, ...PhotoMimeType[]];
const uploadSchema = z.strictObject({ mimeType: z.enum(photoMimeTypes) });
const registerPhotoSchema = z.strictObject({ storagePath: z.string().min(1).max(500) });

export function createPublicacionesController(service: PublicacionesService) {
  return {
    list: async (req: Request, res: Response) => {
      res.json(await service.list(listSchema.parse(req.query)));
    },

    listMine: async (req: Request, res: Response) => {
      res.json(await service.listMine(getActor(req)));
    },

    getDetail: async (req: Request, res: Response) => {
      res.json(await service.getDetail(parseUuid(req.params.id), getActor(req)));
    },

    create: async (req: Request, res: Response) => {
      const body = createSchema.parse(req.body);
      const publication = await service.create(getActor(req), {
        ...body,
        locationId: body.locationId ?? null,
      });
      res.status(201).json(publication);
    },

    update: async (req: Request, res: Response) => {
      const changes = updateSchema.parse(req.body);
      res.json(await service.update(parseUuid(req.params.id), getActor(req), changes));
    },

    cancel: async (req: Request, res: Response) => {
      res.json(await service.cancel(parseUuid(req.params.id), getActor(req)));
    },

    resolve: async (req: Request, res: Response) => {
      res.json(await service.resolve(parseUuid(req.params.id), getActor(req)));
    },

    requestPhotoUpload: async (req: Request, res: Response) => {
      const { mimeType } = uploadSchema.parse(req.body);
      const upload = await service.requestPhotoUpload(parseUuid(req.params.id), getActor(req), mimeType);
      res.status(201).json(upload);
    },

    registerPhoto: async (req: Request, res: Response) => {
      const { storagePath } = registerPhotoSchema.parse(req.body);
      const photo = await service.registerPhoto(parseUuid(req.params.id), getActor(req), storagePath);
      res.status(201).json(photo);
    },

    deletePhoto: async (req: Request, res: Response) => {
      await service.deletePhoto(parseUuid(req.params.id), parseUuid(req.params.photoId), getActor(req));
      res.status(204).end();
    },
  };
}
