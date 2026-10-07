import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

// Cria uma subconta Asaas pro parceiro (POST /v3/accounts), pra permitir
// split automático de pagamento: o walletId que volta é usado em
// asaas-create-pix-charge/asaas-charge-card pra mandar a parte líquida
// (90%, descontada a comissão de 10%) direto pra conta do parceiro, sem
// passar pela carteira interna nem saque manual.
//
// A Asaas manda e-mail automático pro responsável (campo `email`) com
// link pra definir senha e enviar os documentos de verificação — isso
// não precisa (nem dá) pra automatizar por aqui.
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
    const { partner_id } = await req.json().catch(() => ({}));
    if (!partner_id) return json({ error: "MISSING_PARAMS" }, 400);

    const authHeader = req.headers.get("Authorization") ?? "";
    const userClient = createClient(SUPABASE_URL, ANON_KEY, { global: { headers: { Authorization: authHeader } } });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData.user) return json({ error: "NOT_AUTHENTICATED" }, 401);

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

    const { data: callerProfile } = await admin.from("profiles").select("role").eq("id", userData.user.id).maybeSingle();
    const { data: staffRow } = await admin.from("partner_staff").select("partner_id").eq("partner_id", partner_id).eq("profile_id", userData.user.id).maybeSingle();
    const isAllowed = callerProfile?.role === "admin" || !!staffRow;
    if (!isAllowed) return json({ error: "NOT_AUTHORIZED" }, 403);

    const { data: partner, error: partnerErr } = await admin.from("partners").select("*").eq("id", partner_id).maybeSingle();
    if (partnerErr || !partner) return json({ error: "PARTNER_NOT_FOUND" }, 404);

    if (partner.asaas_wallet_id) {
      return json({ already_linked: true, wallet_id: partner.asaas_wallet_id });
    }

    const digits = (partner.cnpj_cpf ?? "").replace(/\D/g, "");
    const isCpf = digits.length === 11;

    const missing: string[] = [];
    if (!partner.trade_name) missing.push("trade_name");
    if (!partner.email) missing.push("email");
    if (!digits) missing.push("cnpj_cpf");
    if (!partner.address) missing.push("address");
    if (!partner.address_number) missing.push("address_number");
    if (!partner.neighborhood) missing.push("neighborhood");
    if (!partner.cep) missing.push("cep");
    if (partner.income_value == null) missing.push("income_value");
    if (isCpf && !partner.birth_date) missing.push("birth_date");
    if (!isCpf && !partner.company_type) missing.push("company_type");
    if (missing.length) return json({ error: "MISSING_KYC_FIELDS", missing }, 400);

    const body: Record<string, unknown> = {
      name: partner.trade_name,
      email: partner.email,
      cpfCnpj: digits,
      mobilePhone: (partner.whatsapp || partner.phone || "").replace(/\D/g, ""),
      address: partner.address,
      addressNumber: partner.address_number,
      province: partner.neighborhood,
      postalCode: (partner.cep ?? "").replace(/\D/g, ""),
      incomeValue: partner.income_value,
    };
    if (isCpf) body.birthDate = partner.birth_date;
    else body.companyType = partner.company_type;

    let account;
    try {
      account = await asaasFetch("/accounts", { method: "POST", body: JSON.stringify(body) });
    } catch (e) {
      await admin.from("partners").update({
        asaas_subaccount_status: "failed",
        asaas_subaccount_error: String(e),
      }).eq("id", partner_id);
      return json({ error: "ASAAS_REQUEST_FAILED", detail: String(e) }, 400);
    }

    await admin.from("partners").update({
      asaas_account_id: account.id,
      asaas_wallet_id: account.walletId,
      asaas_subaccount_status: "created",
      asaas_subaccount_error: null,
    }).eq("id", partner_id);

    return json({ ok: true, wallet_id: account.walletId });
  } catch (e) {
    console.error(e);
    return json({ error: "INTERNAL_ERROR", message: String(e) }, 500);
  }
});
