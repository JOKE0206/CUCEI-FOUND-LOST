"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { FilterIcon } from "@/components/icons";
import { Sheet } from "@/components/sheet";
import { PublicationTag, TagListSkeleton } from "@/components/tag";
import { EmptyState, ErrorState, Field, Segmented } from "@/components/ui";
import { api, buildQuery, errorMessage } from "@/lib/api";
import { useCatalog } from "@/lib/catalog";
import { localToday } from "@/lib/format";
import type { Paginated, Publication, PublicationType } from "@/lib/types";
import { useApi } from "@/lib/use-api";
import { toast } from "sonner";

const PAGE_SIZE = 20;
const FILTER_KEYS = ["campusId", "locationId", "categoryId", "dateFrom", "dateTo"] as const;
type TypeFilter = PublicationType | "all";

function FilterFields({
  read,
  write,
  clear,
  activeCount,
}: {
  read: (key: string) => string;
  write: (changes: Record<string, string>) => void;
  clear: () => void;
  activeCount: number;
}) {
  const { campuses, categories, locationsOf } = useCatalog();
  const [today] = useState(localToday);
  const campusId = read("campusId");
  const locations = campusId ? locationsOf(campusId) : [];

  return (
    <div className="space-y-4">
      <Field label="Campus">
        {(props) => (
          <select
            {...props}
            className="control"
            value={campusId}
            onChange={(event) => write({ campusId: event.target.value, locationId: "" })}
          >
            <option value="">Todos</option>
            {campuses.map((campus) => (
              <option key={campus.id} value={campus.id}>
                {campus.name}
              </option>
            ))}
          </select>
        )}
      </Field>

      {locations.length > 0 && (
        <Field label="Ubicación">
          {(props) => (
            <select
              {...props}
              className="control"
              value={read("locationId")}
              onChange={(event) => write({ locationId: event.target.value })}
            >
              <option value="">Todas</option>
              {locations.map((location) => (
                <option key={location.id} value={location.id}>
                  {location.name}
                </option>
              ))}
            </select>
          )}
        </Field>
      )}

      <Field label="Categoría">
        {(props) => (
          <select
            {...props}
            className="control"
            value={read("categoryId")}
            onChange={(event) => write({ categoryId: event.target.value })}
          >
            <option value="">Todas</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
        )}
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Desde">
          {(props) => (
            <input
              {...props}
              className="control"
              type="date"
              max={read("dateTo") || today}
              value={read("dateFrom")}
              onChange={(event) => write({ dateFrom: event.target.value })}
            />
          )}
        </Field>
        <Field label="Hasta">
          {(props) => (
            <input
              {...props}
              className="control"
              type="date"
              min={read("dateFrom") || undefined}
              max={today}
              value={read("dateTo")}
              onChange={(event) => write({ dateTo: event.target.value })}
            />
          )}
        </Field>
      </div>

      {activeCount > 0 && (
        <button type="button" className="btn-link" onClick={clear}>
          Quitar filtros
        </button>
      )}
    </div>
  );
}

export default function BuscarPage() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [extra, setExtra] = useState<{ query: string; items: Publication[]; page: number }>({
    query: "",
    items: [],
    page: 1,
  });
  const [loadingMore, setLoadingMore] = useState(false);

  const read = (key: string) => params.get(key) ?? "";
  const typeFilter = (read("type") || "all") as TypeFilter;
  const activeCount = FILTER_KEYS.filter((key) => read(key)).length;

  const filterQuery = buildQuery({
    type: typeFilter === "all" ? undefined : typeFilter,
    ...Object.fromEntries(FILTER_KEYS.map((key) => [key, read(key)])),
  });
  const separator = filterQuery ? "&" : "?";

  const firstPage = useApi<Paginated<Publication>>(`/publicaciones${filterQuery}${separator}page=1&pageSize=${PAGE_SIZE}`);

  // Las páginas extra solo valen para los filtros con los que se pidieron.
  const appended = extra.query === filterQuery ? extra : { items: [], page: 1 };
  const items = [...(firstPage.data?.items ?? []), ...appended.items];
  const total = firstPage.data?.total ?? 0;

  function write(changes: Record<string, string>) {
    const next = new URLSearchParams(params.toString());
    for (const [key, value] of Object.entries(changes)) {
      if (value) next.set(key, value);
      else next.delete(key);
    }
    const text = next.toString();
    router.replace(text ? `${pathname}?${text}` : pathname, { scroll: false });
  }

  function clear() {
    write(Object.fromEntries(FILTER_KEYS.map((key) => [key, ""])));
  }

  async function loadMore() {
    const page = appended.page + 1;
    setLoadingMore(true);
    try {
      const result = await api<Paginated<Publication>>(
        `/publicaciones${filterQuery}${separator}page=${page}&pageSize=${PAGE_SIZE}`,
      );
      setExtra({ query: filterQuery, items: [...appended.items, ...result.items], page });
    } catch (caught) {
      toast.error(errorMessage(caught));
    } finally {
      setLoadingMore(false);
    }
  }

  const filterFields = <FilterFields read={read} write={write} clear={clear} activeCount={activeCount} />;

  return (
    <main className="mx-auto max-w-6xl px-4 pt-[calc(1.25rem+env(safe-area-inset-top,0px))] lg:px-6 lg:pt-8">
      <h1 className="page-title">Objetos en el campus</h1>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <Segmented<TypeFilter>
          label="Tipo de publicación"
          value={typeFilter}
          options={[
            { value: "all", label: "Todos" },
            { value: "found", label: "Encontrados" },
            { value: "lost", label: "Perdidos" },
          ]}
          onChange={(value) => write({ type: value === "all" ? "" : value })}
        />
        <button type="button" className="btn btn-secondary lg:hidden" onClick={() => setFiltersOpen(true)}>
          <FilterIcon width={20} height={20} />
          Filtros{activeCount > 0 ? ` (${activeCount})` : ""}
        </button>
      </div>

      <div className="mt-6 lg:grid lg:grid-cols-[17rem_1fr] lg:gap-10">
        <aside aria-label="Filtros" className="hidden lg:block">
          {filterFields}
        </aside>

        <section aria-label="Resultados" aria-busy={firstPage.loading}>
          {firstPage.error && !firstPage.data ? (
            <ErrorState message={firstPage.error.message} onRetry={firstPage.reload} />
          ) : !firstPage.data ? (
            <TagListSkeleton />
          ) : items.length === 0 ? (
            <EmptyState
              title="Nada por aquí con estos filtros"
              description="Quita algún filtro o publica lo que perdiste o encontraste."
              action={
                <Link href="/publicar" className="btn btn-primary">
                  Publicar un objeto
                </Link>
              }
            />
          ) : (
            <>
              <div className="grid items-start gap-4 lg:grid-cols-2">
                {items.map((publication, index) => (
                  <PublicationTag key={publication.id} publication={publication} eager={index < 4} />
                ))}
              </div>
              {items.length < total && (
                <button type="button" className="btn btn-secondary mt-6 w-full lg:w-auto" disabled={loadingMore} onClick={loadMore}>
                  {loadingMore ? "Cargando" : "Ver más objetos"}
                </button>
              )}
            </>
          )}
        </section>
      </div>

      <Sheet open={filtersOpen} onOpenChange={setFiltersOpen} title="Filtros">
        <div className="space-y-5">
          {filterFields}
          <button type="button" className="btn btn-primary w-full" onClick={() => setFiltersOpen(false)}>
            Ver resultados
          </button>
        </div>
      </Sheet>
    </main>
  );
}
