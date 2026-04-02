# Client Infrastructure Manager Frontend

Next.js 16 App Router frontend for managing:

- Clients
- Projects
- Odoo instances
- Project assignments

## Architecture

```text
app/
  (auth)/login
  (app)/dashboard
  (app)/clients
  (app)/projects
  (app)/instances
  (app)/assignments
  (app)/settings
components/
  auth/
  layout/
  providers/
  ui/
features/
  auth/
  dashboard/
  clients/
  projects/
  instances/
  assignments/
  settings/
lib/
services/
types/
```

## Runtime model

- Auth is handled client-side with a persisted bearer token.
- Role-aware navigation is driven from the session provider.
- Admins see the full portfolio and assignment controls.
- Standard users only see assigned projects and related instances.
- The frontend enforces the single active production instance rule in the UI and still respects backend validation.

## Commands

```bash
npm install
npm run dev
npm run lint
npm run build
```

## Environment

Set `NEXT_PUBLIC_API_URL` if the API is not running at `http://localhost:8000`.
