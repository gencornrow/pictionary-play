-- Whiteboard local database schema.
-- Mirrors the cloud backend's tables, constraints, and indexes, minus the
-- cloud-specific pieces (row-level security, grants, realtime publication),
-- because the app's own server code is the only client of this database.
-- Mounted into the Postgres container at /docker-entrypoint-initdb.d/ so it
-- runs automatically on first start.

CREATE TABLE IF NOT EXISTS public.games (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  phase text NOT NULL DEFAULT 'lobby',
  round int NOT NULL DEFAULT 0,
  prompt text NOT NULL DEFAULT '',
  phase_ends_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT games_prompt_len CHECK (char_length(prompt) <= 120),
  CONSTRAINT games_code_len CHECK (char_length(code) BETWEEN 4 AND 12),
  CONSTRAINT games_phase_len CHECK (char_length(phase) <= 20)
);

CREATE TABLE IF NOT EXISTS public.teams (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id uuid NOT NULL REFERENCES public.games(id) ON DELETE CASCADE,
  name text NOT NULL,
  color text NOT NULL DEFAULT '#1F3B5B',
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT teams_name_len CHECK (char_length(name) BETWEEN 1 AND 40),
  CONSTRAINT teams_color_len CHECK (char_length(color) <= 32)
);

CREATE TABLE IF NOT EXISTS public.players (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id uuid NOT NULL REFERENCES public.games(id) ON DELETE CASCADE,
  real_name text NOT NULL,
  nickname text NOT NULL,
  team_id uuid REFERENCES public.teams(id) ON DELETE SET NULL,
  is_host boolean NOT NULL DEFAULT false,
  ink_color text NOT NULL DEFAULT '#1F3B5B',
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT players_real_name_len CHECK (char_length(real_name) BETWEEN 1 AND 60),
  CONSTRAINT players_nickname_len CHECK (char_length(nickname) BETWEEN 1 AND 40),
  CONSTRAINT players_ink_color_len CHECK (char_length(ink_color) <= 32)
);

CREATE TABLE IF NOT EXISTS public.strokes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id uuid NOT NULL REFERENCES public.games(id) ON DELETE CASCADE,
  team_id uuid NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  player_id uuid REFERENCES public.players(id) ON DELETE SET NULL,
  round int NOT NULL DEFAULT 1,
  points jsonb NOT NULL,
  color text NOT NULL DEFAULT '#1F3B5B',
  width real NOT NULL DEFAULT 4,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT strokes_points_size CHECK (
    jsonb_typeof(points) = 'array'
    AND jsonb_array_length(points) BETWEEN 1 AND 2000
    AND pg_column_size(points) <= 200000
  ),
  CONSTRAINT strokes_color_len CHECK (char_length(color) <= 32),
  CONSTRAINT strokes_width_range CHECK (width > 0 AND width <= 200)
);

CREATE TABLE IF NOT EXISTS public.messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id uuid NOT NULL REFERENCES public.games(id) ON DELETE CASCADE,
  team_id uuid NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  player_id uuid REFERENCES public.players(id) ON DELETE SET NULL,
  nickname text NOT NULL,
  round int NOT NULL DEFAULT 1,
  content text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT messages_content_len CHECK (char_length(content) BETWEEN 1 AND 500),
  CONSTRAINT messages_nickname_len CHECK (char_length(nickname) BETWEEN 1 AND 40)
);

CREATE TABLE IF NOT EXISTS public.votes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id uuid NOT NULL REFERENCES public.games(id) ON DELETE CASCADE,
  round int NOT NULL DEFAULT 1,
  player_id uuid NOT NULL REFERENCES public.players(id) ON DELETE CASCADE,
  team_id uuid NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  rank integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT votes_rank_range CHECK (rank BETWEEN 1 AND 3)
);

CREATE UNIQUE INDEX IF NOT EXISTS votes_player_round_rank_idx ON public.votes (game_id, round, player_id, rank);
CREATE UNIQUE INDEX IF NOT EXISTS votes_player_round_team_idx ON public.votes (game_id, round, player_id, team_id);
CREATE INDEX IF NOT EXISTS idx_teams_game ON public.teams(game_id);
CREATE INDEX IF NOT EXISTS idx_players_game ON public.players(game_id);
CREATE INDEX IF NOT EXISTS idx_strokes_game_round ON public.strokes(game_id, round);
CREATE INDEX IF NOT EXISTS idx_messages_game_round ON public.messages(game_id, round);
CREATE INDEX IF NOT EXISTS idx_votes_game_round ON public.votes(game_id, round);
CREATE INDEX IF NOT EXISTS idx_votes_game ON public.votes(game_id);
