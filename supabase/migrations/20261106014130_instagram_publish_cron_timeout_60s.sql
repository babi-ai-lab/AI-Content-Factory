CREATE OR REPLACE FUNCTION public.schedule_instagram_publish_cron()
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
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
            'timestamp', clock_value.ts,
            'signature', encode(
              extensions.hmac(
                convert_to(clock_value.ts, 'UTF8'),
                convert_to(secrets.decrypted_secret, 'UTF8'),
                'sha256'
              ),
              'hex'
            )
          )
          FROM vault.decrypted_secrets AS secrets
          CROSS JOIN LATERAL (
            SELECT extract(epoch FROM clock_timestamp())::bigint::text AS ts
          ) AS clock_value
          WHERE secrets.name = 'instagram_publish_cron_secret'
        ),
        timeout_milliseconds := 60000
      );
    $cron$
  );

  RETURN v_job_id;
END;
$function$;
