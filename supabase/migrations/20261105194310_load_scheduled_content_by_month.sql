-- Retrieve every scheduled content item in a requested ISO date range.
-- The function runs as the caller and remains subject to content_history RLS.
CREATE INDEX IF NOT EXISTS content_history_user_scheduled_at_idx
  ON public.content_history (user_id, (product #>> '{_factoryMeta,scheduledAt}'))
  WHERE (product #>> '{_factoryMeta,scheduledAt}') IS NOT NULL;

CREATE OR REPLACE FUNCTION public.get_scheduled_content_for_range(
  p_start_iso text,
  p_end_iso text
)
RETURNS TABLE (
  id uuid,
  product jsonb,
  content jsonb,
  created_at timestamptz,
  scheduled_at text
)
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = ''
AS $function$
DECLARE
  v_user_id uuid := auth.uid();
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '28000';
  END IF;

  IF p_start_iso IS NULL
    OR p_end_iso IS NULL
    OR length(p_start_iso) > 40
    OR length(p_end_iso) > 40
    OR p_start_iso >= p_end_iso THEN
    RAISE EXCEPTION 'Invalid calendar date range' USING ERRCODE = '22023';
  END IF;

  RETURN QUERY
  SELECT
    h.id,
    h.product,
    h.content,
    h.created_at,
    h.product #>> '{_factoryMeta,scheduledAt}' AS scheduled_at
  FROM public.content_history AS h
  WHERE h.user_id = v_user_id
    AND h.product #>> '{_factoryMeta,scheduledAt}' >= p_start_iso
    AND h.product #>> '{_factoryMeta,scheduledAt}' < p_end_iso
  ORDER BY h.product #>> '{_factoryMeta,scheduledAt}' ASC, h.id ASC;
END;
$function$;

REVOKE ALL ON FUNCTION public.get_scheduled_content_for_range(text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_scheduled_content_for_range(text, text) TO authenticated;
