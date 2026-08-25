ALTER TABLE public.players
  ADD CONSTRAINT players_real_name_len CHECK (char_length(real_name) BETWEEN 1 AND 60),
  ADD CONSTRAINT players_nickname_len CHECK (char_length(nickname) BETWEEN 1 AND 40),
  ADD CONSTRAINT players_ink_color_len CHECK (char_length(ink_color) <= 32);

ALTER TABLE public.messages
  ADD CONSTRAINT messages_content_len CHECK (char_length(content) BETWEEN 1 AND 500),
  ADD CONSTRAINT messages_nickname_len CHECK (char_length(nickname) BETWEEN 1 AND 40);

ALTER TABLE public.games
  ADD CONSTRAINT games_prompt_len CHECK (char_length(prompt) <= 120),
  ADD CONSTRAINT games_code_len CHECK (char_length(code) BETWEEN 4 AND 12),
  ADD CONSTRAINT games_phase_len CHECK (char_length(phase) <= 20);

ALTER TABLE public.teams
  ADD CONSTRAINT teams_name_len CHECK (char_length(name) BETWEEN 1 AND 40),
  ADD CONSTRAINT teams_color_len CHECK (char_length(color) <= 32);

ALTER TABLE public.strokes
  ADD CONSTRAINT strokes_points_size CHECK (
    jsonb_typeof(points) = 'array'
    AND jsonb_array_length(points) BETWEEN 1 AND 2000
    AND pg_column_size(points) <= 200000
  ),
  ADD CONSTRAINT strokes_color_len CHECK (char_length(color) <= 32),
  ADD CONSTRAINT strokes_width_range CHECK (width > 0 AND width <= 200);