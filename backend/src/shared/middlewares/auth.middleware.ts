import type { NextFunction, Request, Response } from "express";
import { forbidden, unauthorized } from "../utils/app-error";

// Identidad verificada contra Supabase Auth a partir del token de la petición.
export interface SessionUser {
  id: string;
  email: string | null;
  emailConfirmed: boolean;
}

// Usuario con perfil activo y dominio permitido: el único que opera el sistema.
export interface Actor {
  id: string;
  role: "user" | "admin";
}

export interface Authenticator {
  authenticate(token: string): Promise<SessionUser>;
  resolveActor(session: SessionUser): Promise<Actor>;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      sessionUser?: SessionUser;
      actor?: Actor;
    }
  }
}

function readBearerToken(req: Request): string {
  const [scheme, token] = req.headers.authorization?.split(" ") ?? [];
  if (scheme?.toLowerCase() !== "bearer" || !token) throw unauthorized();
  return token;
}

export function createAuthMiddlewares(authenticator: Authenticator) {
  const requireSession = async (req: Request, _res: Response, next: NextFunction) => {
    req.sessionUser = await authenticator.authenticate(readBearerToken(req));
    next();
  };

  const loadActor = async (req: Request): Promise<Actor> => {
    const session = await authenticator.authenticate(readBearerToken(req));
    const actor = await authenticator.resolveActor(session);
    req.sessionUser = session;
    req.actor = actor;
    return actor;
  };

  const requireActiveUser = async (req: Request, _res: Response, next: NextFunction) => {
    await loadActor(req);
    next();
  };

  // El rol sale del perfil en la base de datos, nunca del token ni de la petición.
  const requireAdmin = async (req: Request, _res: Response, next: NextFunction) => {
    assertAdmin(await loadActor(req));
    next();
  };

  return { requireSession, requireActiveUser, requireAdmin };
}

export function assertAdmin(actor: Actor): void {
  if (actor.role !== "admin") {
    throw forbidden("ADMIN_REQUERIDO", "Esta acción requiere permisos de administración");
  }
}

export type AuthMiddlewares = ReturnType<typeof createAuthMiddlewares>;

// La identidad siempre sale de estas funciones, nunca del cuerpo de la petición.
export function getActor(req: Request): Actor {
  if (!req.actor) throw unauthorized();
  return req.actor;
}

export function getSessionUser(req: Request): SessionUser {
  if (!req.sessionUser) throw unauthorized();
  return req.sessionUser;
}
