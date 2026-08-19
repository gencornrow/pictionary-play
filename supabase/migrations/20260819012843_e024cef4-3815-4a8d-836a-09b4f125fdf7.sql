ALTER TABLE public.votes ADD COLUMN IF NOT EXISTS rank integer NOT NULL DEFAULT 1;
ALTER TABLE public.votes DROP CONSTRAINT IF EXISTS votes_game_id_round_player_id_key;
ALTER TABLE public.votes DROP CONSTRAINT IF EXISTS votes_unique_per_round;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='votes_rank_range') THEN
    ALTER TABLE public.votes ADD CONSTRAINT votes_rank_range CHECK (rank BETWEEN 1 AND 3);
  END IF;
END $$;
CREATE UNIQUE INDEX IF NOT EXISTS votes_player_round_rank_idx ON public.votes (game_id, round, player_id, rank);
CREATE UNIQUE INDEX IF NOT EXISTS votes_player_round_team_idx ON public.votes (game_id, round, player_id, team_id);
ALTER TABLE public.players ADD COLUMN IF NOT EXISTS ink_color text NOT NULL DEFAULT '#F5F7FA';