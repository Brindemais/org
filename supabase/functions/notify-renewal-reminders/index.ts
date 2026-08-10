// Scheduled daily by pg_cron (see migration 0023_renewal_reminders.sql) to
// email + notify subscribers whose plan expires within 7 days. Idempotent
// via subscriptions.renewal_reminder_sent_at — confirm_payment() resets
// that column to null every time expires_at moves forward, so each cycle
// gets exactly one reminder, however many times this fires.
//
// Requires the same RESEND_API_KEY / RESEND_FROM_EMAIL secrets already used
// by invite-partner and invite-staff (Supabase dashboard > Edge Functions >
// Manage secrets) — no new secrets needed for this function.
import { createClient } from 'jsr:@supabase/supabase-js@2'

// TODO: replace with a custom domain if/when one is set up for the site —
// there's no APP_URL secret configured, so this is the current known
// production URL.
const APP_URL = 'https://org-ochre.vercel.app'

function reminderEmailHtml(name: string, daysLeft: number, planLabel: string) {
  const dueText = daysLeft <= 0 ? 'vence hoje' : daysLeft === 1 ? 'vence amanhã' : `vence em ${daysLeft} dias`
  return `
    <div style="font-family:Arial,Helvetica,sans-serif;max-width:480px;margin:0 auto;color:#0A0A0A;">
      <h2 style="margin-bottom:4px;">Sua assinatura ${dueText}</h2>
      <p>Olá, ${name}. Sua assinatura ${planLabel} da Brinde Mais ${dueText}. Renove para não perder o acesso ao brinde do mês, descontos e demais benefícios do clube.</p>
      <p style="text-align:center;margin:28px 0;">
        <a href="${APP_URL}/entrar/assinante" style="background-color:#D4941E;color:#0A0A0A;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:bold;display:inline-block;">Renovar agora</a>
      </p>
      <p style="font-size:13px;color:#555;">Se você já renovou, pode ignorar este e-mail.</p>
      <p>Equipe Brinde Mais</p>
    </div>
  `
}

async function sendViaResend(to: string, name: string, daysLeft: number, planLabel: string) {
  const resendKey = Deno.env.get('RESEND_API_KEY')
  const fromEmail = Deno.env.get('RESEND_FROM_EMAIL')
  if (!resendKey || !fromEmail) throw new Error('RESEND_NOT_CONFIGURED')

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: fromEmail,
      to,
      subject: daysLeft <= 0 ? 'Sua assinatura Brinde Mais vence hoje' : `Sua assinatura Brinde Mais vence em ${daysLeft} dias`,
      html: reminderEmailHtml(name, daysLeft, planLabel),
    }),
  })
  if (!res.ok) {
    const detail = await res.text().catch(() => res.statusText)
    throw new Error(`RESEND_SEND_FAILED: ${detail}`)
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok')

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const admin = createClient(supabaseUrl, serviceKey)

  const { data: due, error } = await admin
    .from('subscriptions')
    .select('id, expires_at, plan, subscriber_id, profiles:subscriber_id(full_name, email)')
    .eq('status', 'active')
    .is('renewal_reminder_sent_at', null)
    .gte('expires_at', new Date().toISOString())
    .lte('expires_at', new Date(Date.now() + 7 * 86_400_000).toISOString())

  if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500 })

  let sent = 0
  let failed = 0
  const errors: string[] = []

  for (const sub of due ?? []) {
    const profile = (sub as any).profiles
    const daysLeft = Math.ceil((new Date(sub.expires_at).getTime() - Date.now()) / 86_400_000)
    const planLabel = sub.plan === 'annual' ? 'anual' : 'mensal'

    // The in-app notification is the reliable half of this reminder — it
    // never depends on Resend/secrets being configured, so it still goes
    // out (and still marks the cycle as reminded) even if the email send
    // fails for any reason. Email failures are recorded but non-fatal.
    let emailError: string | null = null
    if (profile?.email) {
      try {
        await sendViaResend(profile.email, profile.full_name ?? 'assinante', daysLeft, planLabel)
      } catch (e) {
        emailError = String(e)
      }
    }

    try {
      const { error: notifErr } = await admin.from('notifications').insert({
        user_id: sub.subscriber_id,
        type: 'subscription',
        title: daysLeft <= 0 ? 'Sua assinatura vence hoje' : `Sua assinatura vence em ${daysLeft} dias`,
        message: 'Renove agora para não perder o acesso aos benefícios do clube.',
      })
      if (notifErr) throw new Error(`NOTIFICATION_INSERT_FAILED: ${notifErr.message}`)
      const { error: updErr } = await admin.from('subscriptions').update({ renewal_reminder_sent_at: new Date().toISOString() }).eq('id', sub.id)
      if (updErr) throw new Error(`SUBSCRIPTION_UPDATE_FAILED: ${updErr.message}`)
      sent++
      if (emailError) errors.push(`${sub.id}: email not sent — ${emailError}`)
    } catch (e) {
      failed++
      errors.push(`${sub.id}: ${String(e)}`)
    }
  }

  return new Response(JSON.stringify({ ok: true, sent, failed, checked: due?.length ?? 0, errors }), {
    headers: { 'Content-Type': 'application/json' },
  })
})
