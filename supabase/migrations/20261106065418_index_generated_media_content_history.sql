-- Index the optional history foreign key used to associate generated media with saved content.
-- This keeps joins and parent-row maintenance efficient as the media library grows.
CREATE INDEX IF NOT EXISTS generated_media_content_history_id_idx
  ON public.generated_media (content_history_id);
