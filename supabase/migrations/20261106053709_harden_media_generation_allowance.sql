-- Keep hourly media reservations atomic without exposing a SECURITY DEFINER RPC.
CREATE POLICY "Users can read only their own media allowance"
  ON public.media_generation_allowance FOR SELECT TO authenticated
  USING ((SELECT auth.uid()) = user_id);

CREATE POLICY "Users can create only their own media allowance"
  ON public.media_generation_allowance FOR INSERT TO authenticated
  WITH CHECK ((SELECT auth.uid()) = user_id);

CREATE POLICY "Users can update only their own media allowance"
  ON public.media_generation_allowance FOR UPDATE TO authenticated
  USING ((SELECT auth.uid()) = user_id)
  WITH CHECK ((SELECT auth.uid()) = user_id);

GRANT SELECT, INSERT, UPDATE ON public.media_generation_allowance TO authenticated;

CREATE OR REPLACE FUNCTION public.enforce_media_generation_allowance()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_window timestamptz := date_trunc('hour', now());
BEGIN
  IF TG_OP = 'INSERT' THEN
    NEW.window_started_at := v_window;
    NEW.request_count := 1;
    RETURN NEW;
  END IF;

  IF NEW.user_id <> OLD.user_id THEN
    RAISE EXCEPTION 'MEDIA_ALLOWANCE_OWNER_IMMUTABLE';
  END IF;

  IF OLD.window_started_at < v_window THEN
    NEW.window_started_at := v_window;
    NEW.request_count := 1;
  ELSE
    NEW.window_started_at := OLD.window_started_at;
    NEW.request_count := OLD.request_count + 1;
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.enforce_media_generation_allowance() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS enforce_media_generation_allowance_trigger
  ON public.media_generation_allowance;
CREATE TRIGGER enforce_media_generation_allowance_trigger
  BEFORE INSERT OR UPDATE ON public.media_generation_allowance
  FOR EACH ROW EXECUTE FUNCTION public.enforce_media_generation_allowance();

CREATE OR REPLACE FUNCTION public.reserve_media_generation()
RETURNS integer
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_count integer;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'AUTH_REQUIRED';
  END IF;

  INSERT INTO public.media_generation_allowance (user_id, window_started_at, request_count)
  VALUES (v_user_id, date_trunc('hour', now()), 0)
  ON CONFLICT (user_id) DO UPDATE
    SET request_count = public.media_generation_allowance.request_count
  RETURNING request_count INTO v_count;

  IF v_count > 5 THEN
    RAISE EXCEPTION 'MEDIA_GENERATION_LIMIT';
  END IF;
  RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION public.reserve_media_generation() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.reserve_media_generation() TO authenticated;

COMMENT ON FUNCTION public.reserve_media_generation() IS
  'Atomic per-user image reservation. SECURITY INVOKER; owner-scoped RLS and a non-callable trigger enforce counters.';
