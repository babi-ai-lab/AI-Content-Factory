-- Optimize content_history RLS policy evaluation by wrapping auth.uid()
-- in a scalar subquery. This preserves the existing ownership checks while
-- allowing Postgres to evaluate the auth function once per statement.

ALTER POLICY "Users can delete their own content"
  ON public.content_history
  USING ((select auth.uid()) = user_id);

ALTER POLICY "Users can insert their own content"
  ON public.content_history
  WITH CHECK ((select auth.uid()) = user_id);

ALTER POLICY "Users can update their own content"
  ON public.content_history
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);

ALTER POLICY "Users can view their own content"
  ON public.content_history
  USING ((select auth.uid()) = user_id);
