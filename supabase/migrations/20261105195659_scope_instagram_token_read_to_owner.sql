-- The publishing route uses the caller's JWT and owner-scoped RLS directly.
-- Ciphertext is safe to read by the owning account; the decryption key remains server-only.
DROP FUNCTION IF EXISTS public.get_own_instagram_publish_credentials();
GRANT SELECT (encrypted_access_token) ON TABLE public.instagram_connections TO authenticated;
