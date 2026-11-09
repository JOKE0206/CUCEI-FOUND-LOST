"use client";

import Link from "next/link";
import { useAuth, useCurrentProfile } from "@/lib/auth";
import { useCatalog } from "@/lib/catalog";

export default function PerfilPage() {
  const profile = useCurrentProfile();
  const { signOut } = useAuth();
  const { campusName } = useCatalog();

  return (
    <main className="mx-auto max-w-xl px-4 pt-[calc(1.25rem+env(safe-area-inset-top,0px))] lg:pt-8">
      <h1 className="page-title wrap-anywhere">{profile.displayName}</h1>

      <dl className="mt-5 grid grid-cols-[auto_1fr] gap-x-4 gap-y-2">
        <dt className="muted">Correo</dt>
        <dd className="break-all">{profile.email}</dd>
        <dt className="muted">Campus</dt>
        <dd>{(profile.campusId && campusName(profile.campusId)) ?? "Sin campus"}</dd>
      </dl>
      <p className="muted prose-body mt-3 text-sm">Tu correo es privado. Los demás solo ven tu nombre.</p>

      <div className="mt-6 space-y-3">
        {profile.role === "admin" && (
          <Link href="/admin" className="btn btn-primary w-full">
            Atender reportes
          </Link>
        )}
        <button type="button" className="btn btn-secondary w-full" onClick={signOut}>
          Cerrar sesión
        </button>
      </div>
    </main>
  );
}
