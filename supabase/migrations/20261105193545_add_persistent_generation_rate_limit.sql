-- Persistent, atomic per-user generation rate limit.
-- The internal table is kept outside the exposed API schema. The public RPC
-- is SECURITY INVOKER and delegates to a narrowly scoped private function.

CREATE SCHEMA IF NOT EXISTS private;
REVOKE ALL ON SCHEMA private FROM PUBLIC, anon, authenticated;
GRANT USAGE ON SCHEMA private TO authenticated;

CREATE TABLE private.generation_rate_limits (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  window_started_at timestamptz NOT NULL DEFAULT now(),
  request_count integer NOT NULL DEFAULT 0 CHECK (request_count >= 0),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE private.generation_rate_limits ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE private.generation_rate_limits FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION private.consume_generation_request()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_user_id uuid := auth.uid();
  v_request_count integer;
  v_window_started_at timestamptz;
  v_reset_at timestamptz;
  v_retry_after integer;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '28000';
  END IF;

  INSERT INTO private.generation_rate_limits AS current_limit
    (user_id, window_started_at, request_count, updated_at)
  VALUES
    (v_user_id, now(), 1, now())
  ON CONFLICT (user_id) DO UPDATE
  SET
    request_count = CASE
      WHEN current_limit.window_started_at <= now() - interval '10 minutes' THEN 1
      ELSE current_limit.request_count + 1
    END,
    window_started_at = CASE
      WHEN current_limit.window_started_at <= now() - interval '10 minutes' THEN now()
      ELSE current_limit.window_started_at
    END,
    updated_at = now()
  RETURNING request_count, window_started_at
  INTO v_request_count, v_window_started_at;

  v_reset_at := v_window_started_at + interval '10 minutes';
  v_retry_after := greatest(
    0,
    ceil(extract(epoch FROM (v_reset_at - clock_timestamp())))::integer
  );

  RETURN jsonb_build_object(
    'allowed', v_request_count <= 8,
    'request_count', v_request_count,
    'limit', 8,
    'window_seconds', 600,
    'retry_after_seconds', v_retry_after
  );
END;
$function$;

REVOKE ALL ON FUNCTION private.consume_generation_request() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.consume_generation_request() TO authenticated;

CREATE OR REPLACE FUNCTION public.consume_generation_request()
RETURNS jsonb
LANGUAGE sql
SECURITY INVOKER
SET search_path = ''
AS $function$
  SELECT private.consume_generation_request();
$function$;

REVOKE ALL ON FUNCTION public.consume_generation_request() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.consume_generation_request() TO authenticated;
