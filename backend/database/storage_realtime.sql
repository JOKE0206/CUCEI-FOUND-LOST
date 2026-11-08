-- =============================================================================
-- CUCEI Found & Lost: Storage y Realtime
--
-- Ejecutar después de schema.sql. Se puede volver a ejecutar sin problema.
-- =============================================================================

begin;

-- Bucket privado: máximo 5 MB por archivo y solo JPEG, PNG o WebP.
-- No se crean políticas sobre storage.objects a propósito: sin ellas, los
-- clientes no pueden leer ni escribir. El backend entrega URLs firmadas
-- únicamente a quien tiene permiso sobre la publicación.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'publication-photos',
  'publication-photos',
  false,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

-- Realtime entrega cada mensaje según las políticas RLS de public.messages:
-- solo lo reciben los dos participantes del chat.
do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'messages'
  ) then
    alter publication supabase_realtime add table public.messages;
  end if;
end;
$$;

commit;
