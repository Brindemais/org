// Remove um cadastro que ficou travado no meio do caminho: o código de
// confirmação nunca chegou (ou a pessoa nunca digitou), então existe uma
// linha em auth.users sem profile correspondente, segurando o e-mail/CPF
// pra sempre (ninguém consegue tentar de novo com o mesmo e-mail).
//
// Deletar um usuário de auth.users precisa da Admin API
// (supabase.auth.admin.deleteUser), não de um DELETE direto via SQL —
// é o jeito suportado que já cuida de limpar identities e qualquer
// estado interno do GoTrue.
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
    const { user_id } = await req.json().catch(() => ({}))
    if (!user_id) return json({ error: 'MISSING_PARAMS' }, 400)

    const authHeader = req.headers.get('Authorization')
    if (!authHeader) return json({ error: 'UNAUTHORIZED' }, 401)

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

    const callerClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } } })
    const { data: callerAuth, error: callerErr } = await callerClient.auth.getUser()
    if (callerErr || !callerAuth.user) return json({ error: 'UNAUTHORIZED' }, 401)

    const admin = createClient(supabaseUrl, serviceKey)

    const { data: callerProfile } = await admin.from('profiles').select('role').eq('id', callerAuth.user.id).maybeSingle()
    if (!callerProfile || !['admin', 'operator'].includes(callerProfile.role)) {
      return json({ error: 'NOT_AUTHORIZED' }, 403)
    }

    // Nunca deixa apagar quem já completou o cadastro de verdade (tem
    // profile) por engano — só cadastros genuinamente órfãos.
    const { data: existingProfile } = await admin.from('profiles').select('id').eq('id', user_id).maybeSingle()
    if (existingProfile) return json({ error: 'HAS_PROFILE_NOT_PENDING' }, 400)

    const { error: deleteError } = await admin.auth.admin.deleteUser(user_id)
    if (deleteError) return json({ error: 'DELETE_FAILED', detail: deleteError.message }, 500)

    return json({ ok: true })
  } catch (e) {
    return json({ error: 'UNEXPECTED', detail: String(e) }, 500)
  }
})
