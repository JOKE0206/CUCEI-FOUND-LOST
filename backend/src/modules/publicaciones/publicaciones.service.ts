import { randomUUID } from "node:crypto";
import type { Actor } from "../../shared/middlewares/auth.middleware";
import { conflict, forbidden, notFound, unprocessable } from "../../shared/utils/app-error";
import type { PublicProfileReader } from "../autenticacion/autenticacion.repository";
import { normalizeVerificationQuestions } from "../verificacion/verificacion.entity";
import {
  MAX_PHOTOS_PER_PUBLICATION,
  PHOTO_EXTENSIONS,
  type NewPublication,
  type PhotoMimeType,
  type PhotoView,
  type Publication,
  type PublicationChanges,
  type PublicationFilters,
  type PublicationView,
} from "./publicaciones.entity";
import type {
  PhotoStorage,
  PublicacionesRepository,
  PublicationReader,
  SignedUpload,
} from "./publicaciones.repository";

// Lo que no se puede ver responde 404, para no revelar que existe.
export async function loadVisiblePublication(
  reader: PublicationReader,
  publicationId: string,
  actor: Actor,
): Promise<Publication> {
  const publication = await reader.findById(publicationId);
  if (!publication) throw notFound("Publicación no encontrada");

  // Una publicación moderada solo la sigue viendo quien la publicó.
  const moderated = publication.status === "removed" || publication.status === "suspended";
  const visible =
    publication.status === "active" ||
    publication.userId === actor.id ||
    (!moderated && (await reader.hasClaimBy(publicationId, actor.id)));

  if (!visible) throw notFound("Publicación no encontrada");
  return publication;
}

export function assertPublicationOwner(publication: Publication, actor: Actor): void {
  if (publication.userId !== actor.id) {
    throw forbidden("SIN_PERMISO", "Solo quien publicó puede realizar esta acción");
  }
}

export type NewPublicationInput = Omit<NewPublication, "userId">;

export class PublicacionesService {
  constructor(
    private readonly repository: PublicacionesRepository,
    private readonly storage: PhotoStorage,
    private readonly profiles: PublicProfileReader,
  ) {}

  async list(filters: PublicationFilters) {
    const { items, total } = await this.repository.list(filters);
    return {
      items: await this.toViews(items),
      total,
      page: filters.page,
      pageSize: filters.pageSize,
    };
  }

  async listMine(actor: Actor): Promise<PublicationView[]> {
    return this.toViews(await this.repository.listByUser(actor.id));
  }

  async getDetail(publicationId: string, actor: Actor): Promise<PublicationView> {
    const publication = await loadVisiblePublication(this.repository, publicationId, actor);
    const [view] = await this.toViews([publication]);
    return view;
  }

  async create(actor: Actor, input: NewPublicationInput): Promise<PublicationView> {
    const questions = normalizeVerificationQuestions(input.type, input.questions);
    const id = await this.repository.create({ ...input, questions, userId: actor.id });
    return this.getDetail(id, actor);
  }

  async update(publicationId: string, actor: Actor, changes: PublicationChanges) {
    await this.loadOwnedActive(publicationId, actor);

    const updated = await this.repository.updateIfActive(publicationId, changes);
    if (!updated) throw this.notActive();

    const [view] = await this.toViews([updated]);
    return view;
  }

  async cancel(publicationId: string, actor: Actor): Promise<PublicationView> {
    await this.loadOwnedActive(publicationId, actor);
    await this.repository.cancel(publicationId, actor.id);
    return this.getDetail(publicationId, actor);
  }

  async resolve(publicationId: string, actor: Actor): Promise<PublicationView> {
    const publication = await loadVisiblePublication(this.repository, publicationId, actor);
    assertPublicationOwner(publication, actor);

    if (publication.status !== "in_process") {
      throw conflict("ESTADO_NO_VALIDO", "La publicación no tiene una entrega en curso");
    }

    await this.repository.resolve(publicationId, actor.id);
    return this.getDetail(publicationId, actor);
  }

  async requestPhotoUpload(
    publicationId: string,
    actor: Actor,
    mimeType: PhotoMimeType,
  ): Promise<SignedUpload> {
    await this.loadOwnedActive(publicationId, actor);
    await this.assertPhotoCapacity(publicationId);

    const path = `${publicationId}/${randomUUID()}.${PHOTO_EXTENSIONS[mimeType]}`;
    return this.storage.createUpload(path);
  }

  async registerPhoto(publicationId: string, actor: Actor, storagePath: string): Promise<PhotoView> {
    await this.loadOwnedActive(publicationId, actor);
    const photos = await this.assertPhotoCapacity(publicationId);

    // La ruta debe ser de esta publicación: impide adjuntar archivos ajenos.
    const validPath = new RegExp(
      `^${publicationId}/[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}\\.(jpg|png|webp)$`,
    );
    if (!validPath.test(storagePath) || !(await this.storage.exists(storagePath))) {
      throw unprocessable("FOTO_NO_VALIDA", "La foto no existe o no pertenece a esta publicación");
    }

    const position = photos.reduce((next, photo) => Math.max(next, photo.position + 1), 0);
    const photo = await this.repository.addPhoto(publicationId, storagePath, position);
    const urls = await this.storage.signUrls([photo.storagePath]);

    return { id: photo.id, position: photo.position, url: urls.get(photo.storagePath) ?? "" };
  }

  async deletePhoto(publicationId: string, photoId: string, actor: Actor): Promise<void> {
    await this.loadOwnedActive(publicationId, actor);

    const photo = await this.repository.findPhoto(photoId);
    if (!photo || photo.publicationId !== publicationId) throw notFound("Foto no encontrada");

    await this.repository.deletePhoto(photoId);
    await this.storage.remove([photo.storagePath]);
  }

  private async loadOwnedActive(publicationId: string, actor: Actor): Promise<Publication> {
    const publication = await loadVisiblePublication(this.repository, publicationId, actor);
    assertPublicationOwner(publication, actor);
    if (publication.status !== "active") throw this.notActive();
    return publication;
  }

  private notActive() {
    return conflict("ESTADO_NO_VALIDO", "La publicación ya no está activa");
  }

  private async assertPhotoCapacity(publicationId: string) {
    const photos = await this.repository.listPhotos([publicationId]);
    if (photos.length >= MAX_PHOTOS_PER_PUBLICATION) {
      throw conflict("LIMITE_DE_FOTOS", `Máximo ${MAX_PHOTOS_PER_PUBLICATION} fotos por publicación`);
    }
    return photos;
  }

  private async toViews(publications: Publication[]): Promise<PublicationView[]> {
    const ids = publications.map((publication) => publication.id);
    const photos = await this.repository.listPhotos(ids);
    const [urls, profiles] = await Promise.all([
      this.storage.signUrls(photos.map((photo) => photo.storagePath)),
      this.profiles.findPublicProfiles([...new Set(publications.map((p) => p.userId))]),
    ]);

    return publications.map((publication) => ({
      ...publication,
      publisher: profiles.find((profile) => profile.id === publication.userId) ?? null,
      photos: photos
        .filter((photo) => photo.publicationId === publication.id && urls.has(photo.storagePath))
        .map((photo) => ({
          id: photo.id,
          position: photo.position,
          url: urls.get(photo.storagePath) as string,
        })),
    }));
  }
}
