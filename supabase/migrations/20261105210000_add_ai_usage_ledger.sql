-- Usage telemetry for successful AI generations.
CREATE TABLE public.ai_usage_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  request_id uuid NOT NULL,
  model text NOT NULL CHECK (length(model) BETWEEN 1 AND 128),
  prompt_tokens integer NOT NULL DEFAULT 0 CHECK (prompt_tokens >= 0),
  candidate_tokens integer NOT NULL DEFAULT 0 CHECK (candidate_tokens >= 0),
  total_tokens integer NOT NULL DEFAULT 0 CHECK (total_tokens >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, request_id)
);

CREATE INDEX ai_usage_events_user_created_at_idx
  ON public.ai_usage_events (user_id, created_at DESC);

ALTER TABLE public.ai_usage_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.ai_usage_events FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.ai_usage_events TO authenticated;

CREATE POLICY "Users can read their own AI usage"
  ON public.ai_usage_events
  FOR SELECT
  TO authenticated
  USING ((SELECT auth.uid()) = user_id);

CREATE OR REPLACE FUNCTION private.record_ai_usage(
  p_request_id uuid,
  p_model text,
  p_prompt_tokens integer,
  p_candidate_tokens integer,
  p_total_tokens integer
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_user_id uuid := auth.uid();
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '28000';
  END IF;

  IF p_request_id IS NULL OR p_model IS NULL OR length(p_model) NOT BETWEEN 1 AND 128 THEN
    RAISE EXCEPTION 'Invalid AI usage event' USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.ai_usage_events (
    user_id, request_id, model, prompt_tokens, candidate_tokens, total_tokens
  )
  VALUES (
    v_user_id,
    p_request_id,
    p_model,
    greatest(coalesce(p_prompt_tokens, 0), 0),
    greatest(coalesce(p_candidate_tokens, 0), 0),
    greatest(coalesce(p_total_tokens, 0), 0)
  )
  ON CONFLICT (user_id, request_id) DO NOTHING;
END;
$function$;

REVOKE ALL ON FUNCTION private.record_ai_usage(uuid, text, integer, integer, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.record_ai_usage(uuid, text, integer, integer, integer) TO authenticated;

CREATE OR REPLACE FUNCTION public.record_ai_usage(
  p_request_id uuid,
  p_model text,
  p_prompt_tokens integer,
  p_candidate_tokens integer,
  p_total_tokens integer
)
RETURNS void
LANGUAGE sql
SECURITY INVOKER
SET search_path = ''
AS $function$
  SELECT private.record_ai_usage(
    p_request_id, p_model, p_prompt_tokens, p_candidate_tokens, p_total_tokens
  );
$function$;

REVOKE ALL ON FUNCTION public.record_ai_usage(uuid, text, integer, integer, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.record_ai_usage(uuid, text, integer, integer, integer) TO authenticated;

CREATE OR REPLACE FUNCTION public.get_ai_usage_summary(p_period_days integer DEFAULT 30)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = ''
AS $function$
DECLARE
  v_user_id uuid := auth.uid();
  v_generations integer;
  v_prompt_tokens integer;
  v_candidate_tokens integer;
  v_total_tokens integer;
  v_models jsonb;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '28000';
  END IF;

  IF p_period_days IS NOT NULL AND p_period_days NOT IN (7, 30) THEN
    RAISE EXCEPTION 'Unsupported usage period' USING ERRCODE = '22023';
  END IF;

  SELECT
    count(*)::integer,
    coalesce(sum(prompt_tokens), 0)::integer,
    coalesce(sum(candidate_tokens), 0)::integer,
    coalesce(sum(total_tokens), 0)::integer
  INTO v_generations, v_prompt_tokens, v_candidate_tokens, v_total_tokens
  FROM public.ai_usage_events
  WHERE user_id = v_user_id
    AND (p_period_days IS NULL OR created_at >= now() - make_interval(days => p_period_days));

  SELECT coalesce(
    jsonb_agg(
      jsonb_build_object(
        'model', model,
        'generations', generations,
        'totalTokens', total_tokens
      )
      ORDER BY generations DESC
    ),
    '[]'::jsonb
  )
  INTO v_models
  FROM (
    SELECT model, count(*)::integer AS generations, coalesce(sum(total_tokens), 0)::integer AS total_tokens
    FROM public.ai_usage_events
    WHERE user_id = v_user_id
      AND (p_period_days IS NULL OR created_at >= now() - make_interval(days => p_period_days))
    GROUP BY model
  ) AS model_usage;

  RETURN jsonb_build_object(
    'generations', v_generations,
    'promptTokens', v_prompt_tokens,
    'candidateTokens', v_candidate_tokens,
    'totalTokens', v_total_tokens,
    'models', v_models
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.get_ai_usage_summary(integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_ai_usage_summary(integer) TO authenticated;
