CREATE TABLE public.marketing_campaign_content (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  campaign_id uuid NOT NULL REFERENCES public.marketing_campaigns(id) ON DELETE CASCADE,
  content_id uuid NOT NULL REFERENCES public.content_history(id) ON DELETE CASCADE,
  notes text NOT NULL DEFAULT '' CHECK (char_length(notes) <= 500),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT marketing_campaign_content_campaign_content_unique
    UNIQUE (campaign_id, content_id)
);

CREATE INDEX marketing_campaign_content_user_campaign_created_idx
  ON public.marketing_campaign_content (user_id, campaign_id, created_at DESC);

CREATE INDEX marketing_campaign_content_user_content_idx
  ON public.marketing_campaign_content (user_id, content_id);

ALTER TABLE public.marketing_campaign_content ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own campaign content links"
  ON public.marketing_campaign_content
  FOR SELECT TO authenticated
  USING (
    (SELECT auth.uid()) = user_id
    AND EXISTS (
      SELECT 1 FROM public.marketing_campaigns AS c
      WHERE c.id = campaign_id AND c.user_id = (SELECT auth.uid())
    )
    AND EXISTS (
      SELECT 1 FROM public.content_history AS h
      WHERE h.id = content_id AND h.user_id = (SELECT auth.uid())
    )
  );

CREATE POLICY "Users can link their own content to their own campaigns"
  ON public.marketing_campaign_content
  FOR INSERT TO authenticated
  WITH CHECK (
    (SELECT auth.uid()) = user_id
    AND EXISTS (
      SELECT 1 FROM public.marketing_campaigns AS c
      WHERE c.id = campaign_id AND c.user_id = (SELECT auth.uid())
    )
    AND EXISTS (
      SELECT 1 FROM public.content_history AS h
      WHERE h.id = content_id AND h.user_id = (SELECT auth.uid())
    )
  );

CREATE POLICY "Users can update their own campaign content links"
  ON public.marketing_campaign_content
  FOR UPDATE TO authenticated
  USING (
    (SELECT auth.uid()) = user_id
    AND EXISTS (
      SELECT 1 FROM public.marketing_campaigns AS c
      WHERE c.id = campaign_id AND c.user_id = (SELECT auth.uid())
    )
    AND EXISTS (
      SELECT 1 FROM public.content_history AS h
      WHERE h.id = content_id AND h.user_id = (SELECT auth.uid())
    )
  )
  WITH CHECK (
    (SELECT auth.uid()) = user_id
    AND EXISTS (
      SELECT 1 FROM public.marketing_campaigns AS c
      WHERE c.id = campaign_id AND c.user_id = (SELECT auth.uid())
    )
    AND EXISTS (
      SELECT 1 FROM public.content_history AS h
      WHERE h.id = content_id AND h.user_id = (SELECT auth.uid())
    )
  );

CREATE POLICY "Users can unlink their own campaign content"
  ON public.marketing_campaign_content
  FOR DELETE TO authenticated
  USING (
    (SELECT auth.uid()) = user_id
    AND EXISTS (
      SELECT 1 FROM public.marketing_campaigns AS c
      WHERE c.id = campaign_id AND c.user_id = (SELECT auth.uid())
    )
    AND EXISTS (
      SELECT 1 FROM public.content_history AS h
      WHERE h.id = content_id AND h.user_id = (SELECT auth.uid())
    )
  );

REVOKE ALL ON TABLE public.marketing_campaign_content FROM PUBLIC, anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.marketing_campaign_content TO authenticated;
