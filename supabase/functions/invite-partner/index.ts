// Admin approves a partner -> this function invites them by e-mail
// (creates the auth user with no password) and links them to the partner
// record. The partner clicks the e-mail link, sets a password, and lands
// straight in /parceiro.
//
// The caller's own JWT is verified against `profiles.role` before doing
// anything privileged — the service-role key never leaves this function,
// and the linking RPC (admin_complete_partner_invite) is itself locked to
// service_role only, so this is the only path that can grant partner access.
//
// E-mail delivery goes through Resend, not Supabase's built-in mailer.
// `generateLink` creates the auth user (or fails if one already exists) and
// hands back the action link WITHOUT sending anything itself — Supabase's
// mailer never fires. We then POST that link to Resend's API in our own
// branded template. Requires two Edge Function secrets: RESEND_API_KEY and
// RESEND_FROM_EMAIL (e.g. "Brinde Mais <contato@brindemais.com.br>", using a
// domain verified in Resend — set these in the Supabase dashboard under
// Edge Functions > Manage secrets, never commit them to the repo).
import { createClient } from 'jsr:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
}

function inviteEmailHtml(name: string, actionLink: string) {
  return `
    <div style="font-family:Arial,Helvetica,sans-serif;max-width:480px;margin:0 auto;color:#0A0A0A;">
      <h2 style="margin-bottom:4px;">Bem-vindo(a) à Brinde Mais!</h2>
      <p>Olá, ${name}. Seu cadastro como parceiro foi aprovado. Falta só um passo para acessar o painel do parceiro: defina sua senha de acesso clicando no botão abaixo.</p>
      <p style="text-align:center;margin:28px 0;">
        <a href="${actionLink}" style="background-color:#D4941E;color:#0A0A0A;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:bold;display:inline-block;">Definir minha senha</a>
      </p>
      <p style="font-size:13px;color:#555;">Se o botão não funcionar, copie e cole este link no navegador:<br>${actionLink}</p>
      <p style="font-size:13px;color:#555;">Se você não reconhece este convite, pode ignorar este e-mail com segurança.</p>
      <p>Equipe Brinde Mais</p>
    </div>
  `
}

async function sendViaResend(to: string, name: string, actionLink: string) {
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
      html: inviteEmailHtml(name, actionLink),
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
        await sendViaResend(partner.email, displayName, generated.properties.action_link)
      } catch (sendErr) {
        // The auth user was already created at this point — don't leave the
        // partner half-linked with no way to know the invite silently
        // failed to send.
        return json({ error: 'EMAIL_SEND_FAILED', detail: String(sendErr) }, 500)
      }
    }

    const { error: linkErr } = await admin.rpc('admin_complete_partner_invite', {
      p_partner_id: partner_id,
      p_user_id: targetUserId,
      p_email: partner.email,
      p_full_name: displayName,
      p_phone: partner.phone,
    })
    if (linkErr) return json({ error: 'LINK_FAILED', detail: linkErr.message }, 500)

    return json({ ok: true, already_had_account: alreadyHadAccount })
  } catch (e) {
    return json({ error: 'UNEXPECTED', detail: String(e) }, 500)
  }
})
