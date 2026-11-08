# CUCEI-FOUND-LOST

Plataforma universitaria para publicar y recuperar objetos perdidos y encontrados dentro de CUCEI.

| Parte | Tecnologías |
|---|---|
| `frontend/` | Next.js, React, TypeScript, Tailwind CSS |
| `backend/` | Node.js, Express, TypeScript (arquitectura modular) |
| Datos y servicios | Supabase con PostgreSQL |

**Estado actual:** Etapa 0, base del proyecto. Los módulos `autenticacion`, `campus`, `publicaciones`, `verificacion` y `chat` existen como estructura, sin implementar.

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

## Nota para Windows

Los scripts llaman a las herramientas con `node node_modules/...` en lugar de usar sus comandos directos. Así funcionan aunque la ruta del proyecto contenga `&`, un carácter que rompe los lanzadores `.cmd` que genera npm. Por el mismo motivo, `npx next` o `npx tsc` pueden fallar en esas rutas.
