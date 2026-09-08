# Roadmap — Dual-backend mode (cloud + local Postgres)

- [x] Read current schema/migrations and game route
- [x] Add `postgres` dependency
- [x] `db/init.sql` — local Postgres schema (tables, constraints, indexes; no RLS/grants)
- [x] `src/lib/backend/backend.server.ts` — mode switch + cloud/local implementations
- [x] `src/lib/game.functions.ts` — server functions wrapping the backend
- [x] Rewire `src/routes/index.tsx` to server functions
- [x] Rewire `src/routes/game.$code.tsx` (server functions; cloud realtime vs local polling)
- [x] `docker-compose.yml` — Postgres service, healthcheck, env wiring
- [x] `README.md` — document the switch and local run
- [x] Typecheck + production build pass
- [x] Cloud mode verified in preview (host/join/teams/draw/vote smoke test)
- [x] Local Postgres backend verified against a real Postgres 16 instance
