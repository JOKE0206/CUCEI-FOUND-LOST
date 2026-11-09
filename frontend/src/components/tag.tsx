"use client";

import Image from "next/image";
import Link from "next/link";
import { useCatalog } from "@/lib/catalog";
import { formatDay, KIND_LABEL, PUBLICATION_STATUS_LABEL } from "@/lib/format";
import type { Publication } from "@/lib/types";

// La etiqueta: una publicación en el listado. Relleno y texto dicen lo mismo,
// para que el tipo nunca dependa solo de la forma.
export function PublicationTag({ publication, eager = false }: { publication: Publication; eager?: boolean }) {
  const { locationName } = useCatalog();
  const cover = publication.photos[0];
  const place = locationName(publication.locationId);

  return (
    <Link href={`/publicaciones/${publication.id}`} className="tag" data-kind={publication.type}>
      <span aria-hidden="true" className="tag-hole" />
      {cover && (
        <div className="relative aspect-[4/3] bg-superficie">
          <Image src={cover.url} alt="" fill unoptimized loading={eager ? "eager" : "lazy"} className="object-cover" sizes="(min-width: 1024px) 24rem, 100vw" />
        </div>
      )}
      <div className={`px-4 pb-4 ${cover ? "pt-3" : "pt-8"}`}>
        <div className="flex flex-wrap items-center gap-2">
          <span className="kind-label">{KIND_LABEL[publication.type]}</span>
          {publication.status !== "active" && (
            <span className="status-label">{PUBLICATION_STATUS_LABEL[publication.status]}</span>
          )}
        </div>
        <h2 className="object-title mt-2 text-[1.625rem]">{publication.title}</h2>
        <p className="mt-1 font-medium opacity-85">
          {[place, formatDay(publication.eventDate)].filter(Boolean).join(", ")}
        </p>
      </div>
    </Link>
  );
}

export function TagListSkeleton() {
  return (
    <div role="status" className="grid gap-4 lg:grid-cols-2">
      <span className="sr-only">Cargando objetos</span>
      {[0, 1, 2, 3].map((item) => (
        <div key={item} className="placeholder-block h-64" />
      ))}
    </div>
  );
}
