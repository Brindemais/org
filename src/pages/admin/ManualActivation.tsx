import { useState, type FormEvent } from 'react'
import { KeyRound, Search, User as UserIcon, Store } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { maskCPF } from '../../lib/format'
import type { SubscriptionPlan } from '../../lib/types'

interface Result { id: string; role: 'subscriber' | 'partner'; full_name: string; cpf: string | null; email: string | null }

// Ativa uma assinatura (assinante) ou o status de anunciante (parceiro)
// sem passar pela Asaas — pagamento combinado por fora, cortesia, migração
// de conta antiga. Sempre exige uma observação, e o pagamento gerado
// nasce marcado payment_method = 'manual' (visível em /admin/pagamentos),
// pra nunca se confundir com um Pix ou cartão de verdade.
export default function AdminManualActivation() {
  const [search, setSearch] = useState('')
  const [results, setResults] = useState<Result[]>([])
  const [searching, setSearching] = useState(false)
  const [selected, setSelected] = useState<Result | null>(null)
  const [plan, setPlan] = useState<SubscriptionPlan>('monthly')
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState<string | null>(null)
  const [confirmForce, setConfirmForce] = useState(false)

  async function runSearch(e: FormEvent) {
    e.preventDefault()
    if (!search.trim()) return
    setSearching(true)
    setSelected(null)
    setDone(null)
    const term = search.trim()
    const { data } = await supabase
      .from('profiles')
      .select('id, role, full_name, cpf, email')
      .in('role', ['subscriber', 'partner'])
      .or(`full_name.ilike.%${term}%,email.ilike.%${term}%,cpf.ilike.%${term.replace(/\D/g, '')}%`)
      .limit(20)
    setResults((data as Result[]) ?? [])
    setSearching(false)
  }

  function selectResult(r: Result) {
    setSelected(r)
    setPlan('monthly')
    setNote('')
    setError(null)
    setDone(null)
    setConfirmForce(false)
  }

  async function activate(force = false) {
    if (!selected) return
    if (!note.trim()) {
      setError('Descreva o motivo (ex.: pagamento combinado por WhatsApp, cortesia, migração).')
      return
    }
    setBusy(true)
    setError(null)

    if (selected.role === 'subscriber') {
      const { error: rpcError } = await supabase.rpc('admin_activate_subscription_manually', {
        p_subscriber_id: selected.id, p_plan: plan, p_note: note.trim(), p_force: force,
      })
      setBusy(false)
      if (rpcError) {
        if (rpcError.message.includes('ALREADY_ACTIVE')) {
          setConfirmForce(true)
          setError('Esse assinante já tem assinatura ativa. Confirme abaixo se quiser ativar mesmo assim (evita duplicar bônus de indicação por engano).')
          return
        }
        setError('Não foi possível ativar. Tente novamente.')
        return
      }
      setConfirmForce(false)
      setDone(`Assinatura ${plan === 'annual' ? 'anual' : 'mensal'} ativada para ${selected.full_name}.`)
      return
    }

    const { data: staff } = await supabase.from('partner_staff').select('partner_id').eq('profile_id', selected.id).maybeSingle()
    if (!staff) {
      setBusy(false)
      setError('Esse perfil de parceiro ainda não está vinculado a nenhum estabelecimento (staff não encontrado).')
      return
    }
    const { error: rpcError } = await supabase.rpc('admin_activate_advertiser_manually', {
      p_partner_id: staff.partner_id, p_note: note.trim(),
    })
    setBusy(false)
    if (rpcError) { setError('Não foi possível ativar. Tente novamente.'); return }
    setDone(`Status de anunciante ativado para ${selected.full_name}.`)
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="font-display text-2xl font-semibold flex items-center gap-2"><KeyRound size={22} className="text-gold-400" /> Ativação manual</h1>
        <p className="text-white/50 text-sm">Ative assinatura de assinante ou status de anunciante de parceiro sem passar pela Asaas, sempre com um motivo registrado.</p>
      </div>

      <form onSubmit={runSearch} className="card space-y-3">
        <label className="text-xs text-white/40 block">Buscar por nome, e-mail ou CPF</label>
        <div className="flex gap-2">
          <input className="input flex-1" placeholder="Digite e busque..." value={search} onChange={(e) => setSearch(e.target.value)} />
          <button type="submit" disabled={searching} className="btn-gold !px-4 gap-1.5">
            <Search size={15} /> {searching ? 'Buscando...' : 'Buscar'}
          </button>
        </div>
      </form>

      {results.length > 0 && (
        <div className="card divide-y divide-ink-800">
          {results.map((r) => (
            <button
              key={r.id}
              onClick={() => selectResult(r)}
              className={`w-full text-left py-3 flex items-center gap-3 first:pt-0 last:pb-0 ${selected?.id === r.id ? 'opacity-100' : 'opacity-80 hover:opacity-100'}`}
            >
              {r.role === 'partner' ? <Store size={16} className="text-gold-400 shrink-0" /> : <UserIcon size={16} className="text-gold-400 shrink-0" />}
              <div className="flex-1">
                <p className="text-sm">{r.full_name}</p>
                <p className="text-xs text-white/40">{r.email} {r.cpf ? `· ${maskCPF(r.cpf)}` : ''} · {r.role === 'partner' ? 'parceiro' : 'assinante'}</p>
              </div>
              {selected?.id === r.id && <span className="pill bg-gold-400/15 text-gold-300">Selecionado</span>}
            </button>
          ))}
        </div>
      )}

      {!searching && search && results.length === 0 && (
        <p className="text-sm text-white/40">Nenhum assinante ou parceiro encontrado com esse termo.</p>
      )}

      {selected && (
        <div className="card space-y-4">
          <p className="text-sm">
            Ativando para <strong>{selected.full_name}</strong> ({selected.role === 'partner' ? 'anunciante' : 'assinatura'})
          </p>

          {selected.role === 'subscriber' && (
            <div>
              <label className="text-xs text-white/40 block mb-1">Plano</label>
              <select className="input !w-40" value={plan} onChange={(e) => setPlan(e.target.value as SubscriptionPlan)}>
                <option value="monthly">Mensal</option>
                <option value="annual">Anual</option>
              </select>
            </div>
          )}

          <div>
            <label className="text-xs text-white/40 block mb-1">Motivo (aparece marcado como manual em /admin/pagamentos)</label>
            <input className="input w-full" placeholder="Ex.: pagamento combinado por WhatsApp" value={note} onChange={(e) => setNote(e.target.value)} />
          </div>

          {error && <p className="text-sm text-red-400">{error}</p>}
          {done && <p className="text-sm text-emerald-400">{done}</p>}

          {confirmForce ? (
            <div className="flex gap-2">
              <button onClick={() => activate(true)} disabled={busy} className="btn-dark flex-1 !border-red-500/40 text-red-400">
                {busy ? 'Ativando...' : 'Ativar mesmo assim'}
              </button>
              <button onClick={() => setConfirmForce(false)} className="btn-ghost flex-1">Cancelar</button>
            </div>
          ) : (
            <button onClick={() => activate()} disabled={busy} className="btn-gold">
              {busy ? 'Ativando...' : 'Confirmar ativação'}
            </button>
          )}
        </div>
      )}
    </div>
  )
}
