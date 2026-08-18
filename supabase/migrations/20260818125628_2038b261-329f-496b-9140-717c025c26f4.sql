CREATE TABLE public.games (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  host_key uuid NOT NULL DEFAULT gen_random_uuid(),
  phase text NOT NULL DEFAULT 'lobby',
  round int NOT NULL DEFAULT 0,
  prompt text NOT NULL DEFAULT '',
  phase_ends_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.teams (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id uuid NOT NULL REFERENCES public.games(id) ON DELETE CASCADE,
  name text NOT NULL,
  color text NOT NULL DEFAULT '#00E5FF',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.players (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id uuid NOT NULL REFERENCES public.games(id) ON DELETE CASCADE,
  real_name text NOT NULL,
  nickname text NOT NULL,
  team_id uuid REFERENCES public.teams(id) ON DELETE SET NULL,
  is_host boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.strokes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id uuid NOT NULL REFERENCES public.games(id) ON DELETE CASCADE,
  team_id uuid NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  player_id uuid REFERENCES public.players(id) ON DELETE SET NULL,
  round int NOT NULL DEFAULT 1,
  points jsonb NOT NULL,
  color text NOT NULL DEFAULT '#F5F7FA',
  width real NOT NULL DEFAULT 4,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id uuid NOT NULL REFERENCES public.games(id) ON DELETE CASCADE,
  team_id uuid NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  player_id uuid REFERENCES public.players(id) ON DELETE SET NULL,
  nickname text NOT NULL,
  round int NOT NULL DEFAULT 1,
  content text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.votes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id uuid NOT NULL REFERENCES public.games(id) ON DELETE CASCADE,
  round int NOT NULL DEFAULT 1,
  player_id uuid NOT NULL REFERENCES public.players(id) ON DELETE CASCADE,
  team_id uuid NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (game_id, round, player_id)
);

CREATE INDEX idx_teams_game ON public.teams(game_id);
CREATE INDEX idx_players_game ON public.players(game_id);
CREATE INDEX idx_strokes_game_round ON public.strokes(game_id, round);
CREATE INDEX idx_messages_game_round ON public.messages(game_id, round);
CREATE INDEX idx_votes_game_round ON public.votes(game_id, round);

GRANT SELECT, INSERT, UPDATE ON public.games TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON public.teams TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON public.players TO anon, authenticated;
GRANT SELECT, INSERT ON public.strokes TO anon, authenticated;
GRANT SELECT, INSERT ON public.messages TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON public.votes TO anon, authenticated;
GRANT ALL ON public.games, public.teams, public.players, public.strokes, public.messages, public.votes TO service_role;

ALTER TABLE public.games ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.players ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.strokes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.votes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "games_read" ON public.games FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "games_insert" ON public.games FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "games_update" ON public.games FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);

CREATE POLICY "teams_read" ON public.teams FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "teams_insert" ON public.teams FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "teams_update" ON public.teams FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);

CREATE POLICY "players_read" ON public.players FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "players_insert" ON public.players FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "players_update" ON public.players FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);

CREATE POLICY "strokes_read" ON public.strokes FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "strokes_insert" ON public.strokes FOR INSERT TO anon, authenticated WITH CHECK (true);

CREATE POLICY "messages_read" ON public.messages FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "messages_insert" ON public.messages FOR INSERT TO anon, authenticated WITH CHECK (true);

CREATE POLICY "votes_read" ON public.votes FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "votes_insert" ON public.votes FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "votes_update" ON public.votes FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);

ALTER PUBLICATION supabase_realtime ADD TABLE public.games;
ALTER PUBLICATION supabase_realtime ADD TABLE public.teams;
ALTER PUBLICATION supabase_realtime ADD TABLE public.players;
ALTER PUBLICATION supabase_realtime ADD TABLE public.strokes;
ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.votes;

ALTER TABLE public.strokes REPLICA IDENTITY FULL;
ALTER TABLE public.messages REPLICA IDENTITY FULL;
ALTER TABLE public.games REPLICA IDENTITY FULL;
ALTER TABLE public.players REPLICA IDENTITY FULL;
ALTER TABLE public.votes REPLICA IDENTITY FULL;
ALTER TABLE public.teams REPLICA IDENTITY FULL;