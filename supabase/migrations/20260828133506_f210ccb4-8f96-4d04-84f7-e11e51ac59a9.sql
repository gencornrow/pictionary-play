CREATE INDEX IF NOT EXISTS idx_messages_game_round ON public.messages(game_id, round);
CREATE INDEX IF NOT EXISTS idx_players_game ON public.players(game_id);
CREATE INDEX IF NOT EXISTS idx_votes_game ON public.votes(game_id);
CREATE INDEX IF NOT EXISTS idx_teams_game ON public.teams(game_id);