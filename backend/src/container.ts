import { env } from "./config/env";
import { SupabaseAdminRepository } from "./modules/admin/admin.repository";
import { AdminService } from "./modules/admin/admin.service";
import { SupabaseAutenticacionRepository } from "./modules/autenticacion/autenticacion.repository";
import { AutenticacionService } from "./modules/autenticacion/autenticacion.service";
import { SupabaseCampusesRepository } from "./modules/campuses/campuses.repository";
import { CampusesService } from "./modules/campuses/campuses.service";
import { SupabaseCategoriesRepository } from "./modules/categories/categories.repository";
import { CategoriesService } from "./modules/categories/categories.service";
import { SupabaseChatRepository } from "./modules/chat/chat.repository";
import { ChatService } from "./modules/chat/chat.service";
import {
  SupabasePhotoStorage,
  SupabasePublicacionesRepository,
} from "./modules/publicaciones/publicaciones.repository";
import { PublicacionesService } from "./modules/publicaciones/publicaciones.service";
import { SupabaseReportsRepository } from "./modules/reports/reports.repository";
import { ReportsService } from "./modules/reports/reports.service";
import { SupabaseVerificacionRepository } from "./modules/verificacion/verificacion.repository";
import { VerificacionService } from "./modules/verificacion/verificacion.service";

export interface AppServices {
  autenticacion: AutenticacionService;
  publicaciones: PublicacionesService;
  verificacion: VerificacionService;
  chat: ChatService;
  campuses: CampusesService;
  categories: CategoriesService;
  reports: ReportsService;
  admin: AdminService;
}

export function createServices(): AppServices {
  const usuarios = new SupabaseAutenticacionRepository();
  const publicaciones = new SupabasePublicacionesRepository();
  const reportes = new SupabaseReportsRepository();

  return {
    autenticacion: new AutenticacionService(usuarios, env.allowedEmailDomains),
    publicaciones: new PublicacionesService(publicaciones, new SupabasePhotoStorage(), usuarios),
    verificacion: new VerificacionService(
      new SupabaseVerificacionRepository(),
      publicaciones,
      usuarios,
    ),
    chat: new ChatService(new SupabaseChatRepository(), usuarios),
    campuses: new CampusesService(new SupabaseCampusesRepository()),
    categories: new CategoriesService(new SupabaseCategoriesRepository()),
    reports: new ReportsService(reportes, publicaciones, usuarios),
    admin: new AdminService(new SupabaseAdminRepository(), reportes, usuarios),
  };
}
