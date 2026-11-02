import { useEffect, useMemo, useState } from 'react'
import { ChevronDown, ChevronRight as ChevronRightIcon, Copy, Share2, Users, Crown, Store } from 'lucide-react'
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
interface QualificationStatus { direct_active: number; l1_l2_active: number; tier: 'none' | 'vip' | 'vip_mais' | 'elite' }

const TIER_LABELS: Record<QualificationStatus['tier'], string> = { none: 'Sem qualificação', vip: 'VIP', vip_mais: 'VIP MAIS', elite: 'ELITE' }

export default function SubscriberReferrals() {
  const { profile } = useAuth()
  const [tree, setTree] = useState<TreeNode[]>([])
  const [levels, setLevels] = useState<LevelEarning[]>([])
  const [qualification, setQualification] = useState<QualificationStatus | null>(null)
  const [copied, setCopied] = useState(false)
  const [copiedPartner, setCopiedPartner] = useState(false)
  const [expanded, setExpanded] = useState<Set<number>>(new Set([1]))

  const link = profile ? `${window.location.origin}/cadastro?ref=${profile.referral_code}` : ''
  const partnerLink = profile ? `${window.location.origin}/seja-parceiro/cadastro?ref=${profile.referral_code}` : ''

  useEffect(() => {
    if (!profile) return
    supabase
      .rpc('get_referral_tree', { p_root: profile.id })
      .then(({ data }) => setTree((data as TreeNode[]) ?? []))

    supabase
      .from('bonuses')
      .select('level, amount')
      .eq('beneficiary_id', profile.id)
      .eq('status', 'confirmed')
      .then(({ data }) => {
        const totals: Record<number, number> = {}
        for (const b of data ?? []) totals[b.level] = (totals[b.level] ?? 0) + Number(b.amount)
        setLevels(Object.entries(totals).map(([level, total]) => ({ level: Number(level), total })).sort((a, b) => a.level - b.level))
      })

    supabase
      .rpc('subscriber_qualification_status')
      .then(({ data }) => setQualification(((data as QualificationStatus[] | null) ?? [])[0] ?? null))
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

  function copyPartnerLink() {
    navigator.clipboard.writeText(partnerLink)
    setCopiedPartner(true)
    setTimeout(() => setCopiedPartner(false), 2000)
  }

  function sharePartnerWhatsapp() {
    const text = encodeURIComponent(`Tenho mais clientes pra você: seja parceiro Brinde Mais! ${partnerLink}`)
    window.open(`https://wa.me/?text=${text}`, '_blank')
  }

  return (
    <div className="space-y-5">
      <h1 className="font-display text-xl font-semibold">Indique aqui</h1>

      <div className="card space-y-3">
        <p className="text-sm font-semibold flex items-center gap-1.5"><Users size={15} className="text-gold-400" /> Indique assinantes</p>
        <p className="text-sm text-white/60">Compartilhe seu link exclusivo e ganhe 19% sobre a assinatura de quem você indicar e mais 19% sobre a assinatura dos indicados deles — com bonificação em até 4 níveis da sua rede, mais 1% por nível sobre o consumo deles.</p>
        <div className="rounded-lg bg-ink-950 border border-ink-800 px-3 py-2.5 text-xs text-gold-300 break-all">{link}</div>
        <div className="flex gap-2">
          <button onClick={copyLink} className="btn-dark flex-1 !py-2.5 text-sm gap-2"><Copy size={14} /> {copied ? 'Copiado!' : 'Copiar link'}</button>
          <button onClick={shareWhatsapp} className="btn-gold flex-1 !py-2.5 text-sm gap-2"><Share2 size={14} /> WhatsApp</button>
        </div>
        <p className="text-xs text-white/40">Seu código: <span className="text-gold-400 font-semibold">{profile?.referral_code}</span></p>
      </div>

      <div className="card space-y-3">
        <p className="text-sm font-semibold flex items-center gap-1.5"><Store size={15} className="text-gold-400" /> Indique parceiros</p>
        <p className="text-sm text-white/60">Indique um estabelecimento parceiro e ganhe 10% sobre a taxa paga por ele e mais 10% sobre a taxa de quem ele indicar — com bonificação em até 4 níveis, mais 1% por nível sobre o consumo da rede.</p>
        <div className="rounded-lg bg-ink-950 border border-ink-800 px-3 py-2.5 text-xs text-gold-300 break-all">{partnerLink}</div>
        <div className="flex gap-2">
          <button onClick={copyPartnerLink} className="btn-dark flex-1 !py-2.5 text-sm gap-2"><Copy size={14} /> {copiedPartner ? 'Copiado!' : 'Copiar link'}</button>
          <button onClick={sharePartnerWhatsapp} className="btn-gold flex-1 !py-2.5 text-sm gap-2"><Share2 size={14} /> WhatsApp</button>
        </div>
      </div>

      {qualification && (
        <div className="card space-y-4">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm font-semibold flex items-center gap-1.5"><Crown size={15} className="text-gold-400" /> Sua qualificação este mês</p>
            {qualification.tier !== 'none' && (
              <span className="pill bg-gold-gradient text-ink-950 font-bold">{TIER_LABELS[qualification.tier]}</span>
            )}
          </div>
          <p className="text-xs text-white/40">
            {qualification.direct_active} indicado{qualification.direct_active === 1 ? '' : 's'} direto{qualification.direct_active === 1 ? '' : 's'} ativo{qualification.direct_active === 1 ? '' : 's'} ·{' '}
            {qualification.l1_l2_active} ativo{qualification.l1_l2_active === 1 ? '' : 's'} somando níveis 1 e 2
          </p>

          <div className="space-y-3">
            {([
              { tier: 'vip' as const, label: 'VIP', reward: '1 Brinde por mês', achieved: qualification.direct_active >= 10, value: qualification.direct_active, target: 10, unit: 'diretos ativos' },
              { tier: 'vip_mais' as const, label: 'VIP MAIS', reward: 'R$ 200,00/mês', achieved: qualification.direct_active >= 10 && qualification.l1_l2_active >= 110, value: qualification.l1_l2_active, target: 110, unit: 'ativos (níveis 1+2), além de 10 diretos' },
              { tier: 'elite' as const, label: 'ELITE', reward: 'R$ 1.500,00/mês', achieved: qualification.direct_active >= 100 && qualification.l1_l2_active >= 1100, value: qualification.l1_l2_active, target: 1100, unit: 'ativos (níveis 1+2), além de 100 diretos' },
            ]).map((row) => (
              <div key={row.tier} className="space-y-1">
                <div className="flex items-center justify-between gap-2 text-xs">
                  <span className={`font-semibold ${row.achieved ? 'text-gold-400' : 'text-white/60'}`}>{row.label} · {row.reward}</span>
                  <span className="text-white/40">{Math.min(row.value, row.target)}/{row.target} {row.unit}</span>
                </div>
                <div className="h-1.5 rounded-full bg-ink-800 overflow-hidden">
                  <div className={`h-full ${row.achieved ? 'bg-gold-gradient' : 'bg-white/20'}`} style={{ width: `${Math.min(100, (row.value / row.target) * 100)}%` }} />
                </div>
              </div>
            ))}
          </div>

          <p className="text-xs text-white/30">Sua primeira retirada de brinde é sempre livre. A partir da segunda, é preciso estar qualificado no mínimo VIP no mês.</p>
        </div>
      )}

      <div>
        <p className="font-semibold mb-3 flex items-center gap-1.5"><Users size={16} className="text-gold-400" /> Sua árvore de indicações (4 níveis)</p>
        <div className="space-y-2">
          {Array.from({ length: 4 }, (_, i) => i + 1).map((lvl) => {
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
