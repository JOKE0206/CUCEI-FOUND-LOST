import { getSupabase } from "../../config/supabase";
import { unwrap } from "../../shared/utils/supabase-result";
import type {
  NewPublication,
  Photo,
  Publication,
  PublicationChanges,
  PublicationFilters,
} from "./publicaciones.entity";

export const PHOTOS_BUCKET = "publication-photos";
const SIGNED_URL_SECONDS = 3600;

// Lo mínimo que otros módulos necesitan para comprobar acceso a una publicación.
export interface PublicationReader {
  findById(id: string): Promise<Publication | null>;
  hasClaimBy(publicationId: string, userId: string): Promise<boolean>;
}

export interface PublicacionesRepository extends PublicationReader {
  list(filters: PublicationFilters): Promise<{ items: Publication[]; total: number }>;
  listByUser(userId: string): Promise<Publication[]>;
  create(publication: NewPublication): Promise<string>;
  updateIfActive(id: string, changes: PublicationChanges): Promise<Publication | null>;
  cancel(id: string, userId: string): Promise<void>;
  resolve(id: string, userId: string): Promise<void>;
  listPhotos(publicationIds: string[]): Promise<Photo[]>;
  findPhoto(id: string): Promise<Photo | null>;
  addPhoto(publicationId: string, storagePath: string, position: number): Promise<Photo>;
  deletePhoto(id: string): Promise<void>;
}

export interface SignedUpload {
  path: string;
  token: string;
  signedUrl: string;
}

export interface PhotoStorage {
  createUpload(path: string): Promise<SignedUpload>;
  exists(path: string): Promise<boolean>;
  signUrls(paths: string[]): Promise<Map<string, string>>;
  remove(paths: string[]): Promise<void>;
}

interface PublicationRow {
  id: string;
  user_id: string;
  campus_id: string;
  location_id: string | null;
  category_id: string;
  type: Publication["type"];
  status: Publication["status"];
  title: string;
  description: string;
  event_date: string;
  created_at: string;
  updated_at: string;
}

interface PhotoRow {
  id: string;
  publication_id: string;
  storage_path: string;
  position: number;
  created_at: string;
}

const PUBLICATION_COLUMNS =
  "id, user_id, campus_id, location_id, category_id, type, status, title, description, event_date, created_at, updated_at";
const PHOTO_COLUMNS = "id, publication_id, storage_path, position, created_at";

function toPublication(row: PublicationRow): Publication {
  return {
    id: row.id,
    userId: row.user_id,
    campusId: row.campus_id,
    locationId: row.location_id,
    categoryId: row.category_id,
    type: row.type,
    status: row.status,
    title: row.title,
    description: row.description,
    eventDate: row.event_date,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function toPhoto(row: PhotoRow): Photo {
  return {
    id: row.id,
    publicationId: row.publication_id,
    storagePath: row.storage_path,
    position: row.position,
    createdAt: row.created_at,
  };
}

export class SupabasePublicacionesRepository implements PublicacionesRepository {
  async findById(id: string): Promise<Publication | null> {
    const row = unwrap<PublicationRow | null>(
      await getSupabase().from("publications").select(PUBLICATION_COLUMNS).eq("id", id).maybeSingle(),
    );
    return row ? toPublication(row) : null;
  }

  async hasClaimBy(publicationId: string, userId: string): Promise<boolean> {
    const rows = unwrap<{ id: string }[]>(
      await getSupabase()
        .from("claims")
        .select("id")
        .eq("publication_id", publicationId)
        .eq("claimant_id", userId)
        .limit(1),
    );
    return rows.length > 0;
  }

  async list(filters: PublicationFilters): Promise<{ items: Publication[]; total: number }> {
    const start = (filters.page - 1) * filters.pageSize;
    let query = getSupabase()
      .from("publications")
      .select(PUBLICATION_COLUMNS, { count: "exact" })
      .eq("status", "active");

    if (filters.campusId) query = query.eq("campus_id", filters.campusId);
    if (filters.locationId) query = query.eq("location_id", filters.locationId);
    if (filters.categoryId) query = query.eq("category_id", filters.categoryId);
    if (filters.type) query = query.eq("type", filters.type);
    if (filters.dateFrom) query = query.gte("event_date", filters.dateFrom);
    if (filters.dateTo) query = query.lte("event_date", filters.dateTo);

    const result = await query
      .order("created_at", { ascending: false })
      .range(start, start + filters.pageSize - 1);

    return {
      items: unwrap<PublicationRow[]>(result).map(toPublication),
      total: result.count ?? 0,
    };
  }

  async listByUser(userId: string): Promise<Publication[]> {
    const rows = unwrap<PublicationRow[]>(
      await getSupabase()
        .from("publications")
        .select(PUBLICATION_COLUMNS)
        .eq("user_id", userId)
        .order("created_at", { ascending: false }),
    );
    return rows.map(toPublication);
  }

  async create(publication: NewPublication): Promise<string> {
    return unwrap<string>(
      await getSupabase().rpc("create_publication_with_questions", {
        p_user_id: publication.userId,
        p_campus_id: publication.campusId,
        p_location_id: publication.locationId,
        p_category_id: publication.categoryId,
        p_type: publication.type,
        p_title: publication.title,
        p_description: publication.description,
        p_event_date: publication.eventDate,
        p_questions: publication.questions,
      }),
    );
  }

  async updateIfActive(id: string, changes: PublicationChanges): Promise<Publication | null> {
    const row = unwrap<PublicationRow | null>(
      await getSupabase()
        .from("publications")
        .update({
          location_id: changes.locationId,
          category_id: changes.categoryId,
          title: changes.title,
          description: changes.description,
          event_date: changes.eventDate,
        })
        .eq("id", id)
        .eq("status", "active")
        .select(PUBLICATION_COLUMNS)
        .maybeSingle(),
    );
    return row ? toPublication(row) : null;
  }

  async cancel(id: string, userId: string): Promise<void> {
    unwrap(await getSupabase().rpc("cancel_publication", { p_publication_id: id, p_user_id: userId }));
  }

  async resolve(id: string, userId: string): Promise<void> {
    unwrap(await getSupabase().rpc("resolve_publication", { p_publication_id: id, p_user_id: userId }));
  }

  async listPhotos(publicationIds: string[]): Promise<Photo[]> {
    if (publicationIds.length === 0) return [];

    const rows = unwrap<PhotoRow[]>(
      await getSupabase()
        .from("photos")
        .select(PHOTO_COLUMNS)
        .in("publication_id", publicationIds)
        .order("position", { ascending: true }),
    );
    return rows.map(toPhoto);
  }

  async findPhoto(id: string): Promise<Photo | null> {
    const row = unwrap<PhotoRow | null>(
      await getSupabase().from("photos").select(PHOTO_COLUMNS).eq("id", id).maybeSingle(),
    );
    return row ? toPhoto(row) : null;
  }

  async addPhoto(publicationId: string, storagePath: string, position: number): Promise<Photo> {
    const row = unwrap<PhotoRow>(
      await getSupabase()
        .from("photos")
        .insert({ publication_id: publicationId, storage_path: storagePath, position })
        .select(PHOTO_COLUMNS)
        .single(),
    );
    return toPhoto(row);
  }

  async deletePhoto(id: string): Promise<void> {
    unwrap(await getSupabase().from("photos").delete().eq("id", id));
  }
}

export class SupabasePhotoStorage implements PhotoStorage {
  private get bucket() {
    return getSupabase().storage.from(PHOTOS_BUCKET);
  }

  async createUpload(path: string): Promise<SignedUpload> {
    const { data, error } = await this.bucket.createSignedUploadUrl(path);
    if (error) throw new Error(`Error de Storage: ${error.message}`);
    return { path: data.path, token: data.token, signedUrl: data.signedUrl };
  }

  async exists(path: string): Promise<boolean> {
    const { data } = await this.bucket.exists(path);
    return data === true;
  }

  async signUrls(paths: string[]): Promise<Map<string, string>> {
    if (paths.length === 0) return new Map();

    const { data, error } = await this.bucket.createSignedUrls(paths, SIGNED_URL_SECONDS);
    if (error) throw new Error(`Error de Storage: ${error.message}`);

    const urls = new Map<string, string>();
    for (const item of data) {
      if (item.path && item.signedUrl) urls.set(item.path, item.signedUrl);
    }
    return urls;
  }

  async remove(paths: string[]): Promise<void> {
    const { error } = await this.bucket.remove(paths);
    if (error) throw new Error(`Error de Storage: ${error.message}`);
  }
}
