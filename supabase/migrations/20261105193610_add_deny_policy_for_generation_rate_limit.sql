-- Defense in depth: the rate-limit ledger is only writable by the private
-- SECURITY DEFINER routine. Authenticated clients receive an explicit deny policy.
CREATE POLICY "No direct access to generation rate limits"
  ON private.generation_rate_limits
  FOR ALL
  TO authenticated
  USING (false)
  WITH CHECK (false);
