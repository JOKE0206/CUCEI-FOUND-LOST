import type { NextFunction, Request, Response } from "express";
import { ZodError } from "zod";
import { AppError, notFound } from "../utils/app-error";

export function notFoundHandler(_req: Request, _res: Response, next: NextFunction) {
  next(notFound("Ruta no encontrada"));
}

export function errorHandler(error: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (error instanceof AppError) {
    res.status(error.status).json({ error: { code: error.code, message: error.message } });
    return;
  }

  if (error instanceof ZodError) {
    res.status(400).json({
      error: {
        code: "PETICION_NO_VALIDA",
        message: "Los datos enviados no son válidos",
        details: error.issues.map((issue) => ({
          path: issue.path.join("."),
          message: issue.message,
        })),
      },
    });
    return;
  }

  // Errores del propio Express, como un JSON mal formado o demasiado grande.
  const status = (error as { status?: number }).status;
  if (status && status >= 400 && status < 500) {
    res.status(status).json({
      error: { code: "PETICION_NO_VALIDA", message: "La petición no es válida" },
    });
    return;
  }

  console.error(error);
  res.status(500).json({ error: { code: "ERROR_INTERNO", message: "Error interno del servidor" } });
}
