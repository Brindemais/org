// Admin edita nome, e-mail de login e apelido (referral_code) de
// qualquer assinante ou parceiro. Trocar e-mail de login precisa da
// Admin API (auth.admin.updateUserById) — não dá pra fazer só com um
// update na tabela profiles, porque quem autentica de verdade é o
// auth.users.email, não o profiles.email (que é só um espelho).
import { createClient } from 'npm:@supabase/supabase-js@2'

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
    // Erro "esperado" sai com status 200: o supabase-js só manda o corpo
    // JSON pra `data` em respostas 2xx — em 4xx/5xx `data` fica null e o
    // front nunca enxerga o código do erro. Status HTTP de erro de
    // verdade fica só pro catch-all final, inesperado.
    const { profile_id, full_name, email, referral_code } = await req.json().catch(() => ({}))
    if (!profile_id) return json({ error: 'MISSING_PARAMS' })

    const authHeader = req.headers.get('Authorization')
    if (!authHeader) return json({ error: 'UNAUTHORIZED' })

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

    const callerClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } } })
    const { data: callerAuth, error: callerErr } = await callerClient.auth.getUser()
    if (callerErr || !callerAuth.user) return json({ error: 'UNAUTHORIZED' })

    const admin = createClient(supabaseUrl, serviceKey)

    const { data: callerProfile } = await admin.from('profiles').select('role').eq('id', callerAuth.user.id).maybeSingle()
    if (!callerProfile || !['admin', 'operator'].includes(callerProfile.role)) {
      return json({ error: 'NOT_AUTHORIZED' })
    }

    const { data: target } = await admin.from('profiles').select('*').eq('id', profile_id).maybeSingle()
    if (!target) return json({ error: 'PROFILE_NOT_FOUND' })

    const updates: Record<string, unknown> = {}

    if (typeof full_name === 'string' && full_name.trim() && full_name.trim() !== target.full_name) {
      updates.full_name = full_name.trim()
    }

    if (typeof referral_code === 'string' && referral_code.trim()) {
      const { data: normalized } = await admin.rpc('normalize_referral_code', { p_input: referral_code })
      if (!normalized || String(normalized).length < 3) return json({ error: 'REFERRAL_TOO_SHORT' })
      if (normalized !== target.referral_code) {
        const { data: taken } = await admin.from('profiles').select('id').neq('id', profile_id).ilike('referral_code', normalized).maybeSingle()
        if (taken) return json({ error: 'REFERRAL_TAKEN' })
        updates.referral_code = normalized
      }
    }

    if (typeof email === 'string' && email.trim() && email.trim().toLowerCase() !== (target.email ?? '').toLowerCase()) {
      const newEmail = email.trim().toLowerCase()
      const { error: authUpdateError } = await admin.auth.admin.updateUserById(profile_id, { email: newEmail, email_confirm: true })
      if (authUpdateError) {
        const msg = String(authUpdateError.message ?? authUpdateError)
        const code = msg.toLowerCase().includes('already been registered') || msg.toLowerCase().includes('already exists') ? 'EMAIL_TAKEN' : 'EMAIL_UPDATE_FAILED'
        return json({ error: code, detail: msg })
      }
      updates.email = newEmail
    }

    if (Object.keys(updates).length) {
      const { error: updateError } = await admin.from('profiles').update(updates).eq('id', profile_id)
      if (updateError) return json({ error: 'UPDATE_FAILED', detail: updateError.message })
    }

    return json({ ok: true, updated: updates })
  } catch (e) {
    return json({ error: 'UNEXPECTED', detail: String(e) }, 500)
  }
})
