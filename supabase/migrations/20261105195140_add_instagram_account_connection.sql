-- Instagram OAuth connection records. Tokens are encrypted by the application before storage.
CREATE TABLE public.instagram_connections (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  instagram_user_id text NOT NULL UNIQUE,
  username text NOT NULL CHECK (length(username) BETWEEN 1 AND 100),
  encrypted_access_token text NOT NULL,
  token_expires_at timestamptz NOT NULL,
  connected_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.instagram_connections ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.instagram_connections FROM PUBLIC, anon, authenticated;
GRANT SELECT (user_id, instagram_user_id, username, token_expires_at, connected_at, updated_at)
  ON TABLE public.instagram_connections TO authenticated;
GRANT INSERT (user_id, instagram_user_id, username, encrypted_access_token, token_expires_at, connected_at, updated_at)
  ON TABLE public.instagram_connections TO authenticated;
GRANT UPDATE (instagram_user_id, username, encrypted_access_token, token_expires_at, connected_at, updated_at)
  ON TABLE public.instagram_connections TO authenticated;
GRANT DELETE ON TABLE public.instagram_connections TO authenticated;

CREATE POLICY "Users can read their own Instagram connection"
  ON public.instagram_connections FOR SELECT TO authenticated
  USING ((SELECT auth.uid()) = user_id);

CREATE POLICY "Users can create their own Instagram connection"
  ON public.instagram_connections FOR INSERT TO authenticated
  WITH CHECK ((SELECT auth.uid()) = user_id);

CREATE POLICY "Users can update their own Instagram connection"
  ON public.instagram_connections FOR UPDATE TO authenticated
  USING ((SELECT auth.uid()) = user_id)
  WITH CHECK ((SELECT auth.uid()) = user_id);

CREATE POLICY "Users can delete their own Instagram connection"
  ON public.instagram_connections FOR DELETE TO authenticated
  USING ((SELECT auth.uid()) = user_id);

CREATE TABLE public.instagram_oauth_states (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  state_hash text NOT NULL CHECK (length(state_hash) = 64),
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, state_hash)
);

CREATE INDEX instagram_oauth_states_expiry_idx
  ON public.instagram_oauth_states (expires_at);

ALTER TABLE public.instagram_oauth_states ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.instagram_oauth_states FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, DELETE ON TABLE public.instagram_oauth_states TO authenticated;

CREATE POLICY "Users can manage their own Instagram OAuth states"
  ON public.instagram_oauth_states FOR SELECT TO authenticated
  USING ((SELECT auth.uid()) = user_id);

CREATE POLICY "Users can create their own Instagram OAuth states"
  ON public.instagram_oauth_states FOR INSERT TO authenticated
  WITH CHECK ((SELECT auth.uid()) = user_id);

CREATE POLICY "Users can consume their own Instagram OAuth states"
  ON public.instagram_oauth_states FOR DELETE TO authenticated
  USING ((SELECT auth.uid()) = user_id);

-- Encrypted token retrieval is intentionally server-side only in later publishing routes.
-- The browser-facing status endpoint never selects encrypted_access_token.
