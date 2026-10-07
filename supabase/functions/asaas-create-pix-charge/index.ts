import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

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

// Sandbox e produção são contas Asaas completamente separadas — um
// customer_id de uma não existe na outra. Guardado em coluna própria por
// ambiente pra nunca reenviar um ID de sandbox pra API de produção (ou
// vice-versa) só porque ASAAS_ENV mudou depois que a pessoa já tinha
// testado no outro ambiente.
const CUSTOMER_ID_COLUMN = ASAAS_ENV === "production" ? "asaas_customer_id_production" : "asaas_customer_id_sandbox";

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
      .select("id, subscriber_id, partner_id, type, amount, status, asaas_payment_id, pix_code, pix_qr_code, product_order_id")
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
      .select(`id, full_name, cpf, email, phone, ${CUSTOMER_ID_COLUMN}`)
      .eq("id", payment.subscriber_id)
      .maybeSingle();
    if (!profile) return json({ error: "PROFILE_NOT_FOUND" }, 404);

    let customerId = (profile as Record<string, string | null>)[CUSTOMER_ID_COLUMN];
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
      await admin.from("profiles").update({ [CUSTOMER_ID_COLUMN]: customerId }).eq("id", profile.id);
    }

    // Compra de produto com parceiro já linkado a uma subconta Asaas: a
    // parte líquida (100% - comissão) vai direto pra conta dele via
    // split, sem passar pela carteira interna.
    let splits: Array<{ walletId: string; percentualValue: number }> | undefined;
    if (payment.type === "product_purchase" && payment.product_order_id) {
      const { data: order } = await admin.from("product_orders").select("commission_pct, split_applied").eq("id", payment.product_order_id).maybeSingle();
      if (order?.split_applied) {
        const { data: partner } = await admin.from("partners").select("asaas_wallet_id").eq("id", payment.partner_id).maybeSingle();
        if (partner?.asaas_wallet_id) {
          splits = [{ walletId: partner.asaas_wallet_id, percentualValue: 100 - Number(order.commission_pct) }];
        }
      }
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
        ...(splits ? { splits } : {}),
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
