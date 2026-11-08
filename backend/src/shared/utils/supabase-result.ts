import { AppError, conflict, forbidden, notFound, unprocessable } from "./app-error";

interface DatabaseError {
  code?: string;
  message: string;
}

interface DatabaseResult {
  data: unknown;
  error: DatabaseError | null;
}

// Solo los errores previstos llegan al cliente. Cualquier otro se convierte en
// un 500 genérico para no revelar detalles internos de la base de datos.
function toApplicationError(error: DatabaseError): Error {
  switch (error.code) {
    // Códigos propios de backend/database/functions.sql y mensajes de sus triggers.
    case "CF403":
      return forbidden("SIN_PERMISO", error.message);
    case "CF404":
      return notFound(error.message);
    case "CF409":
    case "P0001":
      return conflict("ESTADO_NO_VALIDO", error.message);
    case "CF422":
      return unprocessable("DATOS_NO_VALIDOS", error.message);
    // Restricciones estándar de PostgreSQL.
    case "23505":
      return conflict("DUPLICADO", "El registro ya existe");
    case "23503":
      return unprocessable("REFERENCIA_NO_VALIDA", "Alguna referencia no existe o no es válida");
    case "23514":
      return unprocessable("DATOS_NO_VALIDOS", "Los datos no cumplen las restricciones");
    default:
      return new Error(`Error de Supabase ${error.code ?? "desconocido"}: ${error.message}`);
  }
}

export function unwrap<T>(result: DatabaseResult): T {
  if (result.error) throw toApplicationError(result.error);
  return result.data as T;
}

export function isAppError(error: unknown): error is AppError {
  return error instanceof AppError;
}
