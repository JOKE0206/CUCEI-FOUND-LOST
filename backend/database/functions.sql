-- =============================================================================
-- CUCEI Found & Lost: operaciones atómicas del backend
--
-- Ejecutar después de schema.sql. Se puede volver a ejecutar sin problema.
--
-- supabase-js no ofrece transacciones, así que los flujos que tocan varias
-- tablas viven aquí. Solo service_role puede llamarlas: el backend identifica
-- a quien actúa y lo pasa como parámetro.
--
-- Códigos de error (el backend los traduce a HTTP):
--   CF403 sin permiso | CF404 no existe | CF409 estado no válido | CF422 datos no válidos
--
-- Orden de bloqueo: siempre la publicación primero y después la reclamación.
-- =============================================================================

begin;

-- Reemplazan a las de schema.sql: una publicación moderada solo la sigue viendo
-- quien publicó, no quienes alguna vez la reclamaron.
create or replace function private.has_claim_on_publication(target_publication uuid)
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
    where c.publication_id = target_publication
      and c.claimant_id = auth.uid()
      and p.status not in ('removed', 'suspended')
  );
$$;

create or replace function private.can_view_publication(target_publication uuid)
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
        or (
          p.status not in ('removed', 'suspended')
          and exists (
            select 1 from public.claims c
            where c.publication_id = p.id and c.claimant_id = auth.uid()
          )
        )
      )
  );
$$;

create or replace function public.create_publication_with_questions(
  p_user_id uuid,
  p_campus_id uuid,
  p_location_id uuid,
  p_category_id uuid,
  p_type public.publication_type,
  p_title text,
  p_description text,
  p_event_date date,
  p_questions text[]
)
returns uuid
language plpgsql
set search_path = ''
as $$
declare
  v_publication_id uuid;
begin
  insert into public.publications (
    user_id, campus_id, location_id, category_id, type, title, description, event_date
  )
  values (
    p_user_id, p_campus_id, p_location_id, p_category_id, p_type, p_title, p_description, p_event_date
  )
  returning id into v_publication_id;

  insert into public.verification_questions (publication_id, question, position)
  select v_publication_id, q.question, q.ordinal - 1
  from unnest(p_questions) with ordinality as q (question, ordinal);

  return v_publication_id;
end;
$$;

-- Las preguntas solo cambian si nadie ha reclamado todavía.
create or replace function public.replace_verification_questions(
  p_publication_id uuid,
  p_user_id uuid,
  p_questions text[]
)
returns void
language plpgsql
set search_path = ''
as $$
declare
  v_publication public.publications;
begin
  select * into v_publication
  from public.publications
  where id = p_publication_id
  for update;

  if not found then
    raise exception 'Publicación no encontrada' using errcode = 'CF404';
  end if;
  if v_publication.user_id <> p_user_id then
    raise exception 'Solo quien publicó puede editar las preguntas' using errcode = 'CF403';
  end if;
  if v_publication.status <> 'active' then
    raise exception 'La publicación no está activa' using errcode = 'CF409';
  end if;
  if exists (select 1 from public.claims where publication_id = p_publication_id) then
    raise exception 'Las preguntas no se pueden cambiar si ya hay reclamaciones' using errcode = 'CF409';
  end if;

  delete from public.verification_questions where publication_id = p_publication_id;

  insert into public.verification_questions (publication_id, question, position)
  select p_publication_id, q.question, q.ordinal - 1
  from unnest(p_questions) with ordinality as q (question, ordinal);
end;
$$;

-- Crea la reclamación con todas sus respuestas, o nada.
create or replace function public.submit_claim(
  p_publication_id uuid,
  p_claimant_id uuid,
  p_question_ids uuid[],
  p_answers text[]
)
returns uuid
language plpgsql
set search_path = ''
as $$
declare
  v_publication public.publications;
  v_claim_id uuid;
begin
  select * into v_publication
  from public.publications
  where id = p_publication_id
  for share;

  if not found then
    raise exception 'Publicación no encontrada' using errcode = 'CF404';
  end if;
  if v_publication.user_id = p_claimant_id then
    raise exception 'No puedes reclamar tu propia publicación' using errcode = 'CF403';
  end if;
  if v_publication.status <> 'active' then
    raise exception 'La publicación no está abierta a reclamaciones' using errcode = 'CF409';
  end if;
  if exists (
    select 1 from public.claims
    where publication_id = p_publication_id
      and claimant_id = p_claimant_id
      and status = 'rejected'
  ) then
    raise exception 'Tu reclamación para esta publicación fue rechazada previamente y no puedes volver a intentar'
      using errcode = 'CF403';
  end if;

  -- Debe haber exactamente una respuesta por cada pregunta de la publicación.
  if cardinality(p_question_ids) <> cardinality(p_answers)
    or (
      select array_agg(id order by id)
      from public.verification_questions
      where publication_id = p_publication_id
    ) is distinct from (
      select array_agg(question_id order by question_id)
      from unnest(p_question_ids) as question_id
    )
  then
    raise exception 'Debes responder cada pregunta exactamente una vez' using errcode = 'CF422';
  end if;

  insert into public.claims (publication_id, claimant_id)
  values (p_publication_id, p_claimant_id)
  returning id into v_claim_id;

  insert into public.claim_responses (claim_id, question_id, answer)
  select v_claim_id, r.question_id, r.answer
  from unnest(p_question_ids, p_answers) as r (question_id, answer);

  return v_claim_id;
end;
$$;

-- Aprueba, pasa la publicación a in_process y crea el chat. Devuelve el id del chat.
create or replace function public.approve_claim(
  p_claim_id uuid,
  p_publisher_id uuid
)
returns uuid
language plpgsql
set search_path = ''
as $$
declare
  v_publication_id uuid;
  v_publication public.publications;
  v_claim public.claims;
  v_chat_id uuid;
begin
  select publication_id into v_publication_id from public.claims where id = p_claim_id;
  if not found then
    raise exception 'Reclamación no encontrada' using errcode = 'CF404';
  end if;

  select * into v_publication from public.publications where id = v_publication_id for update;
  select * into v_claim from public.claims where id = p_claim_id for update;

  if v_publication.user_id <> p_publisher_id then
    raise exception 'Solo quien publicó puede aprobar' using errcode = 'CF403';
  end if;
  if v_publication.status <> 'active' or v_claim.status <> 'pending' then
    raise exception 'La reclamación ya no se puede aprobar' using errcode = 'CF409';
  end if;

  update public.claims set status = 'approved' where id = p_claim_id;
  update public.publications set status = 'in_process' where id = v_publication_id;

  -- El trigger de chats deriva los participantes reales de la reclamación.
  insert into public.chats (claim_id, publisher_id, claimant_id)
  values (p_claim_id, v_publication.user_id, v_claim.claimant_id)
  returning id into v_chat_id;

  return v_chat_id;
end;
$$;

-- Cancela una reclamación. Si estaba aprobada, reabre la publicación;
-- el trigger de claims se encarga de cerrar el chat.
create or replace function public.cancel_claim(
  p_claim_id uuid,
  p_actor_id uuid
)
returns void
language plpgsql
set search_path = ''
as $$
declare
  v_publication_id uuid;
  v_publication public.publications;
  v_claim public.claims;
begin
  select publication_id into v_publication_id from public.claims where id = p_claim_id;
  if not found then
    raise exception 'Reclamación no encontrada' using errcode = 'CF404';
  end if;

  select * into v_publication from public.publications where id = v_publication_id for update;
  select * into v_claim from public.claims where id = p_claim_id for update;

  if v_claim.status = 'pending' then
    if v_claim.claimant_id <> p_actor_id then
      raise exception 'Solo quien reclamó puede retirar la solicitud' using errcode = 'CF403';
    end if;
  elsif v_claim.status = 'approved' then
    if p_actor_id not in (v_claim.claimant_id, v_publication.user_id) then
      raise exception 'Sin permiso sobre esta reclamación' using errcode = 'CF403';
    end if;
    if v_publication.status <> 'in_process' then
      raise exception 'La entrega ya concluyó' using errcode = 'CF409';
    end if;
  else
    raise exception 'La reclamación ya está cerrada' using errcode = 'CF409';
  end if;

  update public.claims set status = 'cancelled' where id = p_claim_id;

  if v_claim.status = 'approved' then
    update public.publications set status = 'active' where id = v_publication_id;
  end if;
end;
$$;

-- Marca el objeto como devuelto, rechaza lo pendiente y cierra el chat.
create or replace function public.resolve_publication(
  p_publication_id uuid,
  p_user_id uuid
)
returns void
language plpgsql
set search_path = ''
as $$
declare
  v_publication public.publications;
begin
  select * into v_publication
  from public.publications
  where id = p_publication_id
  for update;

  if not found then
    raise exception 'Publicación no encontrada' using errcode = 'CF404';
  end if;
  if v_publication.user_id <> p_user_id then
    raise exception 'Solo quien publicó puede resolverla' using errcode = 'CF403';
  end if;
  if v_publication.status <> 'in_process' then
    raise exception 'La publicación no tiene una entrega en curso' using errcode = 'CF409';
  end if;

  update public.publications set status = 'resolved' where id = p_publication_id;

  update public.claims
  set status = 'rejected'
  where publication_id = p_publication_id and status = 'pending';

  update public.chats ch
  set closed_at = now()
  from public.claims c
  where ch.claim_id = c.id
    and c.publication_id = p_publication_id
    and ch.closed_at is null;
end;
$$;

-- Retira una publicación activa y rechaza sus reclamaciones pendientes.
create or replace function public.cancel_publication(
  p_publication_id uuid,
  p_user_id uuid
)
returns void
language plpgsql
set search_path = ''
as $$
declare
  v_publication public.publications;
begin
  select * into v_publication
  from public.publications
  where id = p_publication_id
  for update;

  if not found then
    raise exception 'Publicación no encontrada' using errcode = 'CF404';
  end if;
  if v_publication.user_id <> p_user_id then
    raise exception 'Solo quien publicó puede cancelarla' using errcode = 'CF403';
  end if;
  if v_publication.status <> 'active' then
    raise exception 'Solo se puede cancelar una publicación activa' using errcode = 'CF409';
  end if;

  update public.publications set status = 'cancelled' where id = p_publication_id;

  update public.claims
  set status = 'rejected'
  where publication_id = p_publication_id and status = 'pending';
end;
$$;

-- Oculta una publicación por moderación y cancela sus reclamaciones abiertas.
-- Se cancelan, no se rechazan: nadie evaluó a esas personas, así que no deben
-- quedar bloqueadas. El trigger de claims cierra el chat de la aprobada.
create or replace function public.moderate_publication(
  p_publication_id uuid,
  p_status public.publication_status
)
returns void
language plpgsql
set search_path = ''
as $$
declare
  v_publication public.publications;
begin
  select * into v_publication
  from public.publications
  where id = p_publication_id
  for update;

  if not found then
    raise exception 'Publicación no encontrada' using errcode = 'CF404';
  end if;
  if p_status not in ('removed', 'suspended') then
    raise exception 'Acción de moderación no válida' using errcode = 'CF422';
  end if;
  if v_publication.status = 'removed'
    or (p_status = 'suspended' and v_publication.status not in ('active', 'in_process'))
  then
    raise exception 'La publicación no admite esta acción en su estado actual' using errcode = 'CF409';
  end if;

  update public.publications set status = p_status where id = p_publication_id;

  if v_publication.status in ('active', 'in_process') then
    update public.claims
    set status = 'cancelled'
    where publication_id = p_publication_id and status in ('pending', 'approved');
  end if;
end;
$$;

-- Estas funciones reciben la identidad como parámetro: un cliente que pudiera
-- llamarlas podría actuar en nombre de otra persona.
revoke all on function public.create_publication_with_questions(uuid, uuid, uuid, uuid, public.publication_type, text, text, date, text[]) from public, anon, authenticated;
revoke all on function public.replace_verification_questions(uuid, uuid, text[]) from public, anon, authenticated;
revoke all on function public.submit_claim(uuid, uuid, uuid[], text[]) from public, anon, authenticated;
revoke all on function public.approve_claim(uuid, uuid) from public, anon, authenticated;
revoke all on function public.cancel_claim(uuid, uuid) from public, anon, authenticated;
revoke all on function public.resolve_publication(uuid, uuid) from public, anon, authenticated;
revoke all on function public.cancel_publication(uuid, uuid) from public, anon, authenticated;
revoke all on function public.moderate_publication(uuid, public.publication_status) from public, anon, authenticated;

grant execute on function public.create_publication_with_questions(uuid, uuid, uuid, uuid, public.publication_type, text, text, date, text[]) to service_role;
grant execute on function public.replace_verification_questions(uuid, uuid, text[]) to service_role;
grant execute on function public.submit_claim(uuid, uuid, uuid[], text[]) to service_role;
grant execute on function public.approve_claim(uuid, uuid) to service_role;
grant execute on function public.cancel_claim(uuid, uuid) to service_role;
grant execute on function public.resolve_publication(uuid, uuid) to service_role;
grant execute on function public.cancel_publication(uuid, uuid) to service_role;
grant execute on function public.moderate_publication(uuid, public.publication_status) to service_role;

-- Pide a la API de Supabase que reconozca las funciones nuevas.
notify pgrst, 'reload schema';

commit;
