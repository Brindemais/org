import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

// Repasse semanal pro parceiro: manda via Pix (Asaas Transfer API) o saldo
// disponível de bônus/vendas do parceiro, saindo da conta Asaas da própria
// Brinde Mais. Dispara só quando o admin clica no botão — não é automático
// (sem cron), e sem `confirm: true` só faz o preview, sem mover dinheiro.
//
// ASAAS_ENV=production aqui: toda transferência confirmada é Pix real.
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

// Heurística simples pra identificar o tipo da chave Pix exigido pela Asaas.
function detectPixKeyType(key: string): string {
  const trimmed = key.trim();
  if (trimmed.includes("@")) return "EMAIL";
  const digits = trimmed.replace(/\D/g, "");
  if (digits.length === 11 && /^\d+$/.test(trimmed.replace(/[.\-\s]/g, ""))) return "CPF";
  if (digits.length === 14 && /^\d+$/.test(trimmed.replace(/[.\-/\s]/g, ""))) return "CNPJ";
  if (/^\+?\d{10,13}$/.test(trimmed.replace(/[\s()\-]/g, ""))) return "PHONE";
  return "EVP";
}

interface PayoutRow {
  partner_id: string;
  profile_id: string;
  trade_name: string;
  full_name: string;
  pix_key: string | null;
  amount: number;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { confirm } = await req.json().catch(() => ({ confirm: false }));

    const authHeader = req.headers.get("Authorization") ?? "";
    const userClient = createClient(SUPABASE_URL, ANON_KEY, { global: { headers: { Authorization: authHeader } } });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData.user) return json({ error: "NOT_AUTHENTICATED" });

    // admin_list_partner_payouts já tem `if not is_admin() then raise exception`
    // dentro — chamando pelo userClient (com o JWT de quem está logado), um
    // não-admin recebe NOT_AUTHORIZED aqui mesmo antes de qualquer outra coisa.
    const { data: list, error: listErr } = await userClient.rpc("admin_list_partner_payouts", { p_minimum: 10 });
    if (listErr) return json({ error: "NOT_AUTHORIZED", detail: listErr.message });

    const rows = (list ?? []) as PayoutRow[];
    const eligible = rows.filter((p) => p.pix_key && p.pix_key.trim());
    const skipped = rows.filter((p) => !p.pix_key || !p.pix_key.trim()).map((p) => ({ ...p, reason: "SEM_CHAVE_PIX" }));

    if (!confirm) {
      // Preview: nenhum dinheiro se move aqui.
      return json({ preview: true, eligible, skipped, total: eligible.reduce((s, p) => s + Number(p.amount), 0) });
    }

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
    const results: Array<{ partner_id: string; trade_name: string; amount: number; ok: boolean; detail?: string; transfer_id?: string }> = [];

    for (const p of eligible) {
      try {
        const transfer = await asaasFetch("/transfers", {
          method: "POST",
          body: JSON.stringify({
            value: Number(p.amount),
            pixAddressKey: p.pix_key,
            pixAddressKeyType: detectPixKeyType(p.pix_key as string),
            description: `Repasse Brinde Mais - ${p.trade_name}`,
          }),
        });

        const { error: rpcErr } = await admin.rpc("admin_execute_partner_payout", {
          p_profile_id: p.profile_id,
          p_amount: p.amount,
          p_pix_key: p.pix_key,
          p_asaas_transfer_id: transfer.id,
          p_actor_id: userData.user.id,
        });
        if (rpcErr) throw new Error(`Transferência Asaas OK (${transfer.id}) mas falhou ao registrar no sistema: ${rpcErr.message}`);

        results.push({ partner_id: p.partner_id, trade_name: p.trade_name, amount: p.amount, ok: true, transfer_id: transfer.id });
      } catch (e) {
        await admin.from("audit_logs").insert({
          actor_id: userData.user.id,
          action: "partner_payout_failed",
          entity: "partner",
          entity_id: p.partner_id,
          after: { amount: p.amount, pix_key: p.pix_key, error: String(e) },
        });
        results.push({ partner_id: p.partner_id, trade_name: p.trade_name, amount: p.amount, ok: false, detail: String(e) });
      }
    }

    return json({ preview: false, results, skipped });
  } catch (e) {
    console.error(e);
    return json({ error: "INTERNAL_ERROR", message: String(e) }, 500);
  }
});
