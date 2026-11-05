-- Scheduled Instagram publishing infrastructure.
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

ALTER TABLE public.instagram_publish_jobs
  ADD COLUMN IF NOT EXISTS scheduled_at timestamptz,
  ADD COLUMN IF NOT EXISTS attempt_count integer NOT NULL DEFAULT 0 CHECK (attempt_count >= 0);

CREATE INDEX IF NOT EXISTS instagram_publish_jobs_due_idx
  ON public.instagram_publish_jobs (scheduled_at, created_at)
  WHERE status = 'queued' AND scheduled_at IS NOT NULL;

CREATE OR REPLACE FUNCTION public.get_instagram_worker_secret(p_name text)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT decrypted_secret
  FROM vault.decrypted_secrets
  WHERE name = p_name
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.get_instagram_worker_secret(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_instagram_worker_secret(text) TO service_role;

CREATE OR REPLACE FUNCTION public.claim_due_instagram_publish_jobs(p_limit integer DEFAULT 10)
RETURNS TABLE (
  id uuid,
  user_id uuid,
  request_id text,
  media_type text,
  media_url text,
  caption text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  RETURN QUERY
  WITH due_jobs AS (
    SELECT j.id
    FROM public.instagram_publish_jobs AS j
    WHERE j.status = 'queued'
      AND j.scheduled_at IS NOT NULL
      AND j.scheduled_at <= now()
    ORDER BY j.scheduled_at ASC, j.created_at ASC
    FOR UPDATE SKIP LOCKED
    LIMIT LEAST(GREATEST(COALESCE(p_limit, 10), 1), 20)
  )
  UPDATE public.instagram_publish_jobs AS j
  SET status = 'publishing',
      started_at = now(),
      attempt_count = j.attempt_count + 1
  FROM due_jobs
  WHERE j.id = due_jobs.id
  RETURNING j.id, j.user_id, j.request_id, j.media_type, j.media_url, j.caption;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_due_instagram_publish_jobs(integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_due_instagram_publish_jobs(integer) TO service_role;

CREATE OR REPLACE FUNCTION public.schedule_instagram_publish_cron()
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_job_id bigint;
  v_project_url text;
  v_cron_secret text;
BEGIN
  SELECT decrypted_secret INTO v_project_url
  FROM vault.decrypted_secrets
  WHERE name = 'supabase_project_url'
  LIMIT 1;

  SELECT decrypted_secret INTO v_cron_secret
  FROM vault.decrypted_secrets
  WHERE name = 'instagram_publish_cron_secret'
  LIMIT 1;

  IF v_project_url IS NULL OR v_cron_secret IS NULL THEN
    RAISE EXCEPTION 'Instagram scheduler Vault secrets are missing';
  END IF;

  PERFORM cron.unschedule(jobid)
  FROM cron.job
  WHERE jobname = 'instagram-publish-every-minute';

  v_job_id := cron.schedule(
    'instagram-publish-every-minute',
    '* * * * *',
    $cron$
      SELECT net.http_post(
        url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'supabase_project_url')
          || '/functions/v1/instagram-publish-scheduler',
        headers := jsonb_build_object('Content-Type', 'application/json'),
        body := (
          SELECT jsonb_build_object(
            'timestamp', ts,
            'signature', encode(
              extensions.hmac(
                convert_to(ts, 'UTF8'),
                convert_to(decrypted_secret, 'UTF8'),
                'sha256'
              ),
              'hex'
            )
          )
          FROM vault.decrypted_secrets,
               LATERAL (SELECT extract(epoch FROM clock_timestamp())::bigint::text AS ts) AS clock_value
          WHERE name = 'instagram_publish_cron_secret'
        ),
        timeout_milliseconds := 10000
      );
    $cron$
  );

  RETURN v_job_id;
END;
$$;

REVOKE ALL ON FUNCTION public.schedule_instagram_publish_cron() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.schedule_instagram_publish_cron() TO service_role;
