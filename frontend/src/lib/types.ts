// Contratos de la API /api/v1. Reflejan las respuestas del backend.

export type UserRole = "user" | "admin";
export type UserStatus = "active" | "suspended";

export interface UserProfile {
  id: string;
  displayName: string;
  campusId: string | null;
  role: UserRole;
  status: UserStatus;
  createdAt: string;
}

export interface PublicProfile {
  id: string;
  displayName: string;
}

export interface CurrentUser {
  id: string;
  email: string | null;
  emailConfirmed: boolean;
  allowedDomain: boolean;
  profile: UserProfile | null;
}

export interface Campus {
  id: string;
  name: string;
  code: string;
  emailDomain: string | null;
}

export interface Location {
  id: string;
  campusId: string;
  name: string;
}

export interface Category {
  id: string;
  name: string;
}

export type PublicationType = "lost" | "found";
export type PublicationStatus =
  | "active"
  | "in_process"
  | "resolved"
  | "cancelled"
  | "removed"
  | "suspended";

export interface PhotoView {
  id: string;
  position: number;
  url: string;
}

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
  publisher: PublicProfile | null;
  photos: PhotoView[];
}

export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

export interface SignedUpload {
  path: string;
  token: string;
  signedUrl: string;
}

export interface VerificationQuestion {
  id: string;
  publicationId: string;
  question: string;
  position: number;
}

export type ClaimStatus = "pending" | "approved" | "rejected" | "cancelled";

export interface ClaimResponse {
  questionId: string;
  question: string;
  answer: string;
}

export interface Claim {
  id: string;
  publicationId: string;
  claimantId: string;
  status: ClaimStatus;
  reviewedAt: string | null;
  createdAt: string;
  claimant: PublicProfile | null;
  responses: ClaimResponse[];
}

export interface Chat {
  id: string;
  claimId: string;
  publisherId: string;
  claimantId: string;
  closedAt: string | null;
  createdAt: string;
  counterpart: PublicProfile | null;
}

export interface Message {
  id: string;
  chatId: string;
  senderId: string;
  content: string;
  createdAt: string;
}

export type ReportStatus = "pending" | "reviewing" | "resolved" | "dismissed";

export interface ReportedPublication {
  id: string;
  userId: string;
  title: string;
  description: string;
  status: PublicationStatus;
}

export interface AdminReport {
  id: string;
  reporterId: string;
  targetPublicationId: string | null;
  targetUserId: string | null;
  reason: string;
  status: ReportStatus;
  reviewedBy: string | null;
  reviewedAt: string | null;
  createdAt: string;
  reporter: PublicProfile | null;
  targetUser: PublicProfile | null;
  targetPublication: ReportedPublication | null;
}
