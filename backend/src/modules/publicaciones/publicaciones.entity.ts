import type { PublicProfile } from "../autenticacion/autenticacion.entity";

export type PublicationType = "lost" | "found";
export type PublicationStatus =
  | "active"
  | "in_process"
  | "resolved"
  | "cancelled"
  | "removed"
  | "suspended";

export interface Publication {
  id: string;
  userId: string;
  campusId: string;
  locationId: string | null;
  categoryId: string;
  type: PublicationType;
  status: PublicationStatus;
  title: string;
  description: string;
  eventDate: string;
  createdAt: string;
  updatedAt: string;
}

export interface NewPublication {
  userId: string;
  campusId: string;
  locationId: string | null;
  categoryId: string;
  type: PublicationType;
  title: string;
  description: string;
  eventDate: string;
  questions: string[];
}

export interface PublicationChanges {
  locationId?: string | null;
  categoryId?: string;
  title?: string;
  description?: string;
  eventDate?: string;
}

export interface PublicationFilters {
  campusId?: string;
  locationId?: string;
  categoryId?: string;
  type?: PublicationType;
  dateFrom?: string;
  dateTo?: string;
  page: number;
  pageSize: number;
}

export interface Photo {
  id: string;
  publicationId: string;
  storagePath: string;
  position: number;
  createdAt: string;
}

// Las fotos salen siempre como URL firmada y temporal, nunca como ruta interna.
export interface PhotoView {
  id: string;
  position: number;
  url: string;
}

export interface PublicationView extends Publication {
  publisher: PublicProfile | null;
  photos: PhotoView[];
}

export const MAX_PHOTOS_PER_PUBLICATION = 5;

export const PHOTO_EXTENSIONS = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
} as const;

export type PhotoMimeType = keyof typeof PHOTO_EXTENSIONS;
