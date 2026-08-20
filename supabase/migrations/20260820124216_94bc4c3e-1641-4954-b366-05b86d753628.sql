CREATE POLICY votes_delete ON public.votes FOR DELETE TO anon, authenticated USING (true);
GRANT DELETE ON public.votes TO anon, authenticated;