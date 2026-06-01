# Deploy — Backend en Railway, Frontend en Vercel

Monorepo: `backend/` (FastAPI + Dockerfile) y `frontend/` (Next.js).

## 1. Backend + Postgres + Redis en Railway

1. **New Project → Deploy from GitHub repo** → elegí este repo.
2. En el servicio del backend, **Settings → Root Directory = `backend`** (Railway detecta `backend/Dockerfile`).
3. Agregá los plugins **PostgreSQL** y **Redis** (New → Database). Railway inyecta `DATABASE_URL` y `REDIS_URL`.
4. **Variables** del servicio backend (Settings → Variables):

   | Variable | Valor |
   |---|---|
   | `DATABASE_URL` | (lo da el plugin de Postgres — referencialo o pegá su valor) |
   | `REDIS_URL` | (lo da el plugin de Redis) |
   | `JWT_SECRET` | una cadena larga aleatoria |
   | `ANTHROPIC_API_KEY` | tu key |
   | `FOOTBALL_API_KEY` | tu key |
   | `WORLD_CUP_SEASON` | `2026` |
   | `ADMIN_USERNAME` / `ADMIN_EMAIL` / `ADMIN_PASSWORD` | credenciales del admin inicial |
   | `CORS_ORIGINS` | la URL pública del frontend en Vercel (ej. `https://mi-app.vercel.app`) |

5. Deploy. El contenedor corre `alembic upgrade head` y arranca uvicorn en `$PORT`. En el arranque: crea el admin inicial, carga el fixture 2026 (seed) y los planteles.
6. Copiá la **URL pública** del backend (Settings → Networking → Generate Domain), ej. `https://mundial-back.up.railway.app`.

> Las fotos/bios/clubes de jugadores se cargan con los botones del back office (no consumen quota): entrá como admin y usá *Sincronizar*. O ejecutá una vez `POST /admin/squads/enrich` y `/admin/squads/enrich-details`.

## 2. Frontend en Vercel

1. **Add New → Project** → importá este repo.
2. **Root Directory = `frontend`** (Vercel detecta Next.js solo).
3. **Environment Variables**:

   | Variable | Valor |
   |---|---|
   | `NEXT_PUBLIC_API_URL` | la URL pública del backend de Railway (sin barra final) |

4. Deploy. Vercel te da la URL (ej. `https://mi-app.vercel.app`).
5. **Volvé a Railway** y poné esa URL en `CORS_ORIGINS` del backend, y redeploy del backend.

¡Listo! El front en Vercel pega al back de Railway.

## Notas
- El plan **Hobby de Vercel (gratis)** alcanza para uso personal/no comercial.
- **Railway** ya no tiene free tier: plan Hobby ~$5/mes (incluye $5 de uso).
- Variante "todo en Railway": agregá un segundo servicio con Root Directory `frontend` (usa `frontend/Dockerfile`) y seteá el build arg/variable `NEXT_PUBLIC_API_URL`.
- Opción $0: backend en Render (free, se duerme), Postgres en Neon, Redis en Upstash, front en Vercel.
- **API-Football free**: 100 req/día y 10 req/min. El scheduler ya está limitado para respetarlo.
