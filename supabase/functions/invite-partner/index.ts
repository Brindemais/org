// Admin approves a partner -> this function invites them by e-mail
// (creates the auth user with no password) and links them to the partner
// record. The partner clicks the e-mail link, sets a password, and lands
// straight in /parceiro.
//
// The caller's own JWT is verified against `profiles.role` before doing
// anything privileged — the service-role key never leaves this function,
// and the linking RPC (admin_complete_partner_invite) is itself locked to
// service_role only, so this is the only path that can grant partner access.
import { createClient } from 'jsr:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
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

    let targetUserId: string
    let alreadyHadAccount = false

    const { data: invited, error: inviteErr } = await admin.auth.admin.inviteUserByEmail(partner.email, {
      redirectTo: redirect_to,
      data: { full_name: partner.responsible_name ?? partner.trade_name, partner_invite: true },
    })

    if (inviteErr) {
      const msg = (inviteErr.message ?? '').toLowerCase()
      if (msg.includes('already been registered') || msg.includes('already registered') || msg.includes('already exists')) {
        // Person already has an auth account (e.g. signed up as subscriber
        // earlier with the same e-mail) — link that account instead of
        // failing. No new invite e-mail goes out in this case.
        const { data: list, error: listErr } = await admin.auth.admin.listUsers()
        const existing = listErr ? undefined : list.users.find((u) => u.email?.toLowerCase() === partner.email!.toLowerCase())
        if (!existing) return json({ error: 'INVITE_FAILED', detail: inviteErr.message }, 500)
        targetUserId = existing.id
        alreadyHadAccount = true
      } else {
        return json({ error: 'INVITE_FAILED', detail: inviteErr.message }, 500)
      }
    } else {
      targetUserId = invited.user.id
    }

    const { error: linkErr } = await admin.rpc('admin_complete_partner_invite', {
      p_partner_id: partner_id,
      p_user_id: targetUserId,
      p_email: partner.email,
      p_full_name: partner.responsible_name ?? partner.trade_name,
      p_phone: partner.phone,
    })
    if (linkErr) return json({ error: 'LINK_FAILED', detail: linkErr.message }, 500)

    return json({ ok: true, already_had_account: alreadyHadAccount })
  } catch (e) {
    return json({ error: 'UNEXPECTED', detail: String(e) }, 500)
  }
})
