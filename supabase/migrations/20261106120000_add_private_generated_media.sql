-- Private generated image assets and an atomic per-user hourly generation allowance.
CREATE TABLE IF NOT EXISTS public.generated_media (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  storage_path text NOT NULL UNIQUE CHECK (char_length(storage_path) <= 512),
  prompt text NOT NULL CHECK (char_length(prompt) BETWEEN 20 AND 3000),
  aspect_ratio text NOT NULL CHECK (aspect_ratio = ANY (ARRAY['1:1','4:5','9:16','16:9','3:2','2:3'])),
  mime_type text NOT NULL CHECK (mime_type = ANY (ARRAY['image/png','image/jpeg','image/webp'])),
  byte_size integer NOT NULL CHECK (byte_size > 0 AND byte_size <= 8388608),
  content_history_id uuid REFERENCES public.content_history(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS generated_media_user_created_idx
  ON public.generated_media (user_id, created_at DESC);

ALTER TABLE public.generated_media ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read their generated media"
  ON public.generated_media FOR SELECT TO authenticated
  USING ((SELECT auth.uid()) = user_id);

CREATE POLICY "Users can create their generated media"
  ON public.generated_media FOR INSERT TO authenticated
  WITH CHECK (
    (SELECT auth.uid()) = user_id
    AND (
      content_history_id IS NULL
      OR EXISTS (
        SELECT 1 FROM public.content_history AS history
        WHERE history.id = content_history_id
          AND history.user_id = (SELECT auth.uid())
      )
    )
  );

CREATE POLICY "Users can delete their generated media"
  ON public.generated_media FOR DELETE TO authenticated
  USING ((SELECT auth.uid()) = user_id);

GRANT SELECT, INSERT, DELETE ON public.generated_media TO authenticated;
REVOKE ALL ON public.generated_media FROM anon;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('generated-media', 'generated-media', false, 8388608, ARRAY['image/png','image/jpeg','image/webp'])
ON CONFLICT (id) DO UPDATE
SET public = false, file_size_limit = 8388608,
    allowed_mime_types = ARRAY['image/png','image/jpeg','image/webp'];

CREATE POLICY "Users can upload their generated media"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'generated-media'
    AND (storage.foldername(name))[1] = (SELECT auth.uid())::text
  );

CREATE POLICY "Users can read their generated media files"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'generated-media'
    AND (storage.foldername(name))[1] = (SELECT auth.uid())::text
  );

CREATE POLICY "Users can delete their generated media files"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'generated-media'
    AND (storage.foldername(name))[1] = (SELECT auth.uid())::text
  );

CREATE TABLE IF NOT EXISTS public.media_generation_allowance (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  window_started_at timestamptz NOT NULL,
  request_count integer NOT NULL CHECK (request_count >= 0)
);

ALTER TABLE public.media_generation_allowance ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.media_generation_allowance FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.reserve_media_generation()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_window timestamptz := date_trunc('hour', now());
  v_count integer;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'AUTH_REQUIRED';
  END IF;

  INSERT INTO public.media_generation_allowance (user_id, window_started_at, request_count)
  VALUES (v_user_id, v_window, 1)
  ON CONFLICT (user_id) DO UPDATE
  SET window_started_at = CASE
        WHEN public.media_generation_allowance.window_started_at < v_window THEN v_window
        ELSE public.media_generation_allowance.window_started_at
      END,
      request_count = CASE
        WHEN public.media_generation_allowance.window_started_at < v_window THEN 1
        ELSE public.media_generation_allowance.request_count + 1
      END
  RETURNING request_count INTO v_count;

  IF v_count > 5 THEN
    RAISE EXCEPTION 'MEDIA_GENERATION_LIMIT';
  END IF;
  RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION public.reserve_media_generation() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.reserve_media_generation() TO authenticated;
