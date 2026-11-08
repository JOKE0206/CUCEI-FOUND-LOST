import type { Category } from "./categories.entity";
import type { CategoriesRepository } from "./categories.repository";

export class CategoriesService {
  constructor(private readonly repository: CategoriesRepository) {}

  listActive(): Promise<Category[]> {
    return this.repository.listActive();
  }
}
