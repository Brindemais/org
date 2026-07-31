import { Link } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { Wine, Gift, Users2, UserPlus, ShieldCheck, Wallet, PackageCheck, Instagram, Facebook, ChevronRight } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import type { Partner, Promotion } from '../../lib/types'
import { PublicHeader } from './PublicHeader'
import { Logo } from '../../components/layout/Logo'
import { BeerGlassArt, BeerBottleArt } from '../../components/layout/Illustrations'

const WHATSAPP_PARTNER_LINK = 'https://wa.me/5521999999999?text=Quero%20ser%20parceiro%20Brinde%20Mais'

const STEPS = [
  { icon: UserPlus, title: 'Cadastro', desc: 'Crie sua conta em poucos passos' },
  { icon: Gift, title: 'Assinatura', desc: 'Ative sua assinatura em poucos passos' },
  { icon: ShieldCheck, title: 'Pagamento Pix', desc: 'Confirmação imediata e segura' },
  { icon: PackageCheck, title: 'Retirada', desc: 'Retire seu brinde e aproveite' },
]

export default function Landing() {
  const [partners, setPartners] = useState<Partner[]>([])
  const [promo, setPromo] = useState<Promotion | null>(null)

  useEffect(() => {
    supabase.from('partners').select('*').in('status', ['approved', 'active']).limit(4)
      .then(({ data }) => setPartners((data as Partner[]) ?? []))
    supabase.from('promotions').select('*').eq('status', 'approved').gte('valid_until', new Date().toISOString().slice(0, 10)).limit(1).maybeSingle()
      .then(({ data }) => setPromo(data as Promotion | null))
  }, [])

  return (
    <div className="bg-white text-ink-950">
      <PublicHeader />

      {/* HERO */}
      <section id="inicio" className="relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_80%_-10%,rgba(212,148,30,0.10),transparent_55%)]" />
        <div className="max-w-6xl mx-auto px-5 pt-14 pb-10 grid lg:grid-cols-2 gap-12 items-center relative">
          <div>
            <span className="pill bg-gold-400/15 text-gold-600 mb-5">Clube de benefícios</span>
            <h1 className="font-display text-4xl sm:text-5xl font-semibold leading-[1.1] mb-5 text-ink-950">
              Mais amigos, mais benefícios,<br className="hidden sm:block" /> mais motivos para <span className="text-gold-500">brindar!</span>
            </h1>
            <p className="text-black/55 text-lg mb-8 max-w-md">
              Descontos exclusivos, prêmios especiais e o Brinde do Mês para você aproveitar.
            </p>
            <div className="flex flex-wrap items-center gap-4">
              <Link to="/cadastro" className="btn-gold">
                Quero assinar agora <ChevronRight size={17} />
              </Link>
            </div>
            <p className="text-xs text-black/40 mt-3">Assinatura mensal via Pix · Cancele quando quiser</p>
          </div>
          <div className="relative">
            <div className="card-light !bg-[#faf8f3] p-8 relative overflow-visible">
              <div className="flex items-center justify-center">
                <BeerGlassArt width={190} />
              </div>
              <div className="absolute -bottom-6 -right-2 sm:right-6 card-light !bg-ink-950 px-5 py-4 shadow-gold">
                <p className="text-[11px] text-white/40 mb-1">Saldo disponível</p>
                <p className="text-xl font-bold text-gold-300">R$ 245,60</p>
                <Link to="/entrar" className="text-xs text-gold-400 font-medium">Ver carteira →</Link>
              </div>
            </div>
          </div>
        </div>

        {/* 3 destaques */}
        <div className="max-w-6xl mx-auto px-5 pb-16 grid sm:grid-cols-3 gap-6 relative">
          {[
            { icon: Gift, title: 'Descontos exclusivos', desc: 'em parceiros selecionados' },
            { icon: Wine, title: 'Brinde do mês', desc: 'todo mês para você' },
            { icon: Users2, title: 'Convide amigos', desc: 'e ganhe mais benefícios' },
          ].map(({ icon: Icon, title, desc }) => (
            <div key={title} className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-gold-400/10 flex items-center justify-center shrink-0">
                <Icon size={19} className="text-gold-500" />
              </div>
              <div>
                <p className="text-sm font-semibold text-ink-950">{title}</p>
                <p className="text-xs text-black/45">{desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* COMO FUNCIONA + BRINDE DO MÊS */}
      <section id="como-funciona" className="max-w-6xl mx-auto px-5 py-16 border-t border-black/10 grid lg:grid-cols-[1.4fr,1fr] gap-6">
        <div className="card-light">
          <h2 className="font-display text-xl font-semibold mb-6 text-ink-950">Como funciona</h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-6">
            {STEPS.map(({ icon: Icon, title, desc }) => (
              <div key={title} className="flex flex-col items-center text-center gap-2">
                <div className="w-12 h-12 rounded-full border border-gold-400/30 bg-gold-400/10 flex items-center justify-center">
                  <Icon size={20} className="text-gold-500" />
                </div>
                <p className="text-sm font-semibold text-ink-950">{title}</p>
                <p className="text-xs text-black/45 leading-snug">{desc}</p>
              </div>
            ))}
          </div>
        </div>

        <div id="brinde" className="card-light flex flex-col">
          <span className="pill bg-gold-400/15 text-gold-600 w-fit mb-3">Exclusivo para assinantes</span>
          <h3 className="font-display text-lg font-semibold mb-1 text-ink-950">Brinde do mês</h3>
          <p className="text-sm text-black/50 mb-4 flex-1">Taça de Cerveja Premium Brinde Mais</p>
          <div className="w-full aspect-video rounded-lg bg-gold-gradient/10 border border-gold-400/20 flex items-center justify-center mb-4 overflow-hidden">
            <BeerGlassArt width={90} />
          </div>
          <Link to="/cadastro" className="btn-gold w-full !py-2.5 text-sm">Ver detalhes</Link>
          <div className="flex justify-center gap-1.5 mt-4">
            {[0, 1, 2, 3].map((i) => (
              <span key={i} className={`w-1.5 h-1.5 rounded-full ${i === 0 ? 'bg-gold-400' : 'bg-black/10'}`} />
            ))}
          </div>
        </div>
      </section>

      {/* PARCEIROS / DESCONTOS / SEJA PARCEIRO */}
      <section id="parceiros" className="max-w-6xl mx-auto px-5 py-16 border-t border-black/10 grid lg:grid-cols-3 gap-6">
        <div className="card-light">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-ink-950">Parceiros próximos</h2>
            <Link to="/cadastro" className="text-xs text-gold-600 font-medium flex items-center gap-1">Ver todos <ChevronRight size={13} /></Link>
          </div>
          <p className="text-xs text-black/40 mb-4">Aproveite benefícios perto de você</p>
          <div className="grid grid-cols-4 gap-3">
            {(partners.length ? partners : Array.from({ length: 4 })).map((p, i) => (
              <div key={p ? (p as Partner).id : i} className="text-center">
                <div className="w-11 h-11 rounded-full bg-ink-950 border border-gold-400/40 mx-auto mb-1.5 flex items-center justify-center font-display text-xs font-semibold text-gold-400">
                  {p ? (p as Partner).trade_name.slice(0, 2).toUpperCase() : '—'}
                </div>
                <p className="text-[11px] font-medium leading-tight truncate text-ink-950">{p ? (p as Partner).trade_name : 'Em breve'}</p>
                <p className="text-[10px] text-gold-600">Até 15% OFF</p>
              </div>
            ))}
          </div>
        </div>

        <div id="beneficios" className="card-light !bg-ink-950 !border-transparent text-white relative overflow-hidden flex flex-col">
          <p className="text-xs font-bold uppercase tracking-wide text-gold-400 mb-1">Descontos exclusivos</p>
          <h3 className="font-display text-lg font-semibold mb-2 max-w-[60%]">
            {promo ? promo.title : '10% OFF em cervejas selecionadas'}
          </h3>
          <p className="text-sm text-white/60 mb-4 flex-1 max-w-[60%]">Ofertas especiais para assinantes Brinde Mais.</p>
          <Link to="/cadastro" className="btn-gold w-fit">Aproveitar</Link>
          <div className="absolute -right-2 bottom-0 opacity-90">
            <BeerBottleArt width={70} />
          </div>
        </div>

        <div className="card-light flex flex-col">
          <p className="text-xs font-bold uppercase tracking-wide text-gold-600 mb-1">Quero ser parceiro</p>
          <h3 className="font-display text-lg font-semibold mb-2 text-ink-950">Junte-se ao Brinde Mais</h3>
          <p className="text-sm text-black/55 mb-4 flex-1">Aumente suas vendas e fidelize clientes.</p>
          <a href={WHATSAPP_PARTNER_LINK} target="_blank" rel="noreferrer" className="btn-gold w-fit">Falar com um consultor</a>
        </div>
      </section>

      {/* BENEFÍCIOS DO CLUBE */}
      <section className="max-w-6xl mx-auto px-5 py-16 border-t border-black/10">
        <div className="card-light">
          <div className="flex items-center gap-2 mb-4">
            <Wallet size={18} className="text-gold-500" />
            <h3 className="font-display text-lg font-semibold text-ink-950">Benefícios do clube</h3>
          </div>
          <ul className="grid sm:grid-cols-2 gap-3 text-sm text-black/65">
            {[
              'Um brinde mensal em parceiro à sua escolha',
              'Descontos exclusivos em estabelecimentos parceiros',
              'Cashback e bonificação por indicação em até 7 níveis',
              'Loja virtual exclusiva com preços especiais',
            ].map((b) => (
              <li key={b} className="flex gap-2.5">
                <ShieldCheck size={16} className="text-gold-500 shrink-0 mt-0.5" />
                {b}
              </li>
            ))}
          </ul>
        </div>
      </section>

      <footer className="border-t border-black/10 bg-ink-950 text-white">
        <div className="max-w-6xl mx-auto px-5 py-12 grid sm:grid-cols-4 gap-8 text-sm">
          <div>
            <Logo size="sm" />
            <p className="text-white/40 mt-3 text-xs leading-relaxed">Mais amigos, mais benefícios,<br />mais motivos para brindar.</p>
          </div>
          <div>
            <p className="text-white/40 font-semibold mb-3 text-xs uppercase tracking-wide">Institucional</p>
            <ul className="space-y-2 text-white/60">
              <li>Sobre o Brinde Mais</li>
              <li>Como funciona</li>
              <li>Perguntas frequentes</li>
              <li><Link to="/termos" className="hover:text-gold-400">Termos e condições</Link></li>
              <li><Link to="/privacidade" className="hover:text-gold-400">Política de privacidade</Link></li>
            </ul>
          </div>
          <div>
            <p className="text-white/40 font-semibold mb-3 text-xs uppercase tracking-wide">Contato</p>
            <ul className="space-y-2 text-white/60">
              <li>contato@brindemais.com.br</li>
              <li>Piloto: Rio de Janeiro</li>
            </ul>
          </div>
          <div>
            <p className="text-white/40 font-semibold mb-3 text-xs uppercase tracking-wide">Ambiente 100% seguro</p>
            <div className="flex gap-3 text-white/50">
              <Instagram size={18} />
              <Facebook size={18} />
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}
