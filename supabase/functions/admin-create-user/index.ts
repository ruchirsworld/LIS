// Admin-only user provisioning. The service-role key never reaches the
// browser: this function runs server-side, checks the caller is an admin
// using their own JWT, then uses the service role internally to create the
// auth user. The `handle_new_user` trigger (see migrations) creates the
// matching `profiles` row automatically from user_metadata.
import { createClient } from "jsr:@supabase/supabase-js@2";

// Browser calls this cross-origin (the app's origin -> the functions.supabase.co
// origin), so every response — including the preflight — needs CORS headers.
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Missing Authorization header" }, 401);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Scoped to the caller's own JWT — used only to verify who they are.
    const callerClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: userData, error: userErr } = await callerClient.auth.getUser();
    if (userErr || !userData.user) return json({ error: "Not authenticated" }, 401);

    const { data: profile, error: profileErr } = await callerClient
      .from("profiles")
      .select("role")
      .eq("id", userData.user.id)
      .single();

    if (profileErr || profile?.role !== "admin") {
      return json({ error: "Only admins can create users" }, 403);
    }

    const { phone, pin, name, role } = await req.json();
    if (!phone || !pin || !name || !role) {
      return json({ error: "phone, pin, name, and role are required" }, 400);
    }
    if (!["admin", "cxo"].includes(role)) {
      return json({ error: "role must be admin or cxo" }, 400);
    }
    const digits = String(phone).replace(/\D/g, "");
    if (digits.length < 10) return json({ error: "Enter a valid phone number." }, 400);
    if (!/^\d{6}$/.test(String(pin))) return json({ error: "PIN must be exactly 6 digits." }, 400);

    // Phone is the identifier the user types in; Supabase Auth (email/password
    // mechanism) still needs an email internally, so one is synthesized here.
    // Never shown to the user — LoginPage does the same transform to sign in.
    const syntheticEmail = `${digits}@phone.lis.internal`;

    // Service-role client — only ever used here, server-side.
    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    const { data: created, error: createErr } = await adminClient.auth.admin.createUser({
      email: syntheticEmail,
      password: pin,
      email_confirm: true,
      user_metadata: { name, role, phone: digits },
    });

    if (createErr) return json({ error: createErr.message }, 400);

    return json({ user: created.user }, 200);
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : "Unknown error" }, 500);
  }
});
