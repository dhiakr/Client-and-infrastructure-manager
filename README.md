# Client Infrastructure Manager

Client Infrastructure Manager is a full-stack workspace for managing clients, projects, Odoo instances, project assignments, and role-based access. It includes a FastAPI backend, a Next.js frontend, a PostgreSQL database, Docker support, seeded demo users, and an AI operations assistant that can plan or execute validated workspace actions.

## Recommended way to run

The simplest way to run the full project is Docker Compose:

```bash
docker compose up --build
```

Open:

- Frontend: `http://localhost:3000`
- Backend API: `http://localhost:8000`
- Database: `localhost:5432`

Important:

- Use `http://localhost:3000`

What Docker does on startup:

- Starts PostgreSQL
- Waits for the database health check
- Starts the backend container
- Runs `alembic upgrade head`
- Runs the seed script
- Starts Uvicorn on port `8000`
- Builds the frontend
- Starts Next.js on port `3000`

Demo credentials after seeding:

- `Captain Marvel`: `admin@demo.com / admin12345`
- `Spider-Man`: `usera@demo.com / usera12345`
- `Storm`: `userb@demo.com / userb12345`

The seed process is idempotent, so re-running the stack refreshes the themed demo users and Office-inspired workspace records without duplicating the base data.

To stop the stack:

```bash
docker compose down
```

To stop the stack and remove the database volume:

```bash
docker compose down -v
```

## Run locally without Docker

If you want to run the frontend and backend outside containers, the easiest setup is:

1. Run only PostgreSQL with Docker
2. Run the backend locally
3. Run the frontend locally

Start just the database:

```bash
docker compose up db -d
```

### Backend local setup

Requirements:

- Python `3.12`
- PostgreSQL

Create `backend/.env` with:

```env
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/client_infra_manager
SECRET_KEY=change-this-to-a-long-random-secret-key
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=60
API_V1_PREFIX=/api
BACKEND_CORS_ORIGINS=["http://localhost:3000"]
AGENT_MODEL=llama3.2:3b
AGENT_FALLBACK_MODELS=["llama3.2:latest","mistral:latest"]
AGENT_TEMPERATURE=0.1
AGENT_NUM_PREDICT=1200
AGENT_TIMEOUT_SECONDS=12
AGENT_MAX_SERVER_ATTEMPTS=4
```

Then run:

```bash

cd backend
python -m venv .venv
# activate .venv first
pip install -r requirements.txt
alembic upgrade head
python -m app.scripts.seed
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

If you want to activate the virtual environment first:

- PowerShell: `.venv\Scripts\Activate.ps1`
- macOS/Linux: `source .venv/bin/activate`

### Frontend local setup

Requirements:

- Node.js `22`
- npm

Create `frontend/.env.local` with:

```env
NEXT_PUBLIC_API_URL=http://localhost:8000
```

Then run:

```bash
cd frontend
npm ci
npm run dev
```

Open the app at `http://localhost:3000`.

## Backend stack

The backend lives in `backend/` and is built with:

- FastAPI for the HTTP API
- Uvicorn for serving the ASGI app
- SQLAlchemy for ORM and database access
- Alembic for schema migrations
- PostgreSQL as the main application database
- `psycopg2-binary` as the PostgreSQL driver
- `python-jose[cryptography]` for JWT token handling
- `passlib[bcrypt]` and `bcrypt` for password hashing
- `pydantic-settings` for environment-based configuration
- `python-multipart` for request handling support
- `email-validator` for email validation
- `ollama` and `ollamafreeapi` for the backend AI planning integration
- `pytest` and `httpx` for testing
- `black` and `ruff` for formatting and linting

### Backend architecture

The backend is organized into:

- `app/api/routes`: FastAPI route modules
- `app/models`: SQLAlchemy models
- `app/schemas`: request and response schemas
- `app/services`: business logic
- `app/core`: config, database, security
- `app/scripts`: helper scripts such as seeding
- `alembic/`: migration history

### Backend API surface

Main endpoints:

- `/health`
- `/health/db`
- `/api/auth/login`
- `/api/auth/me`
- `/api/clients`
- `/api/projects`
- `/api/projects/{project_id}/instances`
- `/api/instances/{instance_id}`
- `/api/projects/{project_id}/assignments`
- `/api/users`
- `/api/agent/chat`

### Backend auth and permissions

Auth is JWT-based:

- Users log in through `/api/auth/login`
- The backend returns a bearer token
- The frontend stores that token in browser local storage
- `/api/auth/me` is used to restore the current session

Permission rules:

- `admin` users can manage clients, projects, assignments, users, and agent-driven admin actions
- `standard` users are scoped to projects assigned to them
- Standard users can only access clients tied to their assigned projects
- Moving a project to another client is admin-only
- The agent respects the same permission rules as the normal API

### Backend business rules

Important rules implemented in the service layer:

- Client names are unique
- User emails are unique
- A project name must be unique within a client
- A user cannot be assigned to the same project twice
- Only one active production instance is allowed per project
- Deletes cascade through related records

## Frontend stack

The frontend lives in `frontend/` and is built with:

- Next.js `16.2.1`
- React `19.2.4`
- React DOM `19.2.4`
- TypeScript `5`
- Tailwind CSS `4`
- `@tailwindcss/postcss`
- `lucide-react` for icons
- `axios`
- ESLint `9`
- `eslint-config-next`
- `eslint-config-prettier`
- Prettier `3`
- `@types/node`
- `@types/react`
- `@types/react-dom`

### Frontend notes

- The app uses the Next.js App Router
- The current API client in `frontend/services/api.ts` uses `fetch`
- `axios` is installed in `package.json`, but the active request layer is `fetch`
- Session state is handled with React context
- User tokens, known users, and UI preferences are stored in browser local storage
- The UI is role-aware, so the navigation changes for admin vs standard users

### Frontend feature areas

Admin users can access:

- Dashboard
- Clients
- Projects
- Instances
- Assignments
- Settings

Standard users can access:

- Dashboard
- My Projects
- Instances
- Settings

The frontend also includes:

- Login flow
- Session restore from stored token
- Protected routes
- Toast notifications
- Settings/preferences context
- Embedded operations assistant chat widget

## Database

The main application database is PostgreSQL.

Docker uses:

- Image: `postgres:16-alpine`
- Database name: `client_infra_manager`
- Username: `postgres`
- Password: `postgres`
- Port: `5432`

Core tables:

- `clients`
- `users`
- `projects`
- `instances`
- `project_assignments`

Entity relationships:

- `clients -> projects`
- `projects -> instances`
- `users <-> projects` through `project_assignments`

There is also a SQLite database used for backend tests:

- `backend/app/tests/test_api.sqlite3`

That SQLite database is only for tests. The real app is designed around PostgreSQL.

## Docker

Docker support is already included in the project.

### Root `docker-compose.yml`

Services:

- `db`
- `backend`
- `frontend`

### Database container

- Based on `postgres:16-alpine`
- Exposes `5432:5432`
- Uses a named volume: `postgres_data`
- Includes a health check with `pg_isready`

### Backend container

- Built from `backend/Dockerfile`
- Base image: `python:3.12-slim`
- Installs `requirements.txt`
- Runs `backend/docker/entrypoint.py`
- Waits for the database before startup
- Optionally runs migrations and seed on startup
- Exposes `8000:8000`

Backend container environment values configured in Compose include:

- `DATABASE_URL`
- `SECRET_KEY`
- `ALGORITHM`
- `ACCESS_TOKEN_EXPIRE_MINUTES`
- `API_V1_PREFIX`
- `BACKEND_CORS_ORIGINS`
- `AGENT_MODEL`
- `AGENT_FALLBACK_MODELS`
- `AGENT_TEMPERATURE`
- `AGENT_NUM_PREDICT`
- `AGENT_TIMEOUT_SECONDS`
- `AGENT_MAX_SERVER_ATTEMPTS`
- `RUN_DB_MIGRATIONS`
- `RUN_DB_SEED`
- `DB_STARTUP_MAX_ATTEMPTS`
- `DB_STARTUP_SLEEP_SECONDS`

### Frontend container

- Built from `frontend/Dockerfile`
- Base image: `node:22-alpine`
- Installs dependencies with `npm ci`
- Runs a production build with `npm run build`
- Starts through `frontend/docker/start.sh`
- Exposes `3000:3000`

Frontend container environment:

- `NEXT_PUBLIC_API_URL=http://localhost:8000`

### AI and Docker note

There is no Ollama container in `docker-compose.yml`.

The AI agent feature depends on the backend being able to reach public Ollama Free API servers using the configured model values:

- Primary model: `llama3.2:3b`
- Fallback models: `llama3.2:latest`, `mistral:latest`

## AI operations assistant

The app includes an operations assistant in the frontend and a planning/execution service in the backend.

How it works:

- The user sends a natural-language request
- The backend builds a planning prompt
- The AI returns a JSON action plan
- The backend validates the plan against supported actions
- The backend executes the actions with permission checks
- Destructive actions require confirmation

Supported agent action families:

- Search clients, projects, instances, and users
- Create clients, projects, instances, and assignments
- Update clients, projects, and instances
- Delete clients, projects, instances, and assignments

Safety behavior:

- Deletes require confirmation
- Moving a project to another client requires confirmation
- The agent does not invent IDs
- Ambiguous name matches return a clarification error
- Backend permissions still apply even if the AI suggests an action

## Perfect prompt for the AI agent

Use this prompt when you want structured, safe requests:

```text
Please help me manage the Client Infrastructure Manager workspace using the exact details below. If a field is blank, ignore it. If a name could match more than one record, stop and tell me what needs clarification. Do not invent IDs.

Action: [create / update / delete / search / assign / unassign]

Client name: __________
Rename client to: __________

Project name: __________
Rename project to: __________
Project description: __________
Move project to client: __________

Instance name: __________
Rename instance to: __________
Instance type: [production / staging / development]
Instance status: [active / inactive]
Instance URL: __________

User name or email for assignment: __________

Extra instruction: __________

If this request includes deleting something or moving a project to another client, show the plan and require confirmation before execution.
```

Best practice:

- Use `Plan` first if the request is large
- Use exact names when possible
- Include the user email for assignments if you know it
- For deletes, review the confirmation step carefully

## Testing and quality checks

Backend:

```bash
cd backend
pytest
ruff check .
black .
```

Frontend:

```bash
cd frontend
npm run lint
npm run format:check
npm run build
```

## Project structure

```text
client-infra-manager/
|-- backend/
|   |-- alembic/
|   |-- app/
|   |   |-- api/
|   |   |-- core/
|   |   |-- models/
|   |   |-- schemas/
|   |   |-- services/
|   |   |-- scripts/
|   |   `-- tests/
|   |-- Dockerfile
|   |-- pyproject.toml
|   `-- requirements.txt
|-- frontend/
|   |-- app/
|   |-- components/
|   |-- features/
|   |-- lib/
|   |-- services/
|   |-- public/
|   |-- Dockerfile
|   `-- package.json
|-- docker-compose.yml
`-- README.md
```

## Summary

This project uses:

- Backend: FastAPI, SQLAlchemy, Alembic, JWT auth, PostgreSQL, Ollama-based agent planning
- Frontend: Next.js 16, React 19, TypeScript, Tailwind CSS 4
- Database: PostgreSQL for the app, SQLite for tests
- Docker: Compose-based local orchestration with separate database, backend, and frontend services

If you want the quickest path, run `docker compose up --build` and log in with the seeded demo users.
