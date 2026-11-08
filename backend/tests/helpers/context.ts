import { randomUUID } from "node:crypto";
import type { AppServices } from "../../src/container";
import type { UserProfile } from "../../src/modules/autenticacion/autenticacion.entity";
import type { AdminRepository } from "../../src/modules/admin/admin.repository";
import { AdminService } from "../../src/modules/admin/admin.service";
import type { AutenticacionRepository } from "../../src/modules/autenticacion/autenticacion.repository";
import { AutenticacionService } from "../../src/modules/autenticacion/autenticacion.service";
import type { Campus, Location } from "../../src/modules/campuses/campuses.entity";
import { CampusesService } from "../../src/modules/campuses/campuses.service";
import type { Category } from "../../src/modules/categories/categories.entity";
import { CategoriesService } from "../../src/modules/categories/categories.service";
import type { Chat, Message } from "../../src/modules/chat/chat.entity";
import type { ChatRepository } from "../../src/modules/chat/chat.repository";
import { ChatService } from "../../src/modules/chat/chat.service";
import type {
  NewPublication,
  Photo,
  Publication,
} from "../../src/modules/publicaciones/publicaciones.entity";
import type {
  PhotoStorage,
  PublicacionesRepository,
} from "../../src/modules/publicaciones/publicaciones.repository";
import { PublicacionesService } from "../../src/modules/publicaciones/publicaciones.service";
import type {
  NewReport,
  Report,
  ReportDecision,
  ReportFilters,
  ReportTarget,
} from "../../src/modules/reports/reports.entity";
import type { ReportsRepository } from "../../src/modules/reports/reports.repository";
import { ReportsService } from "../../src/modules/reports/reports.service";
import type {
  Claim,
  ClaimResponse,
  VerificationQuestion,
} from "../../src/modules/verificacion/verificacion.entity";
import type { VerificacionRepository } from "../../src/modules/verificacion/verificacion.repository";
import { VerificacionService } from "../../src/modules/verificacion/verificacion.service";
import type { Actor, SessionUser } from "../../src/shared/middlewares/auth.middleware";

const now = () => new Date().toISOString();

class FakeDatabase {
  sessions = new Map<string, SessionUser>();
  profiles = new Map<string, UserProfile>();
  publications = new Map<string, Publication>();
  photos = new Map<string, Photo>();
  questions = new Map<string, VerificationQuestion>();
  claims = new Map<string, Claim>();
  responses: ClaimResponse[] = [];
  chats = new Map<string, Chat>();
  messages: Message[] = [];
  files = new Set<string>();
  reports = new Map<string, Report>();
  campuses: Campus[] = [];
  locations: Location[] = [];
  categories: Category[] = [];

  questionsOf(publicationId: string) {
    return [...this.questions.values()]
      .filter((question) => question.publicationId === publicationId)
      .sort((a, b) => a.position - b.position);
  }

  setQuestions(publicationId: string, texts: string[]) {
    for (const question of this.questionsOf(publicationId)) this.questions.delete(question.id);
    texts.forEach((question, position) => {
      const id = randomUUID();
      this.questions.set(id, { id, publicationId, question, position });
    });
  }

  claimsOf(publicationId: string) {
    return [...this.claims.values()].filter((claim) => claim.publicationId === publicationId);
  }

  updateClaim(id: string, status: Claim["status"]) {
    this.claims.set(id, { ...this.claims.get(id)!, status, reviewedAt: now() });
  }

  updatePublication(id: string, status: Publication["status"]) {
    this.publications.set(id, { ...this.publications.get(id)!, status });
  }

  closeChatOf(claimId: string) {
    for (const chat of this.chats.values()) {
      if (chat.claimId === claimId) this.chats.set(chat.id, { ...chat, closedAt: now() });
    }
  }
}

class FakeUsers implements AutenticacionRepository {
  constructor(private readonly db: FakeDatabase) {}

  async findSessionUser(token: string) {
    return this.db.sessions.get(token) ?? null;
  }
  async findProfile(id: string) {
    return this.db.profiles.get(id) ?? null;
  }
  async createProfile(profile: { id: string; displayName: string; campusId: string | null }) {
    const created: UserProfile = { ...profile, role: "user", status: "active", createdAt: now() };
    this.db.profiles.set(profile.id, created);
    return created;
  }
  async findPublicProfiles(ids: string[]) {
    return ids.flatMap((id) => {
      const profile = this.db.profiles.get(id);
      return profile ? [{ id, displayName: profile.displayName }] : [];
    });
  }
}

class FakePublicaciones implements PublicacionesRepository {
  constructor(private readonly db: FakeDatabase) {}

  async findById(id: string) {
    return this.db.publications.get(id) ?? null;
  }
  async hasClaimBy(publicationId: string, userId: string) {
    return this.db.claimsOf(publicationId).some((claim) => claim.claimantId === userId);
  }
  async list() {
    const items = [...this.db.publications.values()].filter((p) => p.status === "active");
    return { items, total: items.length };
  }
  async listByUser(userId: string) {
    return [...this.db.publications.values()].filter((p) => p.userId === userId);
  }
  async create({ questions, ...data }: NewPublication) {
    const id = randomUUID();
    this.db.publications.set(id, {
      ...data,
      id,
      status: "active",
      createdAt: now(),
      updatedAt: now(),
    });
    this.db.setQuestions(id, questions);
    return id;
  }
  async updateIfActive(id: string, changes: Partial<Publication>) {
    const current = this.db.publications.get(id);
    if (!current || current.status !== "active") return null;
    const updated = { ...current, ...changes };
    this.db.publications.set(id, updated);
    return updated;
  }
  async cancel(id: string) {
    this.db.updatePublication(id, "cancelled");
    for (const claim of this.db.claimsOf(id)) {
      if (claim.status === "pending") this.db.updateClaim(claim.id, "rejected");
    }
  }
  async resolve(id: string) {
    this.db.updatePublication(id, "resolved");
    for (const claim of this.db.claimsOf(id)) {
      if (claim.status === "pending") this.db.updateClaim(claim.id, "rejected");
      this.db.closeChatOf(claim.id);
    }
  }
  async listPhotos(publicationIds: string[]) {
    return [...this.db.photos.values()].filter((p) => publicationIds.includes(p.publicationId));
  }
  async findPhoto(id: string) {
    return this.db.photos.get(id) ?? null;
  }
  async addPhoto(publicationId: string, storagePath: string, position: number) {
    const id = randomUUID();
    const photo = { id, publicationId, storagePath, position, createdAt: now() };
    this.db.photos.set(id, photo);
    return photo;
  }
  async deletePhoto(id: string) {
    this.db.photos.delete(id);
  }
}

class FakeStorage implements PhotoStorage {
  constructor(private readonly db: FakeDatabase) {}

  async createUpload(path: string) {
    return { path, token: "token-subida", signedUrl: `https://storage.test/subir/${path}` };
  }
  async exists(path: string) {
    return this.db.files.has(path);
  }
  async signUrls(paths: string[]) {
    return new Map(paths.map((path, index) => [path, `https://storage.test/firmada/${index}`]));
  }
  async remove(paths: string[]) {
    for (const path of paths) this.db.files.delete(path);
  }
}

class FakeVerificacion implements VerificacionRepository {
  constructor(private readonly db: FakeDatabase) {}

  async listQuestions(publicationId: string) {
    return this.db.questionsOf(publicationId);
  }
  async replaceQuestions(publicationId: string, _userId: string, questions: string[]) {
    this.db.setQuestions(publicationId, questions);
  }
  async countClaims(publicationId: string) {
    return this.db.claimsOf(publicationId).length;
  }
  async findClaim(id: string) {
    return this.db.claims.get(id) ?? null;
  }
  async hasRejectedClaim(publicationId: string, claimantId: string) {
    return this.db
      .claimsOf(publicationId)
      .some((claim) => claim.claimantId === claimantId && claim.status === "rejected");
  }
  async findOpenClaim(publicationId: string, claimantId: string) {
    return (
      this.db
        .claimsOf(publicationId)
        .find(
          (claim) =>
            claim.claimantId === claimantId && ["pending", "approved"].includes(claim.status),
        ) ?? null
    );
  }
  async listClaimsByPublication(publicationId: string) {
    return this.db.claimsOf(publicationId);
  }
  async listClaimsByClaimant(claimantId: string) {
    return [...this.db.claims.values()].filter((claim) => claim.claimantId === claimantId);
  }
  async listResponses(claimIds: string[]) {
    return this.db.responses.filter((response) => claimIds.includes(response.claimId));
  }
  async submitClaim(
    publicationId: string,
    claimantId: string,
    answers: { questionId: string; answer: string }[],
  ) {
    const id = randomUUID();
    this.db.claims.set(id, {
      id,
      publicationId,
      claimantId,
      status: "pending",
      reviewedAt: null,
      createdAt: now(),
    });
    for (const { questionId, answer } of answers) {
      const question = this.db.questions.get(questionId)!.question;
      this.db.responses.push({ claimId: id, questionId, question, answer });
    }
    return id;
  }
  async approveClaim(claimId: string, publisherId: string) {
    const claim = this.db.claims.get(claimId)!;
    this.db.updateClaim(claimId, "approved");
    this.db.updatePublication(claim.publicationId, "in_process");
    const id = randomUUID();
    this.db.chats.set(id, {
      id,
      claimId,
      publisherId,
      claimantId: claim.claimantId,
      closedAt: null,
      createdAt: now(),
    });
    return id;
  }
  async rejectIfPending(claimId: string) {
    if (this.db.claims.get(claimId)?.status !== "pending") return false;
    this.db.updateClaim(claimId, "rejected");
    return true;
  }
  async cancelClaim(claimId: string) {
    const claim = this.db.claims.get(claimId)!;
    this.db.updateClaim(claimId, "cancelled");
    if (claim.status === "approved") {
      this.db.updatePublication(claim.publicationId, "active");
      this.db.closeChatOf(claimId);
    }
  }
}

class FakeChats implements ChatRepository {
  constructor(private readonly db: FakeDatabase) {}

  async findById(id: string) {
    return this.db.chats.get(id) ?? null;
  }
  async listByParticipant(userId: string) {
    return [...this.db.chats.values()].filter(
      (chat) => chat.publisherId === userId || chat.claimantId === userId,
    );
  }
  async listMessages(chatId: string, limit: number) {
    return this.db.messages.filter((message) => message.chatId === chatId).slice(0, limit);
  }
  async addMessage(chatId: string, senderId: string, content: string) {
    const message = { id: randomUUID(), chatId, senderId, content, createdAt: now() };
    this.db.messages.push(message);
    return message;
  }
}

class FakeReports implements ReportsRepository {
  constructor(private readonly db: FakeDatabase) {}

  private isOpen(report: Report) {
    return report.status === "pending" || report.status === "reviewing";
  }
  async create(report: NewReport) {
    const id = randomUUID();
    const created: Report = {
      ...report,
      id,
      status: "pending",
      reviewedBy: null,
      reviewedAt: null,
      createdAt: now(),
    };
    this.db.reports.set(id, created);
    return created;
  }
  async hasOpenReport(reporterId: string, target: ReportTarget) {
    return [...this.db.reports.values()].some(
      (report) =>
        report.reporterId === reporterId &&
        this.isOpen(report) &&
        report.targetPublicationId === target.targetPublicationId &&
        report.targetUserId === target.targetUserId,
    );
  }
  async hasOpenReportsOnPublication(publicationId: string) {
    return [...this.db.reports.values()].some(
      (report) => report.targetPublicationId === publicationId && this.isOpen(report),
    );
  }
  async findById(id: string) {
    return this.db.reports.get(id) ?? null;
  }
  async list(filters: ReportFilters) {
    const items = [...this.db.reports.values()].filter(
      (report) => !filters.status || report.status === filters.status,
    );
    return { items, total: items.length };
  }
  async closeIfOpen(id: string, reviewerId: string, decision: ReportDecision) {
    const report = this.db.reports.get(id);
    if (!report || !this.isOpen(report)) return null;
    const closed = { ...report, status: decision, reviewedBy: reviewerId, reviewedAt: now() };
    this.db.reports.set(id, closed);
    return closed;
  }
}

class FakeAdmin implements AdminRepository {
  constructor(private readonly db: FakeDatabase) {}

  async findPublications(ids: string[]) {
    return ids.flatMap((id) => {
      const publication = this.db.publications.get(id);
      if (!publication) return [];
      const { userId, title, description, status } = publication;
      return [{ id, userId, title, description, status }];
    });
  }
  async moderatePublication(id: string, status: "removed" | "suspended") {
    this.db.updatePublication(id, status);
    for (const claim of this.db.claimsOf(id)) {
      if (claim.status === "pending" || claim.status === "approved") {
        this.db.updateClaim(claim.id, "cancelled");
        this.db.closeChatOf(claim.id);
      }
    }
  }
  async reactivateIfSuspended(id: string) {
    if (this.db.publications.get(id)?.status !== "suspended") return false;
    this.db.updatePublication(id, "active");
    return true;
  }
}

export interface TestUser extends Actor {
  token: string;
  email: string;
}

export function createTestContext() {
  const db = new FakeDatabase();
  const users = new FakeUsers(db);
  const publicaciones = new FakePublicaciones(db);
  const reportes = new FakeReports(db);

  const services: AppServices = {
    autenticacion: new AutenticacionService(users, ["udg.mx", "alumnos.udg.mx"]),
    publicaciones: new PublicacionesService(publicaciones, new FakeStorage(db), users),
    verificacion: new VerificacionService(new FakeVerificacion(db), publicaciones, users),
    chat: new ChatService(new FakeChats(db), users),
    campuses: new CampusesService({
      listActive: async () => db.campuses,
      isActive: async (campusId) => db.campuses.some((campus) => campus.id === campusId),
      listActiveLocations: async (campusId) =>
        db.locations.filter((location) => location.campusId === campusId),
    }),
    categories: new CategoriesService({ listActive: async () => db.categories }),
    reports: new ReportsService(reportes, publicaciones, users),
    admin: new AdminService(new FakeAdmin(db), reportes, users),
  };

  // Registra una sesión; con profile=false simula a quien aún no tiene perfil.
  function addUser(
    name: string,
    options: {
      email?: string;
      confirmed?: boolean;
      profile?: boolean;
      status?: UserProfile["status"];
      role?: UserProfile["role"];
    } = {},
  ): TestUser {
    const id = randomUUID();
    const token = `token-${name}`;
    const email = options.email ?? `${name}@alumnos.udg.mx`;
    const role = options.role ?? "user";

    db.sessions.set(token, { id, email, emailConfirmed: options.confirmed ?? true });
    if (options.profile !== false) {
      db.profiles.set(id, {
        id,
        displayName: name,
        campusId: null,
        role,
        status: options.status ?? "active",
        createdAt: now(),
      });
    }

    return { id, role, token, email };
  }

  return { db, services, addUser };
}

export const foundPublication = (overrides: Partial<Omit<NewPublication, "userId">> = {}) => ({
  campusId: randomUUID(),
  locationId: null,
  categoryId: randomUUID(),
  type: "found" as const,
  title: "Cartera negra",
  description: "Encontrada en la biblioteca",
  eventDate: "2026-11-01",
  questions: ["¿De qué color es el interior?", "¿Qué credencial contiene?"],
  ...overrides,
});
