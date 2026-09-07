# Whiteboard

Whiteboard is a live, team-based drawing party game. Everyone joins under a randomly assigned nickname, then teams get one minute to scheme in private chat, two minutes to draw the host's prompt together on a shared canvas, and finally vote on the best board (except their own). At the end, the host reveals final scores and each player's real name.

This project was built with [Lovable](https://lovable.dev).

## Game flow

1. **Create or join a room** — The host creates a room and shares the short room code. Players enter the code and their real name; everyone receives a random nickname automatically.
2. **Teams are assigned** — The host generates balanced teams from the joined players. The host does not join a team; their role is to run the game.
3. **Discuss (1 minute)** — Teammates chat privately to agree on a drawing plan.
4. **Draw (2 minutes)** — All teams draw the same prompt at the same time on their own shared whiteboards. Players use a persistent brush color and can switch to an eraser. Team chat stays open during drawing.
5. **Vote** — Players cast up to three ranked-choice votes on other teams' boards. First place = 3 points, second = 2 points, third = 1 point.
6. **Results** — The round scores are revealed. The host can run as many rounds as they like.
7. **Complete game** — When the host is ready, they click **Complete game** to show the final standings and reveal every player's real name.

## Tech stack

- **TanStack Start** — Full-stack React framework with SSR, file-based routing, and server functions.
- **TanStack Router / TanStack Query** — Client-side routing and async data fetching.
- **React 19** — UI library.
- **TypeScript** — Type-safe frontend and backend code.
- **Tailwind CSS v4** — Utility-first styling.
- **shadcn/ui** — Base UI components.
- **Dual data backend** — Lovable Cloud (hosted Postgres + realtime sync) on Lovable, or a self-contained local Postgres container when self-hosting. Switched with `DATA_BACKEND`. All database access goes through server functions, so the browser never talks to a database directly.
- **postgres** — Postgres driver used for the local backend.
- **Vite** — Build tool and dev server.
- **Zod** — Runtime validation for forms and server inputs.
- **Sonner** — Toast notifications.
- **Lucide React** — Icons.

## Running locally

The app supports two data backends, chosen with the `DATA_BACKEND` environment variable:

- **`local` (default in Docker)** — a Postgres database runs inside docker-compose. Fully self-contained: no cloud account, no internet needed, and no data leaves your network. Live updates use light 1-second polling instead of realtime push; players won't notice a difference.
- **`cloud`** — the built-in Lovable Cloud database (used automatically by the Lovable preview and published app, and by `npm run dev`).

### With Docker (fully self-hosted)

```sh
docker compose build --no-cache
docker compose up
```

This starts two containers: the app and a Postgres database. Tables are created automatically on first start from `db/init.sql`, and game data persists in a Docker volume (`pgdata`) across restarts.

The app will be available at [http://localhost:3000](http://localhost:3000).

To run the Docker container against the cloud database instead of local Postgres:

```sh
DATA_BACKEND=cloud docker compose up
```

(This uses the `SUPABASE_*` / `VITE_SUPABASE_*` values from your `.env` file.)

### Schema changes (dual-backend checklist)

Both backends share the same table structure. If the schema ever changes:

1. Add a migration for the cloud database (`supabase/migrations/`).
2. Mirror the same change in `db/init.sql` for the local Postgres container.
3. For an existing local database, either apply the change manually with `docker compose exec db psql -U whiteboard` or recreate the volume (`docker compose down -v` — this deletes all local game data).

### With Node.js

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/7c72b3a1-35db-4c45-acee-4c73fb7ea056).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.
