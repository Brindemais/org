import { useEffect, useState } from 'react'
import { Copy, Share2 } from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'
import { supabase } from '../../lib/supabase'
import { formatBRL, formatDate, initials } from '../../lib/format'

interface DirectReferral { id: string; full_name: string; created_at: string; active: boolean }
interface LevelEarning { level: number; total: number }

export default function SubscriberReferrals() {
  const { profile } = useAuth()
  const [direct, setDirect] = useState<DirectReferral[]>([])
  const [levels, setLevels] = useState<LevelEarning[]>([])
  const [copied, setCopied] = useState(false)

  const link = profile ? `${window.location.origin}/cadastro?ref=${profile.referral_code}` : ''

  useEffect(() => {
    if (!profile) return
    supabase
      .from('referrals')
      .select('created_at, referred:referred_id(id, full_name, active)')
      .eq('referrer_id', profile.id)
      .then(({ data }) => {
        const rows = (data ?? []).map((r: any) => ({
          id: r.referred.id,
          full_name: r.referred.full_name,
          active: r.referred.active,
          created_at: r.created_at,
        }))
        setDirect(rows)
      })

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
        <p className="font-semibold mb-3">Ganhos por nível</p>
        <div className="grid grid-cols-2 gap-2">
          {Array.from({ length: 7 }, (_, i) => i + 1).map((lvl) => {
            const found = levels.find((l) => l.level === lvl)
            return (
              <div key={lvl} className="card !py-3">
                <p className="text-xs text-white/40">Nível {lvl}</p>
                <p className="font-semibold text-gold-400">{formatBRL(found?.total ?? 0)}</p>
              </div>
            )
          })}
        </div>
      </div>

      <div>
        <p className="font-semibold mb-3">Pessoas indicadas diretamente ({direct.length})</p>
        <div className="space-y-2">
          {direct.map((d) => (
            <div key={d.id} className="card !py-3 flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-ink-800 flex items-center justify-center text-xs font-semibold text-gold-400 shrink-0">
                {initials(d.full_name)}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{d.full_name}</p>
                <p className="text-xs text-white/40">Desde {formatDate(d.created_at)}</p>
              </div>
              <span className={`pill ${d.active ? 'bg-emerald-500/15 text-emerald-400' : 'bg-white/10 text-white/40'}`}>
                {d.active ? 'Ativo' : 'Inativo'}
              </span>
            </div>
          ))}
          {!direct.length && <p className="text-sm text-white/40 text-center py-8">Você ainda não indicou ninguém. Compartilhe seu link!</p>}
        </div>
      </div>
    </div>
  )
}
