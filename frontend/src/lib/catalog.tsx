"use client";

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { api } from "./api";
import type { Campus, Category, Location } from "./types";
import { useApi } from "./use-api";

interface CatalogValue {
  campuses: Campus[];
  categories: Category[];
  locationsOf: (campusId: string) => Location[];
  campusName: (id: string) => string | undefined;
  categoryName: (id: string) => string | undefined;
  locationName: (id: string | null) => string | undefined;
}

const CatalogContext = createContext<CatalogValue | null>(null);

export function CatalogProvider({ children }: { children: ReactNode }) {
  const campuses = useApi<Campus[]>("/campuses");
  const categories = useApi<Category[]>("/categories");
  const [locations, setLocations] = useState<Location[]>([]);

  useEffect(() => {
    if (!campuses.data) return;
    let active = true;

    // Si un campus falla, los demás siguen disponibles: la ubicación es opcional.
    Promise.allSettled(campuses.data.map((campus) => api<Location[]>(`/campuses/${campus.id}/locations`))).then(
      (results) => {
        if (!active) return;
        setLocations(results.flatMap((result) => (result.status === "fulfilled" ? result.value : [])));
      },
    );

    return () => {
      active = false;
    };
  }, [campuses.data]);

  const value = useMemo<CatalogValue>(
    () => ({
      campuses: campuses.data ?? [],
      categories: categories.data ?? [],
      locationsOf: (campusId) => locations.filter((location) => location.campusId === campusId),
      campusName: (id) => campuses.data?.find((campus) => campus.id === id)?.name,
      categoryName: (id) => categories.data?.find((category) => category.id === id)?.name,
      locationName: (id) => locations.find((location) => location.id === id)?.name,
    }),
    [campuses.data, categories.data, locations],
  );

  return <CatalogContext.Provider value={value}>{children}</CatalogContext.Provider>;
}

export function useCatalog(): CatalogValue {
  const context = useContext(CatalogContext);
  if (!context) throw new Error("useCatalog debe usarse dentro de CatalogProvider");
  return context;
}
