# Mundial 2026 ⚽🏆

Aplicación full-stack del Mundial 2026: fixture, estadísticas en vivo, prode con amigos y predicciones de IA por partido.

- **Backend**: FastAPI (Python 3.11) + SQLAlchemy 2.0 + Alembic + PostgreSQL + Redis
- **Frontend**: Next.js 14 (App Router) + TypeScript + Tailwind CSS + SWR
- **APIs externas**: API-Football (RapidAPI / api-sports.io) y Anthropic (Claude)

```
mundial-app/
├── backend/            # FastAPI app + Alembic + tests
├── frontend/           # Next.js 14 app (mobile-first)
├── docker-compose.yml  # Postgres 15 + Redis 7 para desarrollo local
└── README.md
```

---

## 1. Requisitos

- Docker + Docker Compose (para Postgres y Redis locales)
- Python **3.11** (el backend usa sintaxis 3.10+; no funciona en 3.9)
- Node.js 18+ y npm

---

## 2. Servicios locales (Postgres + Redis)

```bash
docker compose up -d
```

Levanta Postgres en `:5432` (db `mundial2026`, user `user`, pass `pass`) y Redis en `:6379`, con volúmenes persistentes.

---

## 3. Backend

```bash
cd backend
python3.11 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt

cp .env.example .env        # completá tus claves
alembic upgrade head        # crea las tablas
uvicorn app.main:app --reload --port 8000
```

API docs interactivas en `http://localhost:8000/docs`.

### Variables de entorno (`backend/.env`)

| Variable | Descripción |
|---|---|
| `DATABASE_URL` | `postgresql://user:pass@localhost:5432/mundial2026` |
| `REDIS_URL` | `redis://localhost:6379` |
| `FOOTBALL_API_KEY` | API key de API-Football (RapidAPI / api-sports.io) |
| `FOOTBALL_API_HOST` | `v3.football.api-sports.io` |
| `ANTHROPIC_API_KEY` | API key de Anthropic |
| `JWT_SECRET` | Secret para firmar JWT |
| `ADMIN_TOKEN` | Token para las rutas `/admin` (header `X-Admin-Token`) |
| `CORS_ORIGINS` | Orígenes permitidos separados por coma |

### Tests

```bash
cd backend && source .venv/bin/activate
pytest -q                   # incluye tests/test_scoring.py (motor de puntuación)
```

### Qué hace el backend

- **Modelos**: groups, users, matches, columns, predictions, scores, ai_predictions.
- **Scoring** (`services/scoring.py`): +3 resultado, +2 goles totales exactos, +1 amarillas, +1 rojas, +3 bonus (resultado + goles). Desacoplado del ORM y cubierto por tests.
- **Recálculo automático** de puntos cuando un partido pasa a `finished`, más `POST /admin/columns/{id}/recalculate` manual.
- **Sync** con API-Football vía APScheduler: en vivo cada 30s, partidos del día cada 5min, stats por hora, y carga del fixture completo al iniciar.
- **IA** (`services/anthropic_ai.py`): arma contexto (forma, stats, H2H, lineups, cuotas), pide JSON a Claude, lo guarda y cachea en Redis (1h; regenera si >6h). Se dispara ~2h antes de cada partido.
- **Rate limiting** en `/ai/match/{id}` a 10 req/min por IP (slowapi + Redis).

---

## 4. Frontend

```bash
cd frontend
npm install
cp .env.local.example .env.local   # o crealo a mano (ver abajo)
npm run dev                          # http://localhost:3000
npm run build                        # build de producción
```

### Variables de entorno (`frontend/.env.local`)

```
NEXT_PUBLIC_API_URL=http://localhost:8000
NEXT_PUBLIC_ADMIN_TOKEN=<igual al ADMIN_TOKEN del backend>
```

### Pantallas

| Ruta | Descripción |
|---|---|
| `/fixture` | Lista de partidos por día (tz local), filtros, polling 30/60s |
| `/matches/[id]` | Detalle: eventos, stats en vivo, predicción IA, tu predicción |
| `/teams` | Tablas de los grupos del Mundial (A–L) |
| `/teams/[id]` | Perfil de selección: stats, últimos partidos, plantel |
| `/prode` | Ranking del grupo + formulario de predicciones |
| `/grupos` | Crear o unirse a un grupo |
| `/admin` | Gestión de columnas (puntajes, activar/cerrar, recalcular) |

Diseño mobile-first (max-width 420px), navegación inferior de 5 tabs, fondo gris, acento azul. Conversión de timezone 100% en el cliente (el backend siempre devuelve UTC).

---

## 5. Conexión Frontend ↔ Backend (adaptador)

El frontend y el backend nacieron de **dos specs distintas**. Se conectaron con una **capa adaptadora** en `frontend/src/lib/api.ts` (el backend es la fuente de verdad). El adaptador:

- Apunta a la raíz del backend (`NEXT_PUBLIC_API_URL=http://localhost:8000`).
- Usa **auth JWT**: guarda el token de `/auth/create-group` y `/auth/join` y lo manda como `Authorization: Bearer`. Las rutas `/admin/*` mandan `X-Admin-Token`.
- Traduce los shapes del backend a los tipos del frontend: `kickoff_utc → kickoff_at`, `result home/draw/away → local/empate/visitante`, `score_home/away → suggested_score`, `scoring_config → pts_*`, leaderboard `points/delta_today/streak`, etc.
- Deriva el **emoji de bandera** desde el nombre del equipo (`lib/flags.ts`), porque el backend guarda nombres, no emojis.
- Resuelve la **columna activa** del grupo desde `/groups/{id}/columns` (no se guarda en localStorage).

### ⚠️ Datos: plan free de API-Football

El **plan Free no tiene acceso a la temporada 2026** (responde *"try from 2022 to 2024"*). Por eso `WORLD_CUP_SEASON=2022` en `backend/.env` para usar datos **reales** del Mundial de Qatar (64 partidos). Cambialo a `2026` cuando tengas un plan que lo cubra y se poblará solo.

El plan free permite **100 requests/día**. Para no agotarlo:
- El scheduler consulta primero la DB y **solo llama a la API externa cuando hay partidos en vivo o por empezar en 2h** (en reposo: ~0 requests). Cadencias: live 60s, hoy 15min, full fixture cada 6h.
- `football_api` **cachea cada respuesta en Redis** con TTL por endpoint.
- La predicción IA **solo se genera con el botón explícito** ("Generar con IA" / regenerar). El auto-fetch del detalle devuelve la guardada o 404, sin gastar requests (cada generación consume ~7 llamadas a API-Football + 1 a Anthropic).

## 6. Correr sin Docker (Postgres + Redis vía Homebrew)

Si no tenés Docker:

```bash
brew install postgresql@15 redis
brew services start postgresql@15
brew services start redis
# crear rol + base que espera el DATABASE_URL
psql -d postgres -c "CREATE ROLE \"user\" LOGIN PASSWORD 'pass';"
psql -d postgres -c "CREATE DATABASE mundial2026 OWNER \"user\";"
```

Luego, en `backend/`: `alembic upgrade head` y `uvicorn app.main:app --port 8000`.

### Bootstrap de un grupo + columna (primer uso)

1. En la app, `/grupos` → **Crear grupo** (genera tu usuario + token).
2. En `/admin` → **+ Nueva** columna (ej. "Fase de grupos") → **Activar**. Necesita `NEXT_PUBLIC_ADMIN_TOKEN` (= `ADMIN_TOKEN` del backend).
3. Ya podés predecir en `/prode` y ver el ranking en `/grupos`.
