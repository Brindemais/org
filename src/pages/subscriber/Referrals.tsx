import { useEffect, useMemo, useState } from 'react'
import { ChevronDown, ChevronRight as ChevronRightIcon, Copy, Share2, Users } from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'
import { supabase } from '../../lib/supabase'
import { formatBRL } from '../../lib/format'

interface TreeNode {
  id: string
  display_name: string
  level: number
  has_active_subscription: boolean
  referred_by: string | null
}
interface LevelEarning { level: number; total: number }

export default function SubscriberReferrals() {
  const { profile } = useAuth()
  const [tree, setTree] = useState<TreeNode[]>([])
  const [levels, setLevels] = useState<LevelEarning[]>([])
  const [copied, setCopied] = useState(false)
  const [expanded, setExpanded] = useState<Set<number>>(new Set([1]))

  const link = profile ? `${window.location.origin}/cadastro?ref=${profile.referral_code}` : ''

  useEffect(() => {
    if (!profile) return
    supabase
      .rpc('get_referral_tree', { p_root: profile.id })
      .then(({ data }) => setTree((data as TreeNode[]) ?? []))

    supabase
      .from('bonuses')
      .select('level, amount')
      .eq('beneficiary_id', profile.id)
      .then(({ data }) => {
        const totals: Record<number, number> = {}
        for (const b of data ?? []) totals[b.level] = (totals[b.level] ?? 0) + Number(b.amount)
        setLevels(Object.entries(totals).map(([level, total]) => ({ level: Number(level), total })).sort((a, b) => a.level - b.level))
      })
  }, [profile])

  const byLevel = useMemo(() => {
    const map: Record<number, TreeNode[]> = {}
    for (const n of tree) (map[n.level] ??= []).push(n)
    return map
  }, [tree])

  function toggleLevel(lvl: number) {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(lvl)) next.delete(lvl)
      else next.add(lvl)
      return next
    })
  }

  function copyLink() {
    navigator.clipboard.writeText(link)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  function shareWhatsapp() {
    const text = encodeURIComponent(`Entre para o Brinde Mais comigo e ganhe um brinde todo mês! ${link}`)
    window.open(`https://wa.me/?text=${text}`, '_blank')
  }

  return (
    <div className="space-y-5">
      <h1 className="font-display text-xl font-semibold">Indique aqui</h1>

      <div className="card space-y-3">
        <p className="text-sm text-white/60">Compartilhe seu link exclusivo e ganhe 10% sobre a assinatura de quem você indicar, mais bonificação em até 7 níveis da sua rede.</p>
        <div className="rounded-lg bg-ink-950 border border-ink-800 px-3 py-2.5 text-xs text-gold-300 break-all">{link}</div>
        <div className="flex gap-2">
          <button onClick={copyLink} className="btn-dark flex-1 !py-2.5 text-sm gap-2"><Copy size={14} /> {copied ? 'Copiado!' : 'Copiar link'}</button>
          <button onClick={shareWhatsapp} className="btn-gold flex-1 !py-2.5 text-sm gap-2"><Share2 size={14} /> WhatsApp</button>
        </div>
        <p className="text-xs text-white/40">Seu código: <span className="text-gold-400 font-semibold">{profile?.referral_code}</span></p>
      </div>

      <div>
        <p className="font-semibold mb-3 flex items-center gap-1.5"><Users size={16} className="text-gold-400" /> Sua árvore de indicações (7 níveis)</p>
        <div className="space-y-2">
          {Array.from({ length: 7 }, (_, i) => i + 1).map((lvl) => {
            const people = byLevel[lvl] ?? []
            const active = people.filter((p) => p.has_active_subscription).length
            const inactive = people.length - active
            const earned = levels.find((l) => l.level === lvl)?.total ?? 0
            const isOpen = expanded.has(lvl)
            return (
              <div key={lvl} className="card !py-3">
                <button className="w-full flex items-center justify-between gap-3" onClick={() => toggleLevel(lvl)}>
                  <div className="flex items-center gap-2 min-w-0">
                    {isOpen ? <ChevronDown size={15} className="text-white/40 shrink-0" /> : <ChevronRightIcon size={15} className="text-white/40 shrink-0" />}
                    <div className="text-left min-w-0">
                      <p className="text-sm font-semibold">Nível {lvl}</p>
                      <p className="text-xs text-white/40">{people.length} pessoa{people.length === 1 ? '' : 's'}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="pill bg-emerald-500/15 text-emerald-400">{active} ativos</span>
                    <span className="pill bg-white/10 text-white/40">{inactive} inativos</span>
                    <span className="text-gold-400 font-semibold text-sm w-20 text-right">{formatBRL(earned)}</span>
                  </div>
                </button>
                {isOpen && (
                  <div className="mt-3 pt-3 border-t border-ink-800 space-y-2">
                    {people.map((p) => (
                      <div key={p.id} className="flex items-center justify-between gap-3 pl-6">
                        <p className="text-sm truncate">{p.display_name}</p>
                        <span className={`pill shrink-0 ${p.has_active_subscription ? 'bg-emerald-500/15 text-emerald-400' : 'bg-white/10 text-white/40'}`}>
                          {p.has_active_subscription ? 'Ativo' : 'Inativo'}
                        </span>
                      </div>
                    ))}
                    {!people.length && <p className="text-xs text-white/40 pl-6">Ninguém neste nível ainda.</p>}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
