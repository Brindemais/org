// Admin approves a partner -> this function invites them by e-mail
// (creates the auth user with no password) and links them to the partner
// record. The partner types the code from the e-mail on /parceiro/ativar,
// sets a password, and lands straight in /parceiro.
//
// The caller's own JWT is verified against `profiles.role` before doing
// anything privileged — the service-role key never leaves this function,
// and the linking RPC (admin_complete_partner_invite) is itself locked to
// service_role only, so this is the only path that can grant partner access.
//
// E-mail delivery goes through Resend, not Supabase's built-in mailer.
// `generateLink` creates the auth user (or fails if one already exists) and
// hands back a one-time code (`email_otp`) WITHOUT sending anything itself —
// Supabase's mailer never fires. We then POST that code to Resend's API in
// our own branded template; the partner types it on /parceiro/ativar
// instead of clicking a link. Requires two Edge Function secrets:
// RESEND_API_KEY and RESEND_FROM_EMAIL (e.g. "Brinde Mais
// <contato@brindemais.com.br>", using a domain verified in Resend — set
// these in the Supabase dashboard under Edge Functions > Manage secrets,
// never commit them to the repo).
//
// Deliberately a typed code, not the clickable action_link: mail clients
// that prefetch links for safety scanning (Apple Mail Privacy Protection,
// corporate link scanners) silently consume a one-time link's token before
// the recipient ever clicks it, so the real click lands on "link expired".
// A code the recipient types by hand can't be consumed that way.
import { createClient } from 'jsr:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
}

// Mesma lógica de normalize_referral_code() no banco / slugifyReferralCode
// no front — gera um link "bonito" (nome do estabelecimento) em vez do
// código aleatório que essa função usava antes de o convite aceitar
// p_referral_code. Convite não tem humano escolhendo em tempo real, então
// colisão de nome cai pra código aleatório em vez de travar o convite.
function slugifyReferralCode(value: string): string {
  return value
    .trim()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-+)|(-+$)/g, '')
}

function inviteEmailHtml(name: string, code: string) {
  return `
    <div style="background-color:#f5f2ec;padding:32px 16px;font-family:Arial,Helvetica,sans-serif;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;margin:0 auto;background-color:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #e8e4db;">
        <tr><td style="height:4px;background-color:#d4941e;font-size:0;line-height:0;">&nbsp;</td></tr>
        <tr><td style="padding:32px 32px 8px;text-align:center;">
          <img src="https://brindemais.com.br/images/email-logo.png" alt="Brinde Mais" width="96" style="display:block;margin:0 auto;height:auto;" />
        </td></tr>
        <tr><td style="padding:16px 32px 0;">
          <h1 style="margin:0 0 12px;font-size:20px;color:#0A0A0A;font-family:Arial,Helvetica,sans-serif;">Bem-vindo(a) à Brinde Mais!</h1>
          <p style="margin:0 0 20px;font-size:14px;line-height:1.6;color:#555555;">Olá, ${name}. Seu cadastro como parceiro foi aprovado. Acesse <a href="https://brindemais.com.br/parceiro/ativar" style="color:#935915;">brindemais.com.br/parceiro/ativar</a> e informe seu e-mail junto com o código abaixo para criar sua senha de acesso.</p>
        </td></tr>
        <tr><td style="padding:0 32px 8px;text-align:center;">
          <div style="background-color:#faf8f4;border:1px solid #e8e4db;border-radius:10px;padding:16px 24px;display:inline-block;">
            <span style="font-size:28px;font-weight:bold;letter-spacing:6px;color:#0A0A0A;font-family:Arial,Helvetica,sans-serif;">${code}</span>
          </div>
        </td></tr>
        <tr><td style="padding:24px 32px 32px;">
          <p style="margin:0;font-size:12px;color:#aaaaaa;border-top:1px solid #e8e4db;padding-top:16px;">Se você não reconhece este convite, pode ignorar este e-mail com segurança.</p>
          <p style="margin:8px 0 0;font-size:12px;color:#aaaaaa;">Equipe Brinde Mais &middot; brindemais.com.br</p>
        </td></tr>
      </table>
    </div>
  `
}

async function sendViaResend(to: string, name: string, code: string) {
  const resendKey = Deno.env.get('RESEND_API_KEY')
  const fromEmail = Deno.env.get('RESEND_FROM_EMAIL')
  if (!resendKey || !fromEmail) throw new Error('RESEND_NOT_CONFIGURED')

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: fromEmail,
      to,
      subject: 'Seu acesso ao painel de parceiros Brinde Mais está pronto',
      html: inviteEmailHtml(name, code),
    }),
  })
  if (!res.ok) {
    const detail = await res.text().catch(() => res.statusText)
    throw new Error(`RESEND_SEND_FAILED: ${detail}`)
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const { partner_id, redirect_to } = await req.json().catch(() => ({}))
    if (!partner_id || !redirect_to) return json({ error: 'MISSING_PARAMS' }, 400)

    const authHeader = req.headers.get('Authorization')
    if (!authHeader) return json({ error: 'UNAUTHORIZED' }, 401)

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

    // Verify the caller is a signed-in admin/operator using THEIR OWN jwt —
    // never trust a role claim coming from the request body.
    const callerClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } } })
    const { data: callerAuth, error: callerErr } = await callerClient.auth.getUser()
    if (callerErr || !callerAuth.user) return json({ error: 'UNAUTHORIZED' }, 401)

    const admin = createClient(supabaseUrl, serviceKey)

    const { data: callerProfile } = await admin.from('profiles').select('role').eq('id', callerAuth.user.id).maybeSingle()
    if (!callerProfile || !['admin', 'operator'].includes(callerProfile.role)) {
      return json({ error: 'NOT_AUTHORIZED' }, 403)
    }

    const { data: partner, error: partnerErr } = await admin.from('partners').select('*').eq('id', partner_id).maybeSingle()
    if (partnerErr || !partner) return json({ error: 'PARTNER_NOT_FOUND' }, 404)
    if (!partner.email) return json({ error: 'PARTNER_HAS_NO_EMAIL' }, 400)

    const displayName = partner.responsible_name ?? partner.trade_name
    let targetUserId: string
    let alreadyHadAccount = false

    const { data: generated, error: genErr } = await admin.auth.admin.generateLink({
      type: 'invite',
      email: partner.email,
      options: { redirectTo: redirect_to, data: { full_name: displayName, partner_invite: true } },
    })

    if (genErr) {
      const msg = (genErr.message ?? '').toLowerCase()
      if (msg.includes('already been registered') || msg.includes('already registered') || msg.includes('already exists')) {
        // Person already has an auth account (e.g. signed up as subscriber
        // earlier with the same e-mail) — link that account instead of
        // failing. No new invite e-mail goes out in this case, same as
        // before.
        const { data: list, error: listErr } = await admin.auth.admin.listUsers()
        const existing = listErr ? undefined : list.users.find((u) => u.email?.toLowerCase() === partner.email!.toLowerCase())
        if (!existing) return json({ error: 'INVITE_FAILED', detail: genErr.message }, 500)
        targetUserId = existing.id
        alreadyHadAccount = true
      } else {
        return json({ error: 'INVITE_FAILED', detail: genErr.message }, 500)
      }
    } else {
      targetUserId = generated.user.id
      try {
        await sendViaResend(partner.email, displayName, generated.properties.email_otp)
      } catch (sendErr) {
        // The auth user was already created at this point — don't leave the
        // partner half-linked with no way to know the invite silently
        // failed to send.
        return json({ error: 'EMAIL_SEND_FAILED', detail: String(sendErr) }, 500)
      }
    }

    const desiredCode = slugifyReferralCode(displayName)
    let { error: linkErr } = await admin.rpc('admin_complete_partner_invite', {
      p_partner_id: partner_id,
      p_user_id: targetUserId,
      p_email: partner.email,
      p_full_name: displayName,
      p_phone: partner.phone,
      p_referral_code: desiredCode || null,
    })
    if (linkErr && /REFERRAL_LOGIN_(TAKEN|TOO_SHORT)/.test(linkErr.message ?? '')) {
      // Nome já em uso como link de outra pessoa (ou curto demais) — sem
      // humano aqui pra escolher outro, cai pro código aleatório de sempre
      // em vez de falhar o convite inteiro.
      ;({ error: linkErr } = await admin.rpc('admin_complete_partner_invite', {
        p_partner_id: partner_id, p_user_id: targetUserId, p_email: partner.email, p_full_name: displayName, p_phone: partner.phone,
      }))
    }
    if (linkErr) return json({ error: 'LINK_FAILED', detail: linkErr.message }, 500)

    return json({ ok: true, already_had_account: alreadyHadAccount })
  } catch (e) {
    return json({ error: 'UNEXPECTED', detail: String(e) }, 500)
  }
})
