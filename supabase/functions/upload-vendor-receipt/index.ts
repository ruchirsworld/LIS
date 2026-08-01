// Uploads a vendor-bill receipt photo to Google Drive using a service
// account, into a folder named "Vendor Bills" (found by name, created if it
// doesn't exist yet). The service account's key lives only in this
// function's environment (GOOGLE_SERVICE_ACCOUNT_KEY secret) — it never
// reaches the browser. Any authenticated LIS user may call this; the actual
// authority to write to Drive comes entirely from the service account.
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

const DRIVE_FOLDER_NAME = "Vendor Bills";
const DRIVE_SCOPE = "https://www.googleapis.com/auth/drive";

function base64UrlEncode(bytes: Uint8Array): string {
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function pemToArrayBuffer(pem: string): ArrayBuffer {
  const b64 = pem
    .replace(/-----BEGIN PRIVATE KEY-----/, "")
    .replace(/-----END PRIVATE KEY-----/, "")
    .replace(/\s/g, "");
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}

async function getAccessToken(clientEmail: string, privateKeyPem: string): Promise<string> {
  const header = { alg: "RS256", typ: "JWT" };
  const now = Math.floor(Date.now() / 1000);
  const claims = {
    iss: clientEmail,
    scope: DRIVE_SCOPE,
    aud: "https://oauth2.googleapis.com/token",
    exp: now + 3600,
    iat: now,
  };

  const enc = new TextEncoder();
  const headerB64 = base64UrlEncode(enc.encode(JSON.stringify(header)));
  const claimsB64 = base64UrlEncode(enc.encode(JSON.stringify(claims)));
  const signingInput = `${headerB64}.${claimsB64}`;

  const key = await crypto.subtle.importKey(
    "pkcs8",
    pemToArrayBuffer(privateKeyPem),
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, enc.encode(signingInput));
  const jwt = `${signingInput}.${base64UrlEncode(new Uint8Array(signature))}`;

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error_description || data.error || "Could not authenticate to Google");
  return data.access_token as string;
}

async function findOrCreateFolder(accessToken: string): Promise<string> {
  const q = encodeURIComponent(
    `mimeType='application/vnd.google-apps.folder' and name='${DRIVE_FOLDER_NAME}' and trashed=false`,
  );
  const searchRes = await fetch(`https://www.googleapis.com/drive/v3/files?q=${q}&fields=files(id,name)`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const searchData = await searchRes.json();
  if (!searchRes.ok) throw new Error(searchData.error?.message || "Could not search Drive");
  if (searchData.files && searchData.files.length > 0) return searchData.files[0].id as string;

  const createRes = await fetch("https://www.googleapis.com/drive/v3/files?fields=id", {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({ name: DRIVE_FOLDER_NAME, mimeType: "application/vnd.google-apps.folder" }),
  });
  const createData = await createRes.json();
  if (!createRes.ok) throw new Error(createData.error?.message || "Could not create Drive folder");
  return createData.id as string;
}

function base64ToBytes(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
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
    const callerClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userErr } = await callerClient.auth.getUser();
    if (userErr || !userData.user) return json({ error: "Not authenticated" }, 401);

    const keyJson = Deno.env.get("GOOGLE_SERVICE_ACCOUNT_KEY");
    if (!keyJson) return json({ error: "Google Drive is not configured (missing service account key)" }, 500);
    const serviceAccount = JSON.parse(keyJson);

    const { fileName, mimeType, data: base64Data } = await req.json();
    if (!fileName || !mimeType || !base64Data) {
      return json({ error: "fileName, mimeType, and data are required" }, 400);
    }

    const accessToken = await getAccessToken(serviceAccount.client_email, serviceAccount.private_key);
    const folderId = await findOrCreateFolder(accessToken);

    const boundary = `lis-${crypto.randomUUID()}`;
    const metadata = JSON.stringify({ name: fileName, parents: [folderId] });
    const fileBytes = base64ToBytes(base64Data);

    const enc = new TextEncoder();
    const preamble = enc.encode(
      `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${metadata}\r\n` +
        `--${boundary}\r\nContent-Type: ${mimeType}\r\n\r\n`,
    );
    const closing = enc.encode(`\r\n--${boundary}--`);
    const body = new Uint8Array(preamble.length + fileBytes.length + closing.length);
    body.set(preamble, 0);
    body.set(fileBytes, preamble.length);
    body.set(closing, preamble.length + fileBytes.length);

    const uploadRes = await fetch(
      "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,webViewLink",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": `multipart/related; boundary=${boundary}`,
        },
        body,
      },
    );
    const uploadData = await uploadRes.json();
    if (!uploadRes.ok) throw new Error(uploadData.error?.message || "Could not upload to Drive");

    return json({ id: uploadData.id, webViewLink: uploadData.webViewLink }, 200);
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : "Unknown error" }, 500);
  }
});
