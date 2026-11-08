-- =============================================================================
-- CUCEI Found & Lost: datos iniciales obligatorios
--
-- Ejecutar al final, después de migration_campus_moderation.sql.
-- Se puede volver a ejecutar sin duplicar registros.
-- =============================================================================

begin;

insert into public.campuses (name, code, email_domain, is_active)
values ('CUCEI', 'CUCEI', 'alumnos.udg.mx', true)
on conflict (lower(name)) do update
set email_domain = excluded.email_domain,
    is_active = excluded.is_active;

insert into public.categories (name)
values
  ('Credenciales e Identificaciones'),
  ('Electrónica y Dispositivos'),
  ('Libros y Cuadernos'),
  ('Mochilas y Accesorios'),
  ('Llaves y Billeteras'),
  ('Otros')
on conflict (lower(name)) do nothing;

commit;
