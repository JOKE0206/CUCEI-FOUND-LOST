"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { PublicationTag, TagListSkeleton } from "@/components/tag";
import { EmptyState, ErrorState, LoadingState, Segmented } from "@/components/ui";
import { api } from "@/lib/api";
import { CLAIM_STATUS_LABEL, formatDateTime } from "@/lib/format";
import type { Claim, Publication } from "@/lib/types";
import { useApi } from "@/lib/use-api";

type Tab = "publicaciones" | "reclamaciones";

function MyPublications() {
  const publications = useApi<Publication[]>("/publicaciones/mias");

  if (publications.error && !publications.data) {
    return <ErrorState message={publications.error.message} onRetry={publications.reload} />;
  }
  if (!publications.data) return <TagListSkeleton />;
  if (publications.data.length === 0) {
    return (
      <EmptyState
        title="Aún no has publicado nada"
        description="Publica lo que perdiste o encontraste en el campus."
        action={
          <Link href="/publicar" className="btn btn-primary">
            Publicar un objeto
          </Link>
        }
      />
    );
  }

  return (
    <div className="grid items-start gap-4 lg:grid-cols-2">
      {publications.data.map((publication) => (
        <PublicationTag key={publication.id} publication={publication} />
      ))}
    </div>
  );
}

function MyClaims() {
  const claims = useApi<Claim[]>("/reclamaciones/mias");
  const [titles, setTitles] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!claims.data) return;
    let active = true;
    const ids = [...new Set(claims.data.map((claim) => claim.publicationId))];

    // Una publicación moderada ya no se puede abrir; la reclamación se sigue listando.
    Promise.allSettled(ids.map((id) => api<Publication>(`/publicaciones/${id}`))).then((results) => {
      if (!active) return;
      setTitles(
        Object.fromEntries(
          results.flatMap((result) => (result.status === "fulfilled" ? [[result.value.id, result.value.title]] : [])),
        ),
      );
    });

    return () => {
      active = false;
    };
  }, [claims.data]);

  if (claims.error && !claims.data) return <ErrorState message={claims.error.message} onRetry={claims.reload} />;
  if (!claims.data) return <LoadingState label="Cargando reclamaciones" />;
  if (claims.data.length === 0) {
    return <EmptyState title="Aún no has reclamado ningún objeto" description="Cuando reclames uno, aquí verás cómo va." />;
  }

  return (
    <ul className="divide-y divide-linea">
      {claims.data.map((claim) => (
        <li key={claim.id}>
          <Link href={`/publicaciones/${claim.publicationId}`} className="flex min-h-16 items-center justify-between gap-3 py-3">
            <span className="min-w-0">
              <span className="block font-semibold wrap-anywhere">{titles[claim.publicationId] ?? "Objeto"}</span>
              <span className="muted block text-sm">{formatDateTime(claim.createdAt)}</span>
            </span>
            <span className="status-label shrink-0">{CLAIM_STATUS_LABEL[claim.status]}</span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

export default function ActividadPage() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const tab: Tab = params.get("ver") === "reclamaciones" ? "reclamaciones" : "publicaciones";

  return (
    <main className="mx-auto max-w-6xl px-4 pt-[calc(1.25rem+env(safe-area-inset-top,0px))] lg:px-6 lg:pt-8">
      <h1 className="page-title">Tu actividad</h1>
      <div className="mt-4">
        <Segmented<Tab>
          label="Ver"
          value={tab}
          options={[
            { value: "publicaciones", label: "Publicaciones" },
            { value: "reclamaciones", label: "Reclamaciones" },
          ]}
          onChange={(value) => router.replace(`${pathname}?ver=${value}`, { scroll: false })}
        />
      </div>
      <div className="mt-5 max-w-4xl">{tab === "publicaciones" ? <MyPublications /> : <MyClaims />}</div>
    </main>
  );
}
