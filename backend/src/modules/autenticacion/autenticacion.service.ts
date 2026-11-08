import type {
  Actor,
  Authenticator,
  SessionUser,
} from "../../shared/middlewares/auth.middleware";
import { conflict, forbidden, unauthorized } from "../../shared/utils/app-error";
import type { UserProfile } from "./autenticacion.entity";
import type { AutenticacionRepository } from "./autenticacion.repository";

// El dominio debe coincidir exacto: "x.udg.mx" o "udg.mx.otro.com" no pasan.
export function isAllowedInstitutionalEmail(
  email: string | null | undefined,
  allowedDomains: readonly string[],
): boolean {
  if (!email) return false;

  const normalized = email.trim().toLowerCase();
  const match = /^[^\s@]+@([^\s@]+)$/.exec(normalized);
  if (!match) return false;

  return allowedDomains.some((domain) => domain.toLowerCase() === match[1]);
}

export interface CurrentUser {
  id: string;
  email: string | null;
  emailConfirmed: boolean;
  allowedDomain: boolean;
  profile: UserProfile | null;
}

export class AutenticacionService implements Authenticator {
  constructor(
    private readonly repository: AutenticacionRepository,
    private readonly allowedDomains: readonly string[],
  ) {}

  async authenticate(token: string): Promise<SessionUser> {
    const session = await this.repository.findSessionUser(token);
    if (!session) throw unauthorized("La sesión no es válida o expiró");
    return session;
  }

  async resolveActor(session: SessionUser): Promise<Actor> {
    this.assertInstitutionalIdentity(session);

    const profile = await this.repository.findProfile(session.id);
    if (!profile) {
      throw forbidden("PERFIL_REQUERIDO", "Debes completar tu perfil para continuar");
    }
    if (profile.status !== "active") {
      throw forbidden("CUENTA_SUSPENDIDA", "Tu cuenta está suspendida");
    }

    return { id: profile.id, role: profile.role };
  }

  async getCurrentUser(session: SessionUser): Promise<CurrentUser> {
    return {
      id: session.id,
      email: session.email,
      emailConfirmed: session.emailConfirmed,
      allowedDomain: isAllowedInstitutionalEmail(session.email, this.allowedDomains),
      profile: await this.repository.findProfile(session.id),
    };
  }

  async createProfile(
    session: SessionUser,
    input: { displayName: string; campusId: string | null },
  ): Promise<UserProfile> {
    this.assertInstitutionalIdentity(session);

    if (await this.repository.findProfile(session.id)) {
      throw conflict("PERFIL_EXISTENTE", "Ya tienes un perfil");
    }

    return this.repository.createProfile({ id: session.id, ...input });
  }

  private assertInstitutionalIdentity(session: SessionUser): void {
    if (!isAllowedInstitutionalEmail(session.email, this.allowedDomains)) {
      throw forbidden("DOMINIO_NO_PERMITIDO", "Debes usar tu correo institucional");
    }
    if (!session.emailConfirmed) {
      throw forbidden("CORREO_NO_CONFIRMADO", "Debes confirmar tu correo");
    }
  }
}
