import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

// Cartão de crédito, só pra assinatura anual (mensal continua Pix-only,
// forçado abaixo). Fluxo: tokeniza o cartão na Asaas (POST
// /creditCard/tokenize — número/CVV passam por aqui em memória, nunca são
// gravados; só o token que volta é salvo) e, se aprovado, cobra na hora
// com esse token. Cartão é síncrono — diferente do Pix, aqui já sabemos o
// resultado na resposta, então confirma a assinatura direto, sem esperar
// o webhook (que continua existindo como plano B se essa chamada cair no
// meio do caminho depois de já ter cobrado).
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

interface CardInput {
  payment_id: string;
  holder_name: string;
  card_number: string;
  expiry_month: string;
  expiry_year: string;
  ccv: string;
  holder_address_number: string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    const userClient = createClient(SUPABASE_URL, ANON_KEY, { global: { headers: { Authorization: authHeader } } });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData.user) return json({ error: "NOT_AUTHENTICATED" }, 401);

    const input = (await req.json()) as CardInput;
    if (!input.payment_id || !input.card_number || !input.ccv || !input.holder_name || !input.expiry_month || !input.expiry_year || !input.holder_address_number) {
      return json({ error: "MISSING_FIELDS" }, 400);
    }

    const { data: payment, error: payErr } = await userClient
      .from("payments")
      .select("id, subscriber_id, amount, status, type, plan, asaas_payment_id")
      .eq("id", input.payment_id)
      .maybeSingle();
    if (payErr || !payment) return json({ error: "PAYMENT_NOT_FOUND" }, 404);
    if (payment.status !== "pending") return json({ error: "PAYMENT_NOT_PENDING" }, 400);

    // Regra de negócio: mensal é Pix obrigatório, só a assinatura anual
    // pode ser paga com cartão.
    if (payment.type !== "subscription" || payment.plan !== "annual") {
      return json({ error: "CARD_NOT_ALLOWED_FOR_THIS_PAYMENT" }, 400);
    }

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

    const { data: profile } = await admin
      .from("profiles")
      .select("id, full_name, cpf, email, phone, cep, asaas_customer_id")
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

    let tokenized;
    try {
      tokenized = await asaasFetch("/creditCard/tokenize", {
        method: "POST",
        body: JSON.stringify({
          customer: customerId,
          creditCard: {
            holderName: input.holder_name,
            number: input.card_number.replace(/\D/g, ""),
            expiryMonth: input.expiry_month,
            expiryYear: input.expiry_year,
            ccv: input.ccv,
          },
          creditCardHolderInfo: {
            name: input.holder_name,
            email: profile.email,
            cpfCnpj: profile.cpf,
            postalCode: (profile.cep ?? "").replace(/\D/g, ""),
            addressNumber: input.holder_address_number,
            phone: profile.phone,
          },
        }),
      });
    } catch (e) {
      return json({ error: "CARD_TOKENIZE_FAILED", message: String(e) }, 400);
    }

    await admin.from("profiles").update({
      asaas_card_token: tokenized.creditCardToken,
      asaas_card_last4: tokenized.creditCardNumber,
      asaas_card_brand: tokenized.creditCardBrand,
    }).eq("id", profile.id);

    const dueDate = new Date().toISOString().slice(0, 10);
    let charge;
    try {
      charge = await asaasFetch("/payments", {
        method: "POST",
        body: JSON.stringify({
          customer: customerId,
          billingType: "CREDIT_CARD",
          value: payment.amount,
          dueDate,
          description: "Brinde Mais - assinatura anual",
          externalReference: payment.id,
          creditCardToken: tokenized.creditCardToken,
        }),
      });
    } catch (e) {
      return json({ error: "CARD_CHARGE_DECLINED", message: String(e) }, 400);
    }

    await admin.from("payments").update({
      asaas_payment_id: charge.id,
      payment_method: "credit_card",
    }).eq("id", payment.id);

    const approved = charge.status === "CONFIRMED" || charge.status === "RECEIVED";
    if (approved) {
      const { error: confirmError } = await admin.rpc("confirm_payment", { p_payment_id: payment.id });
      if (confirmError) {
        console.error("asaas-charge-card: confirm_payment failed", confirmError);
        return json({ error: "CONFIRM_FAILED", message: confirmError.message }, 500);
      }
      return json({ status: "confirmed" });
    }

    // Não aprovado na hora mas também não é um erro HTTP (ex.: em
    // análise) — deixa como pending, o webhook resolve quando a Asaas
    // decidir.
    return json({ status: charge.status ?? "pending" });
  } catch (e) {
    console.error(e);
    return json({ error: "INTERNAL_ERROR", message: String(e) }, 500);
  }
});
