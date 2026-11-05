import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, x-client-info, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Max-Age": "86400",
};

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}

function getDefaultKey(jsonEnvName: string, legacyEnvName: string) {
  const raw = Deno.env.get(jsonEnvName);
  if (raw) {
    try {
      const parsed = JSON.parse(raw) as Record<string, unknown>;
      if (typeof parsed.default === "string" && parsed.default) return parsed.default;
    } catch {
      // Fall through to the legacy environment variable for older projects.
    }
  }
  return Deno.env.get(legacyEnvName) || "";
}

Deno.serve(async (request: Request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (request.method !== "POST") {
    return jsonResponse({ error: "Method not allowed." }, 405);
  }

  const authorization = request.headers.get("authorization") || "";
  const token = authorization.startsWith("Bearer ") ? authorization.slice(7) : "";
  if (!token) {
    return jsonResponse({ error: "A valid user session is required." }, 401);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
  const publishableKey = getDefaultKey("SUPABASE_PUBLISHABLE_KEYS", "SUPABASE_ANON_KEY");
  const secretKey = getDefaultKey("SUPABASE_SECRET_KEYS", "SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !publishableKey || !secretKey) {
    console.error("Account deletion function is missing Supabase configuration.");
    return jsonResponse({ error: "Account deletion is temporarily unavailable." }, 503);
  }

  const body = await request.json().catch(() => null) as { password?: unknown } | null;
  const password = typeof body?.password === "string" ? body.password : "";
  if (password.length < 6 || password.length > 256) {
    return jsonResponse({ error: "Enter your current password to confirm account deletion." }, 400);
  }

  const authClient = createClient(supabaseUrl, publishableKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
  });
  const { data: { user }, error: authError } = await authClient.auth.getUser(token);
  if (authError || !user?.id || !user.email) {
    return jsonResponse({ error: "Your session is invalid or expired. Sign in again." }, 401);
  }

  // Re-authenticate with the current password immediately before the destructive action.
  const passwordClient = createClient(supabaseUrl, publishableKey, {
    auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
  });
  const { error: passwordError } = await passwordClient.auth.signInWithPassword({
    email: user.email,
    password,
  });
  if (passwordError) {
    return jsonResponse({ error: "The current password is incorrect." }, 403);
  }

  const adminClient = createClient(supabaseUrl, secretKey, {
    auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
  });
  const { error: deleteError } = await adminClient.auth.admin.deleteUser(user.id);
  if (deleteError) {
    console.error("Supabase account deletion failed:", {
      code: deleteError.code,
      status: deleteError.status,
    });
    return jsonResponse({ error: "Account deletion failed. Your account has not been confirmed as deleted." }, 500);
  }

  return jsonResponse({ deleted: true });
});
