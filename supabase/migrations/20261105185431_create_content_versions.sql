-- Immutable snapshots of content edits, scoped to the owning account.
CREATE TABLE public.content_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  history_id uuid NOT NULL REFERENCES public.content_history(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX content_versions_history_created_at_idx
  ON public.content_versions (history_id, created_at DESC);

CREATE INDEX content_versions_user_created_at_idx
  ON public.content_versions (user_id, created_at DESC);

ALTER TABLE public.content_versions ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, DELETE ON public.content_versions TO authenticated;

CREATE POLICY "Users can view their own content versions"
  ON public.content_versions
  FOR SELECT
  TO authenticated
  USING ((select auth.uid()) = user_id);

CREATE POLICY "Users can insert versions for their own content"
  ON public.content_versions
  FOR INSERT
  TO authenticated
  WITH CHECK (
    (select auth.uid()) = user_id
    AND EXISTS (
      SELECT 1
      FROM public.content_history AS history
      WHERE history.id = history_id
        AND history.user_id = (select auth.uid())
    )
  );

CREATE POLICY "Users can delete their own content versions"
  ON public.content_versions
  FOR DELETE
  TO authenticated
  USING ((select auth.uid()) = user_id);
