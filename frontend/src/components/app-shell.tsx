"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Suspense, useEffect, type ReactNode } from "react";
import { ChatIcon, PlusIcon, SearchIcon, TagIcon, UserIcon } from "./icons";
import { ErrorState, LoadingState } from "./ui";
import { useAuth } from "@/lib/auth";
import { CatalogProvider } from "@/lib/catalog";

const LINKS = [
  { href: "/", label: "Buscar", Icon: SearchIcon },
  { href: "/publicar", label: "Publicar", Icon: PlusIcon },
  { href: "/actividad", label: "Actividad", Icon: TagIcon },
  { href: "/chats", label: "Chats", Icon: ChatIcon },
  { href: "/perfil", label: "Perfil", Icon: UserIcon },
];

function isCurrent(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
}

function FullPageMessage({ title, children }: { title: string; children: ReactNode }) {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-5 py-10">
      <h1 className="page-title">{title}</h1>
      <div className="mt-3 space-y-4">{children}</div>
    </main>
  );
}

function Shell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  // El chat ocupa toda la pantalla: su caja de texto toma el lugar de la navegación.
  const inChatRoom = /^\/chats\/[^/]+$/.test(pathname);

  return (
    <CatalogProvider>
      <header className="sticky top-0 z-30 hidden border-b border-linea bg-pizarron lg:block">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
          <Link href="/" className="object-title text-[1.375rem]">
            CUCEI Found &amp; Lost
          </Link>
          <nav aria-label="Principal" className="flex gap-6">
            {LINKS.map(({ href, label }) => (
              <Link key={href} href={href} className="nav-link" aria-current={isCurrent(pathname, href) ? "page" : undefined}>
                {label}
              </Link>
            ))}
          </nav>
        </div>
      </header>

      <div className={inChatRoom ? "" : "pb-24 lg:pb-10"}>
        <Suspense fallback={<div className="mx-auto max-w-2xl px-4 py-6"><LoadingState /></div>}>{children}</Suspense>
      </div>

      {!inChatRoom && (
        <nav aria-label="Principal" className="bottom-safe fixed inset-x-0 bottom-0 z-30 border-t border-linea bg-pizarron lg:hidden">
          <div className="flex">
            {LINKS.map(({ href, label, Icon }) => (
              <Link key={href} href={href} className="nav-item" aria-current={isCurrent(pathname, href) ? "page" : undefined}>
                <Icon width={22} height={22} />
                {label}
              </Link>
            ))}
          </div>
        </nav>
      )}
    </CatalogProvider>
  );
}

// Decide si la persona puede entrar. El backend sigue siendo quien autoriza.
export function AppGate({ children }: { children: ReactNode }) {
  const { auth, refresh, signOut } = useAuth();
  const router = useRouter();

  const needsProfile =
    auth.status === "signed-in" && !auth.me.profile && auth.me.allowedDomain && auth.me.emailConfirmed;

  useEffect(() => {
    if (auth.status === "signed-out") router.replace("/entrar");
    else if (needsProfile) router.replace("/completar-perfil");
  }, [auth.status, needsProfile, router]);

  if (auth.status === "error") {
    return (
      <FullPageMessage title="No pudimos cargar tu cuenta">
        <ErrorState message={auth.error.message} onRetry={refresh} />
      </FullPageMessage>
    );
  }

  if (auth.status !== "signed-in" || needsProfile) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-6">
        <LoadingState label="Abriendo tu cuenta" />
      </div>
    );
  }

  const signOutButton = (
    <button type="button" className="btn btn-secondary" onClick={signOut}>
      Cerrar sesión
    </button>
  );

  if (!auth.me.allowedDomain) {
    return (
      <FullPageMessage title="Esa cuenta no es institucional">
        <p className="prose-body">Entra con tu correo @alumnos.udg.mx o @udg.mx.</p>
        {signOutButton}
      </FullPageMessage>
    );
  }

  if (!auth.me.emailConfirmed) {
    return (
      <FullPageMessage title="Confirma tu correo">
        <p className="prose-body">Abre el enlace que te enviamos y vuelve a entrar.</p>
        {signOutButton}
      </FullPageMessage>
    );
  }

  if (auth.me.profile?.status === "suspended") {
    return (
      <FullPageMessage title="Tu cuenta está suspendida">
        <p className="prose-body">Mientras siga suspendida no puedes publicar, reclamar ni conversar.</p>
        {signOutButton}
      </FullPageMessage>
    );
  }

  return <Shell>{children}</Shell>;
}
