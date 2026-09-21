import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

// Creates (or returns, if already created — idempotent) a real Asaas Pix
// charge for a pending `payments` row the caller owns, and stores the
// QR code back on that row. Confirmation itself happens later, out of
// band, via the asaas-webhook function when Asaas notifies payment.
//
// ASAAS_ENV=sandbox|production picks the API base — flip this env var
// to go live later, no redeploy needed.
const ASAAS_API_KEY = Deno.env.get("ASAAS_API_KEY")!;
const ASAAS_ENV = Deno.env.get("ASAAS_ENV") ?? "sandbox";
const ASAAS_BASE = ASAAS_ENV === "production" ? "https://api.asaas.com/v3" : "https://api-sandbox.asaas.com/v3";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

async function asaasFetch(path: string, init: RequestInit = {}) {
  const res = await fetch(`${ASAAS_BASE}${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", access_token: ASAAS_API_KEY, ...(init.headers ?? {}) },
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error(`Asaas ${path} failed (${res.status}): ${JSON.stringify(data)}`);
  return data;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    // Scoped to the caller's own JWT — payments_select RLS means this
    // query only ever returns a row if it's really theirs, which is also
    // our authorization check for the rest of this function.
    const userClient = createClient(SUPABASE_URL, ANON_KEY, { global: { headers: { Authorization: authHeader } } });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData.user) return json({ error: "NOT_AUTHENTICATED" }, 401);

    const { payment_id } = await req.json();
    if (!payment_id) return json({ error: "MISSING_PAYMENT_ID" }, 400);

    const { data: payment, error: payErr } = await userClient
      .from("payments")
      .select("id, subscriber_id, amount, status, asaas_payment_id, pix_code, pix_qr_code")
      .eq("id", payment_id)
      .maybeSingle();
    if (payErr || !payment) return json({ error: "PAYMENT_NOT_FOUND" }, 404);

    // Idempotent: a page reload after the charge was already created
    // just returns the same Pix instead of creating a duplicate charge.
    if (payment.asaas_payment_id && payment.pix_code) {
      return json({ pix_code: payment.pix_code, pix_qr_code: payment.pix_qr_code });
    }
    if (payment.status !== "pending") return json({ error: "PAYMENT_NOT_PENDING" }, 400);

    // Everything past this point needs to write to profiles/payments,
    // which regular users can't do directly (no UPDATE policy on
    // payments; asaas_customer_id isn't in profiles_update_own's
    // reachable set either) — service role only from here on.
    const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

    const { data: profile } = await admin
      .from("profiles")
      .select("id, full_name, cpf, email, phone, asaas_customer_id")
      .eq("id", payment.subscriber_id)
      .maybeSingle();
    if (!profile) return json({ error: "PROFILE_NOT_FOUND" }, 404);

    let customerId = profile.asaas_customer_id as string | null;
    if (!customerId) {
      const customer = await asaasFetch("/customers", {
        method: "POST",
        body: JSON.stringify({
          name: profile.full_name,
          cpfCnpj: profile.cpf,
          email: profile.email,
          mobilePhone: profile.phone,
          externalReference: profile.id,
        }),
      });
      customerId = customer.id;
      await admin.from("profiles").update({ asaas_customer_id: customerId }).eq("id", profile.id);
    }

    const dueDate = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const charge = await asaasFetch("/payments", {
      method: "POST",
      body: JSON.stringify({
        customer: customerId,
        billingType: "PIX",
        value: payment.amount,
        dueDate,
        description: "Brinde Mais",
        externalReference: payment.id,
      }),
    });

    const qr = await asaasFetch(`/payments/${charge.id}/pixQrCode`);

    await admin
      .from("payments")
      .update({ asaas_payment_id: charge.id, pix_code: qr.payload, pix_qr_code: qr.encodedImage })
      .eq("id", payment.id);

    return json({ pix_code: qr.payload, pix_qr_code: qr.encodedImage });
  } catch (e) {
    console.error(e);
    return json({ error: "INTERNAL_ERROR", message: String(e) }, 500);
  }
});
