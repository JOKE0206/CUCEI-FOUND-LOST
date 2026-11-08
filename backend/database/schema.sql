-- =============================================================================
-- CUCEI Found & Lost: esquema inicial de base de datos (PostgreSQL / Supabase)
--
-- Ejecutar una sola vez en un proyecto sin estas tablas, desde el SQL Editor.
-- Corre dentro de una transacción: si algo falla, no se aplica nada.
-- Explicación de tablas, relaciones y políticas: backend/database/README.md
-- =============================================================================

begin;

-- =============================================================================
-- 1. Esquema privado
-- =============================================================================

-- Las funciones de apoyo viven fuera de "public" para que la API de Supabase
-- no las publique como RPC.
create schema private;
grant usage on schema private to authenticated, service_role;

-- =============================================================================
-- 2. Tipos enumerados
-- =============================================================================

create type public.user_role as enum ('user', 'admin');
create type public.user_status as enum ('active', 'suspended');

create type public.publication_type as enum ('lost', 'found');

-- active      visible para la comunidad y abierta a reclamaciones
-- in_process  tiene una reclamación aprobada y la entrega está en curso
-- resolved    el objeto volvió a su dueño
-- cancelled   retirada por quien publicó
-- removed     retirada por moderación
create type public.publication_status as enum (
  'active', 'in_process', 'resolved', 'cancelled', 'removed'
);

-- Transiciones válidas (ver private.claims_before_update):
--   pending  -> approved | rejected | cancelled
--   approved -> cancelled
create type public.claim_status as enum (
  'pending', 'approved', 'rejected', 'cancelled'
);

create type public.report_status as enum (
  'pending', 'reviewing', 'resolved', 'dismissed'
);

-- =============================================================================
-- 3. Tablas
-- =============================================================================

create table public.campuses (
  id          uuid primary key default gen_random_uuid(),
  name        text not null check (char_length(btrim(name)) between 1 and 120),
  code        text not null check (char_length(btrim(code)) between 1 and 20),
  is_active   boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- Perfil público de la aplicación. El correo se queda en auth.users.
-- Solo el backend crea filas aquí, después de validar el dominio institucional.
create table public.users (
  id            uuid primary key references auth.users (id) on delete cascade,
  display_name  text not null check (char_length(btrim(display_name)) between 1 and 80),
  campus_id     uuid references public.campuses (id) on delete set null,
  role          public.user_role not null default 'user',
  status        public.user_status not null default 'active',
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create table public.categories (
  id          uuid primary key default gen_random_uuid(),
  name        text not null check (char_length(btrim(name)) between 1 and 80),
  is_active   boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table public.locations (
  id          uuid primary key default gen_random_uuid(),
  campus_id   uuid not null references public.campuses (id) on delete restrict,
  name        text not null check (char_length(btrim(name)) between 1 and 120),
  is_active   boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  -- Destino de la llave compuesta de publications.
  constraint locations_id_campus_key unique (id, campus_id)
);

create table public.publications (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references public.users (id) on delete cascade,
  campus_id    uuid not null references public.campuses (id) on delete restrict,
  location_id  uuid,
  category_id  uuid not null references public.categories (id) on delete restrict,
  type         public.publication_type not null,
  status       public.publication_status not null default 'active',
  title        text not null check (char_length(btrim(title)) between 3 and 120),
  description  text not null check (char_length(btrim(description)) between 1 and 2000),
  event_date   date not null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  -- La ubicación, si se indica, debe pertenecer al campus de la publicación.
  constraint publications_location_campus_fkey
    foreign key (location_id, campus_id)
    references public.locations (id, campus_id) on delete restrict
);

create table public.photos (
  id              uuid primary key default gen_random_uuid(),
  publication_id  uuid not null references public.publications (id) on delete cascade,
  -- Ruta dentro de Supabase Storage, no una URL pública.
  storage_path    text not null unique check (char_length(storage_path) between 1 and 500),
  position        smallint not null default 0 check (position >= 0),
  created_at      timestamptz not null default now(),
  constraint photos_publication_position_key unique (publication_id, position)
);

-- Solo guarda el texto de la pregunta. La respuesta correcta no se almacena:
-- quien publica tiene el objeto y evalúa las respuestas al revisar la solicitud.
create table public.verification_questions (
  id              uuid primary key default gen_random_uuid(),
  publication_id  uuid not null references public.publications (id) on delete cascade,
  question        text not null check (char_length(btrim(question)) between 3 and 300),
  position        smallint not null default 0 check (position >= 0),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  constraint verification_questions_publication_position_key
    unique (publication_id, position)
);

create table public.claims (
  id              uuid primary key default gen_random_uuid(),
  publication_id  uuid not null references public.publications (id) on delete cascade,
  claimant_id     uuid not null references public.users (id) on delete cascade,
  status          public.claim_status not null default 'pending',
  reviewed_at     timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create table public.claim_responses (
  id           uuid primary key default gen_random_uuid(),
  claim_id     uuid not null references public.claims (id) on delete cascade,
  -- Impide borrar una pregunta ya respondida. Es diferible para que el borrado
  -- en cascada de una publicación completa pueda terminar antes de revisarla.
  question_id  uuid not null references public.verification_questions (id)
    on delete no action deferrable initially deferred,
  answer       text not null check (char_length(btrim(answer)) between 1 and 1000),
  created_at   timestamptz not null default now(),
  constraint claim_responses_claim_question_key unique (claim_id, question_id)
);

-- publisher_id y claimant_id los copia un trigger desde la reclamación, para
-- que las políticas RLS de Realtime no tengan que recorrer varias tablas.
create table public.chats (
  id            uuid primary key default gen_random_uuid(),
  claim_id      uuid not null unique references public.claims (id) on delete cascade,
  publisher_id  uuid not null references public.users (id) on delete cascade,
  claimant_id   uuid not null references public.users (id) on delete cascade,
  closed_at     timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  constraint chats_distinct_participants check (publisher_id <> claimant_id)
);

create table public.messages (
  id          uuid primary key default gen_random_uuid(),
  chat_id     uuid not null references public.chats (id) on delete cascade,
  sender_id   uuid not null references public.users (id) on delete cascade,
  content     text not null check (char_length(btrim(content)) between 1 and 2000),
  created_at  timestamptz not null default now()
);

create table public.reports (
  id                     uuid primary key default gen_random_uuid(),
  reporter_id            uuid not null references public.users (id) on delete cascade,
  target_publication_id  uuid references public.publications (id) on delete cascade,
  target_user_id         uuid references public.users (id) on delete cascade,
  reason                 text not null check (char_length(btrim(reason)) between 3 and 1000),
  status                 public.report_status not null default 'pending',
  reviewed_by            uuid references public.users (id) on delete set null,
  reviewed_at            timestamptz,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now(),
  -- Un reporte apunta exactamente a una publicación o a un usuario.
  constraint reports_single_target check (
    num_nonnulls(target_publication_id, target_user_id) = 1
  ),
  constraint reports_not_self check (reporter_id <> target_user_id)
);

-- =============================================================================
-- 4. Índices
-- =============================================================================

create unique index campuses_name_unique on public.campuses (lower(name));
create unique index campuses_code_unique on public.campuses (lower(code));
create unique index categories_name_unique on public.categories (lower(name));
create unique index locations_campus_name_unique on public.locations (campus_id, lower(name));

create index users_campus_id_idx on public.users (campus_id);

-- Listado principal: publicaciones por campus, tipo y fecha.
create index publications_feed_idx
  on public.publications (campus_id, type, created_at desc)
  where status = 'active';
create index publications_user_id_idx on public.publications (user_id, created_at desc);
create index publications_category_id_idx on public.publications (category_id);
create index publications_location_campus_idx on public.publications (location_id, campus_id);

create index claims_publication_status_idx on public.claims (publication_id, status);
create index claims_claimant_id_idx on public.claims (claimant_id, created_at desc);

-- Una persona solo puede tener una reclamación viva por publicación.
create unique index claims_one_open_per_claimant
  on public.claims (publication_id, claimant_id)
  where status in ('pending', 'approved');

-- Una publicación solo puede tener una reclamación aprobada.
create unique index claims_one_approved_per_publication
  on public.claims (publication_id)
  where status = 'approved';

create index claim_responses_question_id_idx on public.claim_responses (question_id);

create index chats_publisher_id_idx on public.chats (publisher_id);
create index chats_claimant_id_idx on public.chats (claimant_id);

create index messages_chat_created_idx on public.messages (chat_id, created_at desc);
create index messages_sender_id_idx on public.messages (sender_id);

create index reports_status_idx on public.reports (status, created_at desc);
create index reports_reporter_id_idx on public.reports (reporter_id);
create index reports_target_publication_idx on public.reports (target_publication_id);
create index reports_target_user_idx on public.reports (target_user_id);
create index reports_reviewed_by_idx on public.reports (reviewed_by);

-- Evita reportes abiertos duplicados de la misma persona sobre el mismo objetivo.
create unique index reports_one_open_per_publication
  on public.reports (reporter_id, target_publication_id)
  where target_publication_id is not null and status in ('pending', 'reviewing');
create unique index reports_one_open_per_user
  on public.reports (reporter_id, target_user_id)
  where target_user_id is not null and status in ('pending', 'reviewing');

-- =============================================================================
-- 5. Triggers de integridad
-- =============================================================================

create function private.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger campuses_set_updated_at before update on public.campuses
  for each row execute function private.set_updated_at();
create trigger users_set_updated_at before update on public.users
  for each row execute function private.set_updated_at();
create trigger categories_set_updated_at before update on public.categories
  for each row execute function private.set_updated_at();
create trigger locations_set_updated_at before update on public.locations
  for each row execute function private.set_updated_at();
create trigger publications_set_updated_at before update on public.publications
  for each row execute function private.set_updated_at();
create trigger verification_questions_set_updated_at before update on public.verification_questions
  for each row execute function private.set_updated_at();
create trigger chats_set_updated_at before update on public.chats
  for each row execute function private.set_updated_at();
create trigger reports_set_updated_at before update on public.reports
  for each row execute function private.set_updated_at();

-- Una reclamación nace pendiente, sobre una publicación activa y ajena.
create function private.claims_before_insert()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  publication record;
begin
  select p.user_id, p.status into publication
  from public.publications p
  where p.id = new.publication_id;

  if not found or publication.status <> 'active' then
    raise exception 'La publicación no está abierta a reclamaciones';
  end if;

  if publication.user_id = new.claimant_id then
    raise exception 'No puedes reclamar tu propia publicación';
  end if;

  if new.status <> 'pending' then
    raise exception 'Una reclamación debe crearse como pendiente';
  end if;

  return new;
end;
$$;

create trigger claims_validate_insert before insert on public.claims
  for each row execute function private.claims_before_insert();

-- Controla los cambios de estado y cierra el chat si se revoca una aprobación.
create function private.claims_before_update()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();

  if new.publication_id <> old.publication_id or new.claimant_id <> old.claimant_id then
    raise exception 'La publicación y el solicitante de una reclamación no pueden cambiar';
  end if;

  if new.status = old.status then
    return new;
  end if;

  if not (
    (old.status = 'pending' and new.status in ('approved', 'rejected', 'cancelled'))
    or (old.status = 'approved' and new.status = 'cancelled')
  ) then
    raise exception 'Cambio de estado no permitido: % -> %', old.status, new.status;
  end if;

  new.reviewed_at := now();

  if old.status = 'approved' then
    update public.chats
    set closed_at = now()
    where claim_id = new.id and closed_at is null;
  end if;

  return new;
end;
$$;

create trigger claims_validate_update before update on public.claims
  for each row execute function private.claims_before_update();

-- La pregunta debe ser de la misma publicación y la reclamación seguir pendiente.
create function private.claim_responses_before_insert()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if not exists (
    select 1
    from public.claims c
    join public.verification_questions q on q.publication_id = c.publication_id
    where c.id = new.claim_id
      and q.id = new.question_id
      and c.status = 'pending'
  ) then
    raise exception 'La respuesta no corresponde a una reclamación pendiente de esa publicación';
  end if;

  return new;
end;
$$;

create trigger claim_responses_validate_insert before insert on public.claim_responses
  for each row execute function private.claim_responses_before_insert();

-- Un chat solo nace de una reclamación aprobada; sus participantes se derivan
-- de ella e ignoran cualquier valor enviado por el cliente.
create function private.chats_before_insert()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  claim record;
begin
  select c.status, c.claimant_id, p.user_id as publisher_id into claim
  from public.claims c
  join public.publications p on p.id = c.publication_id
  where c.id = new.claim_id;

  if not found or claim.status <> 'approved' then
    raise exception 'Un chat requiere una reclamación aprobada';
  end if;

  new.publisher_id := claim.publisher_id;
  new.claimant_id := claim.claimant_id;

  return new;
end;
$$;

create trigger chats_validate_insert before insert on public.chats
  for each row execute function private.chats_before_insert();

-- =============================================================================
-- 6. Funciones de apoyo para RLS
-- =============================================================================

-- Son SECURITY DEFINER para consultar otras tablas sin volver a evaluar sus
-- políticas. Así se evita la recursión infinita entre publications y claims.

-- Tener sesión no basta: se exige un perfil activo, que solo crea el backend
-- tras validar el dominio institucional.
create function private.is_active_user()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.users u
    where u.id = auth.uid() and u.status = 'active'
  );
$$;

create function private.owns_publication(target_publication uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.publications p
    where p.id = target_publication and p.user_id = auth.uid()
  );
$$;

create function private.has_claim_on_publication(target_publication uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.claims c
    where c.publication_id = target_publication and c.claimant_id = auth.uid()
  );
$$;

create function private.can_view_publication(target_publication uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.publications p
    where p.id = target_publication
      and (
        p.status = 'active'
        or p.user_id = auth.uid()
        or exists (
          select 1 from public.claims c
          where c.publication_id = p.id and c.claimant_id = auth.uid()
        )
      )
  );
$$;

create function private.is_open_claim_of_user(target_claim uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.claims c
    where c.id = target_claim
      and c.claimant_id = auth.uid()
      and c.status = 'pending'
  );
$$;

create function private.can_view_claim(target_claim uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.claims c
    join public.publications p on p.id = c.publication_id
    where c.id = target_claim
      and (c.claimant_id = auth.uid() or p.user_id = auth.uid())
  );
$$;

create function private.is_chat_participant(target_chat uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.chats c
    where c.id = target_chat
      and auth.uid() in (c.publisher_id, c.claimant_id)
  );
$$;

create function private.can_send_message(target_chat uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.chats c
    where c.id = target_chat
      and c.closed_at is null
      and auth.uid() in (c.publisher_id, c.claimant_id)
  );
$$;

-- Única vía para ver datos de otra persona: id y nombre visible, nada más.
create function public.get_public_profiles(user_ids uuid[])
returns table (id uuid, display_name text)
language sql
stable
security definer
set search_path = ''
as $$
  select u.id, u.display_name
  from public.users u
  where u.id = any (user_ids)
    and private.is_active_user();
$$;

revoke execute on all functions in schema private from public, anon;
grant execute on all functions in schema private to authenticated, service_role;

revoke execute on function public.get_public_profiles(uuid[]) from public, anon;
grant execute on function public.get_public_profiles(uuid[]) to authenticated, service_role;

-- =============================================================================
-- 7. Permisos por tabla y columna
-- =============================================================================

-- RLS decide qué filas; estos permisos deciden qué operaciones y columnas.
-- Supabase concede todo por defecto a anon y authenticated, así que se retira.
revoke all on
  public.campuses, public.users, public.categories, public.locations,
  public.publications, public.photos, public.verification_questions,
  public.claims, public.claim_responses, public.chats, public.messages,
  public.reports
from anon, authenticated;

grant all on
  public.campuses, public.users, public.categories, public.locations,
  public.publications, public.photos, public.verification_questions,
  public.claims, public.claim_responses, public.chats, public.messages,
  public.reports
to service_role;

grant select on
  public.campuses, public.users, public.categories, public.locations,
  public.publications, public.photos, public.verification_questions,
  public.claims, public.claim_responses, public.chats, public.messages,
  public.reports
to authenticated;

-- Las columnas role, status y reviewed_* quedan fuera a propósito: un cliente
-- no puede cambiar su rol, suspender a nadie ni aprobar reclamaciones.
grant update (display_name, campus_id) on public.users to authenticated;

grant insert (user_id, campus_id, location_id, category_id, type, title, description, event_date)
  on public.publications to authenticated;
grant update (location_id, category_id, title, description, event_date)
  on public.publications to authenticated;

grant insert (publication_id, storage_path, position) on public.photos to authenticated;
grant delete on public.photos to authenticated;

grant insert (publication_id, question, position) on public.verification_questions to authenticated;
grant update (question, position) on public.verification_questions to authenticated;

grant insert (publication_id, claimant_id) on public.claims to authenticated;
grant insert (claim_id, question_id, answer) on public.claim_responses to authenticated;
grant insert (chat_id, sender_id, content) on public.messages to authenticated;
grant insert (reporter_id, target_publication_id, target_user_id, reason)
  on public.reports to authenticated;

-- =============================================================================
-- 8. Row Level Security
-- =============================================================================

alter table public.campuses enable row level security;
alter table public.users enable row level security;
alter table public.categories enable row level security;
alter table public.locations enable row level security;
alter table public.publications enable row level security;
alter table public.photos enable row level security;
alter table public.verification_questions enable row level security;
alter table public.claims enable row level security;
alter table public.claim_responses enable row level security;
alter table public.chats enable row level security;
alter table public.messages enable row level security;
alter table public.reports enable row level security;

-- Catálogos: lectura para usuarios activos; se administran desde el backend.
create policy "campuses_select_active" on public.campuses
  for select to authenticated
  using (is_active and (select private.is_active_user()));

create policy "categories_select_active" on public.categories
  for select to authenticated
  using (is_active and (select private.is_active_user()));

create policy "locations_select_active" on public.locations
  for select to authenticated
  using (is_active and (select private.is_active_user()));

-- Perfiles: cada quien ve y edita solo el suyo.
create policy "users_select_own" on public.users
  for select to authenticated
  using (id = (select auth.uid()));

create policy "users_update_own" on public.users
  for update to authenticated
  using (id = (select auth.uid()) and (select private.is_active_user()))
  with check (id = (select auth.uid()));

-- Publicaciones: activas para la comunidad; el resto, para quien publicó o
-- para quien la reclamó.
create policy "publications_select_visible" on public.publications
  for select to authenticated
  using (
    (select private.is_active_user())
    and (
      status = 'active'
      or user_id = (select auth.uid())
      or private.has_claim_on_publication(id)
    )
  );

create policy "publications_insert_own" on public.publications
  for insert to authenticated
  with check (user_id = (select auth.uid()) and (select private.is_active_user()));

create policy "publications_update_own_active" on public.publications
  for update to authenticated
  using (
    user_id = (select auth.uid())
    and status = 'active'
    and (select private.is_active_user())
  )
  with check (user_id = (select auth.uid()));

-- Fotos: siguen la visibilidad de su publicación.
create policy "photos_select_visible" on public.photos
  for select to authenticated
  using ((select private.is_active_user()) and private.can_view_publication(publication_id));

create policy "photos_insert_owner" on public.photos
  for insert to authenticated
  with check ((select private.is_active_user()) and private.owns_publication(publication_id));

create policy "photos_delete_owner" on public.photos
  for delete to authenticated
  using ((select private.is_active_user()) and private.owns_publication(publication_id));

-- Preguntas: visibles con la publicación; solo las escribe quien publica.
create policy "verification_questions_select_visible" on public.verification_questions
  for select to authenticated
  using ((select private.is_active_user()) and private.can_view_publication(publication_id));

create policy "verification_questions_insert_owner" on public.verification_questions
  for insert to authenticated
  with check ((select private.is_active_user()) and private.owns_publication(publication_id));

create policy "verification_questions_update_owner" on public.verification_questions
  for update to authenticated
  using ((select private.is_active_user()) and private.owns_publication(publication_id))
  with check (private.owns_publication(publication_id));

-- Reclamaciones: las ven quien reclama y quien publicó.
-- Aprobar, rechazar o cancelar solo se hace desde el backend.
create policy "claims_select_participants" on public.claims
  for select to authenticated
  using (
    (select private.is_active_user())
    and (claimant_id = (select auth.uid()) or private.owns_publication(publication_id))
  );

create policy "claims_insert_own" on public.claims
  for insert to authenticated
  with check (claimant_id = (select auth.uid()) and (select private.is_active_user()));

-- Respuestas: las ven quien reclama y quien evalúa.
create policy "claim_responses_select_participants" on public.claim_responses
  for select to authenticated
  using ((select private.is_active_user()) and private.can_view_claim(claim_id));

create policy "claim_responses_insert_claimant" on public.claim_responses
  for insert to authenticated
  with check ((select private.is_active_user()) and private.is_open_claim_of_user(claim_id));

-- Chats: solo lectura para sus dos participantes; los crea el backend.
create policy "chats_select_participants" on public.chats
  for select to authenticated
  using (
    (select private.is_active_user())
    and (select auth.uid()) in (publisher_id, claimant_id)
  );

-- Mensajes: solo participantes; para enviar, el chat debe seguir abierto.
create policy "messages_select_participants" on public.messages
  for select to authenticated
  using ((select private.is_active_user()) and private.is_chat_participant(chat_id));

create policy "messages_insert_participants" on public.messages
  for insert to authenticated
  with check (
    sender_id = (select auth.uid())
    and (select private.is_active_user())
    and private.can_send_message(chat_id)
  );

-- Reportes: cada quien ve solo los suyos; la moderación se hace en el backend.
create policy "reports_select_own" on public.reports
  for select to authenticated
  using (reporter_id = (select auth.uid()) and (select private.is_active_user()));

create policy "reports_insert_own" on public.reports
  for insert to authenticated
  with check (
    reporter_id = (select auth.uid())
    and (select private.is_active_user())
    and (target_publication_id is null or private.can_view_publication(target_publication_id))
  );

commit;
