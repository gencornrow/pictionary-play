# Roadmap — Dual-backend mode (cloud + local Postgres)

- [x] Read current schema/migrations and game route
- [ ] Add `postgres` dependency
- [ ] `db/init.sql` — local Postgres schema (tables, constraints, indexes; no RLS/grants)
- [ ] `src/lib/backend/backend.server.ts` — mode switch + cloud/local implementations
- [ ] `src/lib/game.functions.ts` — server functions wrapping the backend
- [ ] Rewire `src/routes/index.tsx` to server functions
- [ ] Rewire `src/routes/game.$code.tsx` (server functions; cloud realtime vs local polling)
- [ ] `docker-compose.yml` — Postgres service, healthcheck, env wiring
- [ ] `README.md` — document the switch and local run
- [ ] Typecheck + verify preview still works in cloud mode
