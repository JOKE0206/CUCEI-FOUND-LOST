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

// Lo único que una persona puede saber de otra.
export interface PublicProfile {
  id: string;
  displayName: string;
}

export interface NewProfile {
  id: string;
  displayName: string;
  campusId: string | null;
}
