ALTER TABLE public.instagram_publish_jobs
  ADD COLUMN IF NOT EXISTS container_id text;

DROP POLICY IF EXISTS "Users can read their own Instagram media" ON storage.objects;

CREATE POLICY "Users can read their own Instagram media"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'instagram-media'
  AND (storage.foldername(name))[1] = (SELECT auth.uid())::text
);
