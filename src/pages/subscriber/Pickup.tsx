import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { QRCodeSVG } from 'qrcode.react'
import { RefreshCw, UserPlus, Gift, MapPin, Check, XCircle, Clock, X } from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'
import { useSubscription } from '../../hooks/useSubscription'
import { useGeolocation } from '../../hooks/useGeolocation'
import { supabase } from '../../lib/supabase'
import type { Partner, Pickup, ProductRow } from '../../lib/types'
import { formatDate } from '../../lib/format'
import { haversineKm, formatDistance } from '../../lib/geo'
import { EmptyState } from '../../components/ui/EmptyState'
import { LoadingState } from '../../components/ui/LoadingState'

// Only the columns rendered below — see the same note in Landing.tsx.
type PickupPartner = Pick<Partner, 'id' | 'trade_name' | 'address' | 'neighborhood' | 'logo_url' | 'lat' | 'lng'>

const STEPS = [
  { key: 'available', label: 'Disponível' },
  { key: 'ready', label: 'Pronto para retirada' },
  { key: 'withdrawn', label: 'Retirado' },
  { key: 'done', label: 'Concluído' },
] as const

export default function SubscriberPickup() {
  const { user } = useAuth()
  const { loading: subLoading } = useSubscription()
  const [pickup, setPickup] = useState<Pickup | null>(null)
  const [loadingPickup, setLoadingPickup] = useState(true)
  const [partner, setPartner] = useState<PickupPartner | null>(null)
  const [product, setProduct] = useState<Pick<ProductRow, 'name' | 'image_url'> | null>(null)
  const [tick, setTick] = useState(0)
  const [cancelling, setCancelling] = useState(false)
  const [cancelError, setCancelError] = useState<string | null>(null)
  const geo = useGeolocation()

  // useSubscription() only ever returns a pickup while it's still
  // reserved/ready — the moment it's withdrawn it drops out of that query,
  // which would otherwise flash "nenhuma retirada escolhida" right after a
  // successful pickup. Query the cycle's pickup directly instead, so this
  // page can also show the completed state.
  useEffect(() => {
    if (!user) return
    const now = new Date()
    supabase
      .from('pickups')
      .select('*')
      .eq('subscriber_id', user.id)
      .eq('cycle_month', now.getMonth() + 1)
      .eq('cycle_year', now.getFullYear())
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
      .then(({ data }) => {
        setPickup(data as Pickup | null)
        setLoadingPickup(false)
      })
  }, [user, tick])

  useEffect(() => {
    if (pickup?.partner_id) {
      supabase.rpc('list_public_partners').select('id, trade_name, address, neighborhood, logo_url, lat, lng').eq('id', pickup.partner_id).maybeSingle().then(({ data }) => setPartner(data as PickupPartner | null))
    }
  }, [pickup?.partner_id])

  // O brinde entregue só é definido pelo parceiro na hora da retirada
  // (confirm_pickup_delivery) — antes disso pickup.product_id é null, já
  // que cada parceiro cadastra o brinde da própria escolha e pode ter mais
  // de uma opção em estoque.
  useEffect(() => {
    if (pickup?.product_id) {
      supabase.from('products').select('name, image_url').eq('id', pickup.product_id).maybeSingle().then(({ data }) => setProduct(data as any))
    } else {
      setProduct(null)
    }
  }, [pickup?.product_id])

  useEffect(() => {
    const t = setInterval(() => setTick((v) => v + 1), 60000)
    return () => clearInterval(t)
  }, [])

  const distanceKm = geo.status === 'granted' && partner?.lat != null && partner?.lng != null
    ? haversineKm(geo.lat!, geo.lng!, partner.lat, partner.lng)
    : null

  const daysLeft = pickup?.deadline
    ? Math.ceil((new Date(pickup.deadline).getTime() - Date.now()) / 86400000)
    : null

  async function cancelPickup() {
    if (!pickup) return
    if (!window.confirm('Cancelar esta retirada? Você poderá escolher outro parceiro em seguida.')) return
    setCancelling(true)
    setCancelError(null)
    const { error } = await supabase.rpc('cancel_pickup_by_subscriber', { p_pickup_id: pickup.id })
    setCancelling(false)
    if (error) {
      const map: Record<string, string> = {
        PICKUP_NOT_CANCELLABLE: 'Esta retirada não pode mais ser cancelada.',
        PICKUP_DEADLINE_PASSED: 'O prazo de 30 dias já passou, não é possível cancelar.',
      }
      setCancelError(map[error.message] ?? 'Não foi possível cancelar esta retirada.')
      return
    }
    setTick((v) => v + 1)
  }

  if (subLoading || loadingPickup) return <LoadingState dark label="Carregando retirada..." className="py-16" />

  if (!pickup) {
    return (
      <EmptyState
        dark
        icon={Gift}
        title="Nenhuma retirada escolhida"
        description="Você ainda não escolheu seu ponto de retirada deste mês."
        className="py-16"
        action={<Link to="/app/beneficios" className="btn-gold">Escolher ponto de retirada</Link>}
      />
    )
  }

  if (pickup.status === 'cancelled' || pickup.status === 'expired') {
    return (
      <div className="space-y-5">
        <div>
          <h1 className="font-display text-xl font-semibold">Brinde do mês</h1>
          <p className="text-sm text-white/50">Retirada #{pickup.cycle_month.toString().padStart(2, '0')}/{pickup.cycle_year}</p>
        </div>
        <EmptyState
          dark
          icon={XCircle}
          title={pickup.status === 'cancelled' ? 'Retirada cancelada' : 'Prazo de retirada expirado'}
          description={pickup.status === 'cancelled' ? 'O parceiro cancelou esta reserva. Escolha outro ponto de retirada.' : 'O prazo para retirar este brinde acabou. Escolha um novo ponto de retirada.'}
          className="py-16"
          action={<Link to="/app/beneficios" className="btn-gold">Escolher outro parceiro</Link>}
        />
      </div>
    )
  }

  const currentStepIndex = pickup.status === 'withdrawn' ? 3 : pickup.status === 'ready' ? 1 : 0

  return (
    <div className="space-y-5" key={tick}>
      <div>
        <h1 className="font-display text-xl font-semibold">Brinde do mês</h1>
        <p className="text-sm text-white/50">Retirada #{pickup.cycle_month.toString().padStart(2, '0')}/{pickup.cycle_year}</p>
      </div>

      {pickup.status !== 'withdrawn' && daysLeft !== null && (
        <div className="card !py-2.5 flex items-center gap-2 text-xs text-white/60">
          <Clock size={13} className="text-gold-400 shrink-0" />
          {daysLeft <= 0
            ? 'O prazo para retirada vence hoje.'
            : daysLeft === 1
              ? 'Falta 1 dia para o prazo de retirada vencer.'
              : `Faltam ${daysLeft} dias para o prazo de retirada vencer (30 dias a partir da escolha).`}
        </div>
      )}

      {cancelError && <p className="text-xs bg-red-500/10 text-red-400 rounded-lg px-3 py-2">{cancelError}</p>}

      <div className="card !p-0 overflow-hidden">
        <div className="flex items-center gap-3 p-4">
          {product?.image_url ? (
            <img src={product.image_url} alt={product.name} className="w-16 h-16 object-contain rounded-lg bg-white shrink-0" />
          ) : (
            <div className="w-16 h-16 rounded-lg bg-ink-950 border border-ink-800 flex items-center justify-center shrink-0">
              <Gift size={22} className="text-white/20" />
            </div>
          )}
          <div>
            <p className="text-xs text-white/40">{product ? 'Seu brinde deste mês' : 'Brinde definido pelo parceiro na retirada'}</p>
            <p className="font-semibold">{product?.name ?? 'A confirmar no balcão'}</p>
          </div>
        </div>
      </div>

      <div className="card">
        <p className="text-xs text-white/40 mb-2">Parceiro selecionado</p>
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-full bg-gold-gradient p-[1.5px] shrink-0">
            <div className="w-full h-full rounded-full bg-ink-800 flex items-center justify-center font-display text-gold-400 font-semibold overflow-hidden">
              {partner?.logo_url ? <img src={partner.logo_url} alt="" className="w-full h-full object-cover" /> : partner?.trade_name.slice(0, 2).toUpperCase()}
            </div>
          </div>
          <div className="min-w-0 flex-1">
            <p className="font-semibold truncate">{partner?.trade_name ?? '...'}</p>
            <p className="text-xs text-white/40 flex items-center gap-1 truncate">
              <MapPin size={11} className="shrink-0" /> {partner?.address}{partner?.neighborhood && `, ${partner.neighborhood}`}
              {distanceKm !== null && ` · ${formatDistance(distanceKm)} de você`}
            </p>
          </div>
        </div>

        {pickup.status !== 'withdrawn' && (
          <button
            onClick={cancelPickup}
            disabled={cancelling}
            className="mt-3 w-full flex items-center justify-center gap-1.5 text-xs font-medium text-red-400 hover:text-red-300 disabled:opacity-50 py-1.5"
          >
            <X size={13} /> {cancelling ? 'Cancelando...' : 'Cancelar e escolher outro parceiro'}
          </button>
        )}
      </div>

      <div className="card text-center space-y-4">
        {pickup.status === 'withdrawn' ? (
          <p className="text-sm font-semibold text-emerald-400 flex items-center justify-center gap-1.5"><Check size={16} /> Brinde retirado com sucesso!</p>
        ) : (
          <p className="text-sm font-semibold text-gold-400 flex items-center justify-center gap-1.5"><Gift size={16} /> Seu brinde está disponível!</p>
        )}

        <div className="flex justify-center py-2">
          <div className="bg-white p-4 rounded-xl">
            <QRCodeSVG value={pickup.code} size={160} />
          </div>
        </div>

        <div>
          <p className="text-xs text-white/40 mb-1">Código de retirada</p>
          <p className="font-display text-2xl font-bold tracking-wider text-gold-400">{pickup.code}</p>
        </div>

        {pickup.status !== 'withdrawn' && (
          <div className="flex items-center justify-center gap-2 text-xs text-white/30">
            <RefreshCw size={12} /> Atualiza automaticamente
          </div>
        )}

        <p className="text-xs text-white/40">
          {pickup.status === 'withdrawn'
            ? 'Apresente este comprovante se precisar confirmar a retirada com o parceiro.'
            : `Apresente este código ao parceiro. Retire até ${formatDate(pickup.deadline)}.`}
        </p>
      </div>

      <div className="card">
        <p className="text-xs text-white/40 mb-4">Acompanhe seu pedido</p>
        <div className="flex items-start justify-between">
          {STEPS.map((step, i) => {
            const done = i <= currentStepIndex
            const isLast = i === STEPS.length - 1
            return (
              <div key={step.key} className="flex-1 flex flex-col items-center relative">
                {!isLast && (
                  <div className={`absolute top-3.5 left-1/2 w-full h-0.5 ${i < currentStepIndex ? 'bg-gold-400' : 'bg-ink-800'}`} />
                )}
                <div className={`relative z-10 w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-bold ${done ? 'bg-gold-gradient text-ink-950' : 'bg-ink-800 text-white/40'}`}>
                  {done ? <Check size={13} /> : i + 1}
                </div>
                <p className={`text-[10px] text-center mt-1.5 px-1 ${done ? 'text-white/70' : 'text-white/30'}`}>{step.label}</p>
              </div>
            )
          })}
        </div>
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
