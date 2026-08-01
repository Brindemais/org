import { Link } from 'react-router-dom'
import { Users2, Store } from 'lucide-react'
import { LogoBadge } from '../../components/layout/Logo'

export default function LoginChooser() {
  return (
    <div className="min-h-dvh flex items-center justify-center bg-white px-5 py-10">
      <div className="w-full max-w-sm text-center">
        <Link to="/" className="flex justify-center mb-8"><LogoBadge size={130} /></Link>
        <h1 className="font-display text-xl font-semibold mb-1 text-ink-950">Como você quer entrar?</h1>
        <p className="text-sm text-black/50 mb-6">Escolha o acesso da sua conta.</p>
        <div className="space-y-3">
          <Link to="/entrar/assinante" className="card-light flex items-center gap-4 !py-5 hover:border-gold-400/40 transition">
            <div className="w-11 h-11 rounded-full bg-gold-400/15 flex items-center justify-center shrink-0">
              <Users2 size={19} className="text-gold-500" />
            </div>
            <div className="text-left">
              <p className="font-semibold text-ink-950 text-sm">Sou assinante</p>
              <p className="text-xs text-black/45">Acesse seus benefícios, carteira e indicações</p>
            </div>
          </Link>
          <Link to="/entrar/parceiro" className="card-light flex items-center gap-4 !py-5 hover:border-gold-400/40 transition">
            <div className="w-11 h-11 rounded-full bg-gold-400/15 flex items-center justify-center shrink-0">
              <Store size={19} className="text-gold-500" />
            </div>
            <div className="text-left">
              <p className="font-semibold text-ink-950 text-sm">Sou parceiro</p>
              <p className="text-xs text-black/45">Gerencie retiradas, estoque e promoções</p>
            </div>
          </Link>
        </div>
      </div>
    </div>
  )
}
