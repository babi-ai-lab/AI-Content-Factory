-- Instagram publish job state is worker-owned. End-user sessions only need
-- SELECT/INSERT/DELETE for the current API routes; status transitions and
-- retry metadata must be written by the trusted service-role worker.
REVOKE UPDATE ON TABLE public.instagram_publish_jobs FROM authenticated;

DROP POLICY IF EXISTS "Users can update their own Instagram publish jobs"
  ON public.instagram_publish_jobs;
