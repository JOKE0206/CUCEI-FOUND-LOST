# CUCEI-FOUND-LOST

Plataforma universitaria para publicar y recuperar objetos perdidos y encontrados dentro de CUCEI.

| Parte | Tecnologías |
|---|---|
| `frontend/` | Next.js, React, TypeScript, Tailwind CSS |
| `backend/` | Node.js, Express, TypeScript (arquitectura modular) |
| Datos y servicios | Supabase con PostgreSQL |

**Estado actual:** el backend implementa autenticación, publicaciones, reclamaciones, chat, campus, reportes y administración. El frontend implementa todas estas funciones sobre la API `/api/v1`. Para configurar la base de datos, consulta [backend/database/README.md](backend/database/README.md).

## Requisitos

- Node.js 20.12 o superior
- npm

## Instalación

```bash
npm run install:all
```

Copia los archivos de variables de entorno:

```bash
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env.local
```

La aplicación inicia con los valores de ejemplo. Para conectar Supabase, reemplázalos con los de tu proyecto (Project Settings > API).

| Archivo | Variable | Uso |
|---|---|---|
| `backend/.env` | `PORT` | Puerto del backend (4000 por defecto) |
| `backend/.env` | `FRONTEND_URL` | Origen permitido por CORS |
| `backend/.env` | `ALLOWED_EMAIL_DOMAINS` | Dominios aceptados, separados por comas (`udg.mx,alumnos.udg.mx` por defecto) |
| `backend/.env` | `SUPABASE_URL` | URL del proyecto |
| `backend/.env` | `SUPABASE_SERVICE_ROLE_KEY` | Clave privada, **solo en el backend** |
| `frontend/.env.local` | `NEXT_PUBLIC_API_URL` | URL del backend |
| `frontend/.env.local` | `NEXT_PUBLIC_SUPABASE_URL` | URL del proyecto |
| `frontend/.env.local` | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Clave pública |

Nunca subas archivos `.env` a GitHub ni uses la clave `service_role` en el frontend.

## Desarrollo

Desde la raíz del repositorio:

| Comando | Qué hace |
|---|---|
| `npm run dev` | Inicia backend y frontend juntos |
| `npm run dev:backend` | Solo backend, en http://localhost:4000 |
| `npm run dev:frontend` | Solo frontend, en http://localhost:3000 |
| `npm run build` | Compila ambos proyectos |

Para comprobar el backend, abre http://localhost:4000/health. La página principal del frontend muestra si logra conectarse.

## Pruebas del backend

Desde `backend/`:

| Comando | Qué hace |
|---|---|
| `npm test` | Ejecuta la suite de Vitest una vez |
| `npm run test:watch` | La ejecuta al guardar cambios |
| `npm run typecheck` | Revisa los tipos del código y de las pruebas |

Las pruebas usan repositorios en memoria y nunca se conectan a Supabase.

## API del backend

Todas las rutas, salvo `/health`, requieren el encabezado `Authorization: Bearer <token de Supabase Auth>`. Salvo las de `/api/v1/auth`, también exigen un perfil activo.

| Método y ruta | Descripción | Quién |
|---|---|---|
| `GET /api/v1/auth/me` | Sesión y perfil actuales | Con sesión |
| `POST /api/v1/auth/perfil` | Crea el perfil tras validar el dominio | Con sesión |
| `GET /api/v1/publicaciones` | Lista activas; filtros `campusId`, `locationId`, `categoryId`, `type`, `dateFrom`, `dateTo`, `page`, `pageSize` | Activos |
| `POST /api/v1/publicaciones` | Crea una publicación con sus preguntas | Activos |
| `GET /api/v1/publicaciones/mias` | Lista las propias | Activos |
| `GET /api/v1/publicaciones/:id` | Detalle | Si es visible |
| `PATCH /api/v1/publicaciones/:id` | Edita | Quien publicó |
| `POST /api/v1/publicaciones/:id/cancelar` | Retira y rechaza lo pendiente | Quien publicó |
| `POST /api/v1/publicaciones/:id/resolver` | Marca como devuelto y cierra el chat | Quien publicó |
| `POST /api/v1/publicaciones/:id/fotos/url-subida` | URL firmada para subir una foto | Quien publicó |
| `POST /api/v1/publicaciones/:id/fotos` | Registra una foto ya subida | Quien publicó |
| `DELETE /api/v1/publicaciones/:id/fotos/:photoId` | Borra una foto | Quien publicó |
| `GET /api/v1/publicaciones/:id/preguntas` | Lista las preguntas | Si es visible |
| `PUT /api/v1/publicaciones/:id/preguntas` | Reemplaza las preguntas, si aún no hay reclamaciones | Quien publicó |
| `POST /api/v1/publicaciones/:id/reclamaciones` | Reclama con todas las respuestas | Activos, salvo quien publicó |
| `GET /api/v1/publicaciones/:id/reclamaciones` | Lista las reclamaciones con sus respuestas | Quien publicó |
| `GET /api/v1/reclamaciones/mias` | Lista las propias | Activos |
| `GET /api/v1/reclamaciones/:id` | Detalle | Participantes |
| `POST /api/v1/reclamaciones/:id/aprobar` | Aprueba y crea el chat | Quien publicó |
| `POST /api/v1/reclamaciones/:id/rechazar` | Rechaza | Quien publicó |
| `POST /api/v1/reclamaciones/:id/cancelar` | Retira la solicitud o revoca la aprobación | Quien reclamó; quien publicó solo si está aprobada |
| `GET /api/v1/chats` | Lista los chats propios | Participantes |
| `GET /api/v1/chats/:id` | Detalle | Participantes |
| `GET /api/v1/chats/:id/mensajes` | Del más reciente al más antiguo; `limit`, `before` | Participantes |
| `POST /api/v1/chats/:id/mensajes` | Envía un mensaje | Participantes, con el chat abierto |
| `GET /api/v1/campuses` | Lista los campus activos | Con sesión |
| `GET /api/v1/campuses/:id/locations` | Lista las ubicaciones activas de un campus | Activos |
| `GET /api/v1/categories` | Lista las categorías activas | Activos |
| `POST /api/v1/reports` | Reporta una publicación (`targetPublicationId`) o un usuario (`targetUserId`), con `reason` | Activos |
| `GET /api/v1/admin/reports` | Lista reportes; filtros `status`, `page`, `pageSize` | Admin |
| `PATCH /api/v1/admin/reports/:id` | Cierra un reporte; `status`: `resolved` o `dismissed` | Admin |
| `POST /api/v1/admin/publications/:id/moderate` | Modera; `action`: `suspend` o `remove` | Admin |
| `POST /api/v1/admin/publications/:id/unsuspend` | Reactiva una publicación suspendida sin reportes abiertos | Admin |

Quien tuvo una reclamación rechazada no puede volver a reclamar esa publicación (403 `RECLAMACION_RECHAZADA`). Retirar la solicitud propia sí permite intentarlo de nuevo.

El rol `admin` se asigna manualmente en la base de datos:

```sql
update public.users set role = 'admin' where id = '<uuid del usuario>';
```

Los errores responden `{ "error": { "code", "message" } }`. Lo que una persona no puede ver responde 404, para no revelar que existe.

**Fotos:** se pide la URL de subida, se sube el archivo con `uploadToSignedUrl` de Supabase y se registra la ruta devuelta. El bucket es privado y las fotos se entregan con URLs firmadas de una hora.

**Chat en tiempo real:** los mensajes se envían al backend y se reciben con Supabase Realtime, usando la clave pública y la sesión del usuario. RLS limita la entrega a los dos participantes:

```ts
supabase
  .channel(`chat:${chatId}`)
  .on(
    "postgres_changes",
    { event: "INSERT", schema: "public", table: "messages", filter: `chat_id=eq.${chatId}` },
    ({ new: mensaje }) => agregarMensaje(mensaje),
  )
  .subscribe();
```

## Nota para Windows

Los scripts llaman a las herramientas con `node node_modules/...` en lugar de usar sus comandos directos. Así funcionan aunque la ruta del proyecto contenga `&`, un carácter que rompe los lanzadores `.cmd` que genera npm. Por el mismo motivo, `npx next` o `npx tsc` pueden fallar en esas rutas.
