import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

// Receives Asaas's payment webhooks and confirms the matching local
// `payments` row the same way an admin manually confirming it in
// /admin/pagamentos already would (same confirm_payment RPC — this
// function is just a second, automated caller of it, allowed via the
// service_role check added alongside is_admin() in 0037).
//
// Auth: Asaas has no notion of our Supabase JWTs, so instead this
// checks a shared secret you set both here (ASAAS_WEBHOOK_TOKEN) and in
// the Asaas dashboard's webhook config ("Token de autenticação") —
// Asaas echoes it back on every call as the asaas-access-token header.
const WEBHOOK_TOKEN = Deno.env.get("ASAAS_WEBHOOK_TOKEN")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

// Pix on Asaas fires RECEIVED (money landed) — CONFIRMED included too
// since that's what card charges use and costs nothing to also accept.
const CONFIRMING_EVENTS = new Set(["PAYMENT_RECEIVED", "PAYMENT_CONFIRMED"]);

// Cartão pode ser contestado/estornado depois de já ter liberado acesso —
// CHARGEBACK_REQUESTED já corta o acesso no primeiro sinal de disputa
// (controle de risco), sem esperar a Asaas fechar o caso. REFUNDED cobre
// tanto um estorno de cartão que a Asaas decidiu a favor do titular quanto
// um reembolso manual feito direto no painel da Asaas.
const CHARGEBACK_EVENTS = new Set(["PAYMENT_CHARGEBACK_REQUESTED", "PAYMENT_CHARGEBACK_DISPUTE", "PAYMENT_REFUNDED"]);

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });

  const incomingToken = req.headers.get("asaas-access-token");
  if (!WEBHOOK_TOKEN || incomingToken !== WEBHOOK_TOKEN) {
    return new Response("Unauthorized", { status: 401 });
  }

  let body: { event?: string; payment?: { id?: string } };
  try {
    body = await req.json();
  } catch {
    return new Response("Invalid JSON", { status: 400 });
  }

  const event = body.event;
  const asaasPaymentId = body.payment?.id;
  if (!event || !asaasPaymentId) return new Response("Missing event/payment.id", { status: 400 });

  // Ack anything we don't act on (status updates, boleto generated, etc.)
  // so Asaas doesn't keep retrying a webhook we were never going to use.
  if (!CONFIRMING_EVENTS.has(event) && !CHARGEBACK_EVENTS.has(event)) {
    return new Response("Ignored", { status: 200 });
  }

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

  const { data: payment } = await admin
    .from("payments")
    .select("id, status")
    .eq("asaas_payment_id", asaasPaymentId)
    .maybeSingle();

  if (!payment) {
    // Nothing local matches this charge — ack anyway, retrying won't
    // make a matching row appear.
    console.warn("asaas-webhook: no local payment for", asaasPaymentId);
    return new Response("No matching payment", { status: 200 });
  }

  if (CHARGEBACK_EVENTS.has(event)) {
    const { error } = await admin.rpc("mark_payment_chargeback", { p_payment_id: payment.id });
    if (error) {
      console.error("asaas-webhook: mark_payment_chargeback failed", error);
      return new Response("Failed to process chargeback", { status: 500 });
    }
    return new Response("OK", { status: 200 });
  }

  if (payment.status !== "pending") {
    // Already confirmed (or otherwise resolved) — idempotent no-op,
    // e.g. Asaas re-sending the same event.
    return new Response("Already processed", { status: 200 });
  }

  const { error } = await admin.rpc("confirm_payment", { p_payment_id: payment.id });
  if (error) {
    console.error("asaas-webhook: confirm_payment failed", error);
    return new Response("Failed to confirm", { status: 500 });
  }

  return new Response("OK", { status: 200 });
});
