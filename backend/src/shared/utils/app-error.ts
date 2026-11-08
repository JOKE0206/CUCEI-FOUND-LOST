// Error esperado de la aplicación: su mensaje se puede mostrar al cliente.
export class AppError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "AppError";
  }
}

export const unauthorized = (message = "Se requiere iniciar sesión") =>
  new AppError(401, "NO_AUTENTICADO", message);

export const forbidden = (code: string, message: string) =>
  new AppError(403, code, message);

export const notFound = (message = "Recurso no encontrado") =>
  new AppError(404, "NO_ENCONTRADO", message);

export const conflict = (code: string, message: string) =>
  new AppError(409, code, message);

export const unprocessable = (code: string, message: string) =>
  new AppError(422, code, message);
