-- Full-history analytics calculated in PostgreSQL under the caller's RLS context.
CREATE OR REPLACE FUNCTION public.get_content_analytics(p_period_days integer DEFAULT 30)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = ''
AS $function$
DECLARE
  v_user_id uuid := auth.uid();
  v_stats record;
  v_trend jsonb;
  v_business jsonb;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '28000';
  END IF;

  IF p_period_days IS NOT NULL AND p_period_days NOT IN (7, 30) THEN
    RAISE EXCEPTION 'Unsupported analytics period' USING ERRCODE = '22023';
  END IF;

  WITH scoped AS MATERIALIZED (
    SELECT h.created_at, h.product, h.content
    FROM public.content_history AS h
    WHERE h.user_id = v_user_id
      AND (
        p_period_days IS NULL
        OR h.created_at >= now() - make_interval(days => p_period_days)
      )
  )
  SELECT
    count(*)::integer AS total_entries,
    count(*) FILTER (WHERE btrim(coalesce(content->>'caption', '')) <> '')::integer AS captions,
    count(*) FILTER (WHERE btrim(coalesce(content->>'reel', '')) <> '')::integer AS reels,
    coalesce(sum(
      CASE
        WHEN jsonb_typeof(content->'stories') = 'array'
          THEN jsonb_array_length(content->'stories')
        ELSE 0
      END
    ), 0)::integer AS stories,
    count(*) FILTER (WHERE btrim(coalesce(content->>'ad', '')) <> '')::integer AS ads,
    count(*) FILTER (WHERE product #>> '{_factoryMeta,favorite}' = 'true')::integer AS favorites,
    count(DISTINCT coalesce(nullif(product #>> '{_factoryMeta,folder}', ''), 'عمومی'))::integer AS folders
  INTO v_stats
  FROM scoped;

  WITH days AS (
    SELECT generate_series(current_date - 6, current_date, interval '1 day')::date AS day
  )
  SELECT coalesce(
    jsonb_agg(
      jsonb_build_object(
        'key', to_char(days.day, 'YYYY-MM-DD'),
        'count', (
          SELECT count(*)::integer
          FROM public.content_history AS h
          WHERE h.user_id = v_user_id
            AND h.created_at >= days.day::timestamptz
            AND h.created_at < (days.day + 1)::timestamptz
            AND (
              p_period_days IS NULL
              OR h.created_at >= now() - make_interval(days => p_period_days)
            )
        )
      )
      ORDER BY days.day
    ),
    '[]'::jsonb
  )
  INTO v_trend
  FROM days;

  WITH business_counts AS (
    SELECT coalesce(product->>'businessType', 'other') AS business_type, count(*)::integer AS count
    FROM public.content_history AS h
    WHERE h.user_id = v_user_id
      AND (
        p_period_days IS NULL
        OR h.created_at >= now() - make_interval(days => p_period_days)
      )
    GROUP BY 1
  )
  SELECT coalesce(
    jsonb_agg(
      jsonb_build_object(
        'label',
        CASE business_type
          WHEN 'retail' THEN 'فروشگاه و خرده‌فروشی'
          WHEN 'services' THEN 'خدمات و مشاغل'
          WHEN 'restaurant' THEN 'رستوران و کافه'
          WHEN 'real_estate' THEN 'املاک'
          WHEN 'construction' THEN 'ساختمان و بازسازی'
          WHEN 'education' THEN 'آموزش و دوره‌های آموزشی'
          WHEN 'fitness' THEN 'ورزش و تناسب اندام'
          WHEN 'personal_brand' THEN 'برند شخصی'
          ELSE 'سایر کسب‌وکارها'
        END,
        'count', count
      )
      ORDER BY count DESC
    ),
    '[]'::jsonb
  )
  INTO v_business
  FROM business_counts;

  RETURN jsonb_build_object(
    'entries', jsonb_build_object('length', v_stats.total_entries),
    'totalPieces', v_stats.captions + v_stats.reels + v_stats.stories + v_stats.ads,
    'favorites', v_stats.favorites,
    'folders', v_stats.folders,
    'maxDaily', greatest(
      1,
      coalesce((
        SELECT max((item->>'count')::integer)
        FROM jsonb_array_elements(v_trend) AS item
      ), 0)
    ),
    'trend', v_trend,
    'formats', jsonb_build_array(
      jsonb_build_object('label', 'کپشن', 'count', v_stats.captions),
      jsonb_build_object('label', 'سناریوی ریلز', 'count', v_stats.reels),
      jsonb_build_object('label', 'استوری', 'count', v_stats.stories),
      jsonb_build_object('label', 'تبلیغ', 'count', v_stats.ads)
    ),
    'byBusiness', v_business
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.get_content_analytics(integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_content_analytics(integer) TO authenticated;
