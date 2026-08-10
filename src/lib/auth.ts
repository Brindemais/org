import { supabase } from './supabase'
import type { UserRole } from './types'

// Right after signInWithPassword() resolves, the client's ambient session
// (used by every .from() call, including AuthContext's own onAuthStateChange
// listener firing in parallel) can briefly still be catching up — profiles_
// select_own's `id = auth.uid()` then evaluates against the *previous*
// session in this browser tab (e.g. someone testing the parceiro login
// right before the assinante one) and a perfectly valid account comes back
// with no profile row, which login screens were reporting as "esta conta
// não é de assinante/parceiro" even though the account is fine. A couple of
// short retries clears it up without the user ever seeing the glitch.
export async function fetchOwnRole(uid: string, attempts = 3): Promise<UserRole | null> {
  for (let i = 0; i < attempts; i++) {
    const { data } = await supabase.from('profiles').select('role').eq('id', uid).maybeSingle()
    if (data) return data.role as UserRole
    if (i < attempts - 1) await new Promise((resolve) => setTimeout(resolve, 200))
  }
  return null
}
