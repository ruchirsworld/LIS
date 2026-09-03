// Bridges to the LIS_Fields Supabase project so ERP2.0 admins can review
// and approve staff-submitted field expenses without ever holding
// LIS_Fields' service-role key in the browser. This function runs
// server-side: it verifies the caller is an ERP2.0 admin/cxo using their own
// JWT, then uses the LIS_Fields service role internally to read pending
// expenses and write back an approved/rejected status. The actual ERP2.0
// ledger row (project + sub-head) is inserted by the frontend afterward,
// using the caller's own already-authenticated ERP2.0 session — this
// function never touches ERP2.0's own tables.
import { createClient } from "jsr:@supabase/supabase-js@2";

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

// LIS_Fields being paused surfaces here as a raw DNS/connection failure from
// the underlying fetch, not a normal Postgrest error — recognizable by
// message text rather than a status code, since it never reaches Postgrest
// at all. Worth a calmer, specific message instead of the raw network error.
const UNREACHABLE_PATTERN = /dns error|name or service not known|client error \(connect\)|failed to fetch/i;
function fieldErrorResponse(error: { message?: string }) {
  if (UNREACHABLE_PATTERN.test(error.message ?? "")) {
    return json(
      { error: "LIS_Fields is currently unavailable (its project is paused). Field expense claims can't be loaded until it's resumed." },
      503
    );
  }
  return json({ error: error.message }, 400);
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

    // Scoped to the caller's own JWT — used only to verify who they are,
    // against ERP2.0's own profiles table.
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

    if (profileErr || (profile?.role !== "admin" && profile?.role !== "cxo")) {
      return json({ error: "Only admins/CXO can review field expenses" }, 403);
    }

    const fieldUrl = Deno.env.get("LIS_FIELD_SUPABASE_URL");
    const fieldServiceKey = Deno.env.get("LIS_FIELD_SERVICE_ROLE_KEY");
    if (!fieldUrl || !fieldServiceKey) {
      console.error("Missing LIS_FIELD_SUPABASE_URL / LIS_FIELD_SERVICE_ROLE_KEY");
      return json({ error: "LIS_FIELD_SUPABASE_URL / LIS_FIELD_SERVICE_ROLE_KEY not configured" }, 500);
    }
    const fieldClient = createClient(fieldUrl, fieldServiceKey);

    const { action, id } = await req.json();
    console.log("field-expenses-bridge action:", action, id ?? "");

    if (action === "list") {
      const { data, error } = await fieldClient
        .from("expenses")
        .select("id, date, category, amount, description, receipt_url, site_id, created_by, sites(name), profiles(name)")
        .eq("status", "pending")
        .order("date", { ascending: false });
      if (error) {
        console.error("list query failed:", JSON.stringify(error));
        return fieldErrorResponse(error);
      }
      return json({ expenses: data }, 200);
    }

    if (action === "approve" || action === "reject") {
      if (!id) return json({ error: "id is required" }, 400);
      const { error } = await fieldClient
        .from("expenses")
        .update({ status: action === "approve" ? "approved" : "rejected" })
        .eq("id", id);
      if (error) {
        console.error(`${action} update failed:`, JSON.stringify(error));
        return fieldErrorResponse(error);
      }
      return json({ ok: true }, 200);
    }

    return json({ error: "Unknown action" }, 400);
  } catch (e) {
    console.error("field-expenses-bridge threw:", e instanceof Error ? e.stack ?? e.message : String(e));
    return json({ error: e instanceof Error ? e.message : "Unknown error" }, 500);
  }
});
