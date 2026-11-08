import { notFound } from "../../shared/utils/app-error";
import type { Campus, Location } from "./campuses.entity";
import type { CampusesRepository } from "./campuses.repository";

export class CampusesService {
  constructor(private readonly repository: CampusesRepository) {}

  listActive(): Promise<Campus[]> {
    return this.repository.listActive();
  }

  async listLocations(campusId: string): Promise<Location[]> {
    if (!(await this.repository.isActive(campusId))) throw notFound("Campus no encontrado");
    return this.repository.listActiveLocations(campusId);
  }
}
