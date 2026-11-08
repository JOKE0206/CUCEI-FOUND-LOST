-- =============================================================================
-- CUCEI Found & Lost: dominio de campus y estado de suspensión
--
-- Ejecutar después de schema.sql y antes de functions.sql y seeds.sql.
-- Se puede volver a ejecutar sin problema.
-- =============================================================================

-- Dato informativo del campus. El acceso NO depende de esta columna: los
-- dominios permitidos se validan en el backend (ALLOWED_EMAIL_DOMAINS).
alter table public.campuses
  add column if not exists email_domain text
  check (email_domain is null or char_length(btrim(email_domain)) between 3 and 120);

-- suspended: oculta por moderación, a diferencia de removed, que es definitivo.
alter type public.publication_status add value if not exists 'suspended';
