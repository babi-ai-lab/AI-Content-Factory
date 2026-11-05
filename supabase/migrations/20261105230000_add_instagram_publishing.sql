-- User-scoped media storage for assets intentionally published to Instagram.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'instagram-media',
  'instagram-media',
  true,
  314572800,
  ARRAY['image/jpeg', 'video/mp4']
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

CREATE POLICY "Users can upload their own Instagram media"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'instagram-media'
    AND (storage.foldername(name))[1] = (SELECT auth.uid())::text
  );

CREATE POLICY "Users can update their own Instagram media"
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'instagram-media'
    AND (storage.foldername(name))[1] = (SELECT auth.uid())::text
  )
  WITH CHECK (
    bucket_id = 'instagram-media'
    AND (storage.foldername(name))[1] = (SELECT auth.uid())::text
  );

CREATE POLICY "Users can delete their own Instagram media"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'instagram-media'
    AND (storage.foldername(name))[1] = (SELECT auth.uid())::text
  );

CREATE TABLE public.instagram_publish_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  request_id text NOT NULL CHECK (length(request_id) BETWEEN 1 AND 80),
  media_type text NOT NULL CHECK (media_type IN ('image', 'reel')),
  media_url text NOT NULL CHECK (length(media_url) <= 2048),
  caption text NOT NULL DEFAULT '' CHECK (length(caption) <= 2200),
  status text NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'publishing', 'published', 'failed')),
  published_media_id text,
  error_code text,
  error_message text,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, request_id)
);

CREATE INDEX instagram_publish_jobs_user_created_idx
  ON public.instagram_publish_jobs (user_id, created_at DESC);

ALTER TABLE public.instagram_publish_jobs ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE ON public.instagram_publish_jobs TO authenticated;
GRANT DELETE ON public.instagram_publish_jobs TO authenticated;

CREATE POLICY "Users can read their own Instagram publish jobs"
  ON public.instagram_publish_jobs FOR SELECT TO authenticated
  USING ((SELECT auth.uid()) = user_id);

CREATE POLICY "Users can create their own Instagram publish jobs"
  ON public.instagram_publish_jobs FOR INSERT TO authenticated
  WITH CHECK ((SELECT auth.uid()) = user_id);

CREATE POLICY "Users can update their own Instagram publish jobs"
  ON public.instagram_publish_jobs FOR UPDATE TO authenticated
  USING ((SELECT auth.uid()) = user_id)
  WITH CHECK ((SELECT auth.uid()) = user_id);

CREATE POLICY "Users can delete their own Instagram publish jobs"
  ON public.instagram_publish_jobs FOR DELETE TO authenticated
  USING ((SELECT auth.uid()) = user_id);

-- The RPC exposes only encrypted token material and only to the authenticated owner.
-- The encryption key remains server-only; plaintext credentials are never returned.
CREATE OR REPLACE FUNCTION public.get_own_instagram_publish_credentials()
RETURNS TABLE (
  instagram_user_id text,
  encrypted_access_token text,
  token_expires_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT c.instagram_user_id, c.encrypted_access_token, c.token_expires_at
  FROM public.instagram_connections AS c
  WHERE c.user_id = (SELECT auth.uid())
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.get_own_instagram_publish_credentials() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_own_instagram_publish_credentials() TO authenticated;
