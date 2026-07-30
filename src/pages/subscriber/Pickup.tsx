import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { QRCodeSVG } from 'qrcode.react'
import { RefreshCw, UserPlus } from 'lucide-react'
import { useSubscription } from '../../hooks/useSubscription'
import { supabase } from '../../lib/supabase'
import type { Partner } from '../../lib/types'
import { formatDate } from '../../lib/format'
import { StatusBadge } from '../../components/ui/StatusBadge'

export default function SubscriberPickup() {
  const { pickup, loading, reload } = useSubscription()
  const [partner, setPartner] = useState<Partner | null>(null)
  const [tick, setTick] = useState(0)

  useEffect(() => {
    if (pickup?.partner_id) {
      supabase.from('partners').select('*').eq('id', pickup.partner_id).maybeSingle().then(({ data }) => setPartner(data as Partner | null))
    }
  }, [pickup?.partner_id])

  useEffect(() => {
    const t = setInterval(() => setTick((v) => v + 1), 60000)
    return () => clearInterval(t)
  }, [])

  if (loading) return <p className="text-white/40 text-sm">Carregando...</p>

  if (!pickup) {
    return (
      <div className="text-center py-16">
        <p className="text-white/60 mb-4">Você ainda não escolheu seu ponto de retirada deste mês.</p>
        <Link to="/app/beneficios" className="btn-gold">Escolher ponto de retirada</Link>
      </div>
    )
  }

  return (
    <div className="space-y-5" key={tick}>
      <div>
        <h1 className="font-display text-xl font-semibold">Brinde do mês</h1>
        <p className="text-sm text-white/50">Retirada #{pickup.cycle_month.toString().padStart(2, '0')}/{pickup.cycle_year}</p>
      </div>

      <div className="card text-center space-y-4">
        <p className="text-sm text-white/50">Parceiro selecionado</p>
        <p className="font-semibold">{partner?.trade_name ?? '...'}</p>
        <p className="text-xs text-white/40">{partner?.address}, {partner?.neighborhood}</p>

        <div className="flex justify-center py-2">
          <div className="bg-white p-4 rounded-xl">
            <QRCodeSVG value={pickup.code} size={160} />
          </div>
        </div>

        <div>
          <p className="text-xs text-white/40 mb-1">Código de retirada</p>
          <p className="font-display text-2xl font-bold tracking-wider text-gold-400">{pickup.code}</p>
        </div>

        <div className="flex items-center justify-center gap-2">
          <StatusBadge status={pickup.status} />
          <RefreshCw size={12} className="text-white/30" />
        </div>

        <p className="text-xs text-white/40">Apresente este código ao parceiro. Retire até {formatDate(pickup.deadline)}.</p>
      </div>

      <Link to="/app/perfil" className="card flex items-center gap-3">
        <div className="w-9 h-9 rounded-full bg-gold-400/15 flex items-center justify-center shrink-0">
          <UserPlus size={16} className="text-gold-400" />
        </div>
        <div className="flex-1">
          <p className="text-sm font-medium">Retirada por outra pessoa</p>
          <p className="text-xs text-white/40">Autorize alguém para retirar por você</p>
        </div>
      </Link>
    </div>
  )
}
