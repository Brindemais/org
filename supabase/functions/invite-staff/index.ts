// Admin invites a new internal staff member (admin or operator). Mirrors
// invite-partner's structure closely, but:
//   - only a caller whose OWN role is exactly 'admin' may invite (an
//     'operator' cannot use this to mint more staff accounts, even though
//     'operator' otherwise has the same data access as 'admin');
//   - the invited role is admin/operator, set via admin_complete_staff_invite
//     (service_role only), not the partner-linking RPC.
//
// E-mail delivery goes through Resend, same as invite-partner — see that
// function's header for the RESEND_API_KEY / RESEND_FROM_EMAIL secrets, and
// for why this sends a typed code (email_otp) instead of a clickable link.
import { createClient } from 'jsr:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
}

// Mesma lógica de normalize_referral_code() no banco / slugifyReferralCode
// no front — ver invite-partner/index.ts pro porquê.
function slugifyReferralCode(value: string): string {
  return value
    .trim()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-+)|(-+$)/g, '')
}

function inviteEmailHtml(name: string, roleLabel: string, code: string) {
  return `
    <div style="background-color:#f5f2ec;padding:32px 16px;font-family:Arial,Helvetica,sans-serif;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;margin:0 auto;background-color:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #e8e4db;">
        <tr><td style="height:4px;background-color:#d4941e;font-size:0;line-height:0;">&nbsp;</td></tr>
        <tr><td style="padding:32px 32px 8px;text-align:center;">
          <img src="https://brindemais.com.br/images/email-logo.png" alt="Brinde Mais" width="96" style="display:block;margin:0 auto;height:auto;" />
        </td></tr>
        <tr><td style="padding:16px 32px 0;">
          <h1 style="margin:0 0 12px;font-size:20px;color:#0A0A0A;font-family:Arial,Helvetica,sans-serif;">Bem-vindo(a) à equipe Brinde Mais!</h1>
          <p style="margin:0 0 20px;font-size:14px;line-height:1.6;color:#555555;">Olá, ${name}. Você foi cadastrado(a) como <strong>${roleLabel}</strong> no painel administrativo. Acesse <a href="https://brindemais.com.br/parceiro/ativar" style="color:#935915;">brindemais.com.br/parceiro/ativar</a> e informe seu e-mail junto com o código abaixo para criar sua senha de acesso.</p>
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

async function sendViaResend(to: string, name: string, roleLabel: string, code: string) {
  const resendKey = Deno.env.get('RESEND_API_KEY')
  const fromEmail = Deno.env.get('RESEND_FROM_EMAIL')
  if (!resendKey || !fromEmail) throw new Error('RESEND_NOT_CONFIGURED')

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: fromEmail,
      to,
      subject: 'Seu acesso ao painel administrativo Brinde Mais está pronto',
      html: inviteEmailHtml(name, roleLabel, code),
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
    const { email, full_name, role, redirect_to } = await req.json().catch(() => ({}))
    if (!email || !full_name || !role || !redirect_to) return json({ error: 'MISSING_PARAMS' }, 400)
    if (role !== 'admin' && role !== 'operator') return json({ error: 'INVALID_ROLE' }, 400)

    const authHeader = req.headers.get('Authorization')
    if (!authHeader) return json({ error: 'UNAUTHORIZED' }, 401)

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

    const callerClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } } })
    const { data: callerAuth, error: callerErr } = await callerClient.auth.getUser()
    if (callerErr || !callerAuth.user) return json({ error: 'UNAUTHORIZED' }, 401)

    const admin = createClient(supabaseUrl, serviceKey)

    // Strictly 'admin' — an 'operator' has the same data access elsewhere
    // in the app, but must not be able to mint new staff accounts.
    const { data: callerProfile } = await admin.from('profiles').select('role').eq('id', callerAuth.user.id).maybeSingle()
    if (!callerProfile || callerProfile.role !== 'admin') {
      return json({ error: 'NOT_AUTHORIZED' }, 403)
    }

    const roleLabel = role === 'admin' ? 'administrador' : 'operador'

    const { data: generated, error: genErr } = await admin.auth.admin.generateLink({
      type: 'invite',
      email,
      options: { redirectTo: redirect_to, data: { full_name, staff_invite: true } },
    })

    if (genErr) {
      const msg = (genErr.message ?? '').toLowerCase()
      if (!(msg.includes('already been registered') || msg.includes('already registered') || msg.includes('already exists'))) {
        return json({ error: 'INVITE_FAILED', detail: genErr.message }, 500)
      }
      // Already has an auth account — just (re)assign the role, no new
      // invite e-mail. Mirrors invite-partner's same-situation handling.
      const { data: list, error: listErr } = await admin.auth.admin.listUsers()
      const existing = listErr ? undefined : list.users.find((u) => u.email?.toLowerCase() === email.toLowerCase())
      if (!existing) return json({ error: 'INVITE_FAILED', detail: genErr.message }, 500)
      const { error: linkErr } = await admin.rpc('admin_complete_staff_invite', {
        p_user_id: existing.id, p_email: email, p_full_name: full_name, p_role: role,
      })
      if (linkErr) return json({ error: 'LINK_FAILED', detail: linkErr.message }, 500)
      return json({ ok: true, already_had_account: true })
    }

    try {
      await sendViaResend(email, full_name, roleLabel, generated.properties.email_otp)
    } catch (sendErr) {
      return json({ error: 'EMAIL_SEND_FAILED', detail: String(sendErr) }, 500)
    }

    const desiredCode = slugifyReferralCode(full_name)
    let { error: linkErr } = await admin.rpc('admin_complete_staff_invite', {
      p_user_id: generated.user.id, p_email: email, p_full_name: full_name, p_role: role, p_referral_code: desiredCode || null,
    })
    if (linkErr && /REFERRAL_LOGIN_(TAKEN|TOO_SHORT)/.test(linkErr.message ?? '')) {
      ;({ error: linkErr } = await admin.rpc('admin_complete_staff_invite', {
        p_user_id: generated.user.id, p_email: email, p_full_name: full_name, p_role: role,
      }))
    }
    if (linkErr) return json({ error: 'LINK_FAILED', detail: linkErr.message }, 500)

    return json({ ok: true, already_had_account: false })
  } catch (e) {
    return json({ error: 'UNEXPECTED', detail: String(e) }, 500)
  }
})
