import { Link } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { Wine, Gift, Users2, ShieldCheck, Instagram, Facebook, ChevronRight } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import type { Partner } from '../../lib/types'
import { PublicHeader } from './PublicHeader'
import { Logo } from '../../components/layout/Logo'

const WHATSAPP_PARTNER_LINK = 'https://wa.me/5521999999999?text=Quero%20ser%20parceiro%20Brinde%20Mais'

export default function Landing() {
  const [partners, setPartners] = useState<Partner[]>([])

  useEffect(() => {
    supabase
      .from('partners')
      .select('*')
      .in('status', ['approved', 'active'])
      .limit(4)
      .then(({ data }) => setPartners((data as Partner[]) ?? []))
  }, [])

  return (
    <div className="bg-ink-950">
      <PublicHeader />

      {/* HERO */}
      <section id="inicio" className="relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_80%_-10%,rgba(212,148,30,0.18),transparent_55%)]" />
        <div className="max-w-6xl mx-auto px-5 pt-14 pb-20 grid lg:grid-cols-2 gap-12 items-center relative">
          <div>
            <span className="pill bg-gold-400/15 text-gold-300 mb-5">Clube de benefícios</span>
            <h1 className="font-display text-4xl sm:text-5xl font-semibold leading-[1.1] mb-5">
              Mais amigos, mais benefícios,<br className="hidden sm:block" /> mais motivos para <span className="text-gold-400">brindar.</span>
            </h1>
            <p className="text-white/60 text-lg mb-8 max-w-md">
              Descontos exclusivos, prêmios especiais e o Brinde do Mês para você aproveitar em uma comunidade nacional de consumo inteligente.
            </p>
            <div className="flex flex-wrap items-center gap-4">
              <Link to="/cadastro" className="btn-gold">
                Quero assinar agora <ChevronRight size={17} />
              </Link>
              <span className="text-xs text-white/40">Assinatura mensal via Pix · Cancele quando quiser</span>
            </div>
            <div className="grid grid-cols-3 gap-4 mt-12 max-w-md">
              {[{ icon: Gift, label: 'Descontos exclusivos em parceiros' }, { icon: Wine, label: 'Brinde do mês todo mês' }, { icon: Users2, label: 'Convide amigos e ganhe mais' }].map(({ icon: Icon, label }) => (
                <div key={label} className="flex flex-col gap-2">
                  <Icon size={20} className="text-gold-400" />
                  <p className="text-xs text-white/50 leading-snug">{label}</p>
                </div>
              ))}
            </div>
          </div>
          <div className="relative">
            <div className="card !bg-ink-900/80 !border-ink-700 backdrop-blur p-8 relative">
              <div className="w-full aspect-square max-w-xs mx-auto rounded-full bg-gold-gradient/10 border border-gold-400/20 flex items-center justify-center">
                <Wine size={96} className="text-gold-400" strokeWidth={1.2} />
              </div>
              <div className="absolute -bottom-6 -right-2 sm:right-6 card !bg-ink-950 !border-gold-400/30 px-5 py-4 shadow-gold">
                <p className="text-[11px] text-white/40 mb-1">Saldo disponível</p>
                <p className="text-xl font-bold text-gold-300">R$ 245,60</p>
                <Link to="/entrar" className="text-xs text-gold-400 font-medium">Ver carteira →</Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* COMO FUNCIONA */}
      <section id="como-funciona" className="max-w-6xl mx-auto px-5 py-16 border-t border-ink-800/60">
        <h2 className="font-display text-2xl sm:text-3xl font-semibold mb-10">Como funciona</h2>
        <div className="grid sm:grid-cols-4 gap-6">
          {[
            { n: '01', title: 'Cadastro', desc: 'Crie sua conta em poucos passos.' },
            { n: '02', title: 'Assinatura', desc: 'Ative sua assinatura via Pix.' },
            { n: '03', title: 'Pagamento Pix', desc: 'Confirmação imediata e segura.' },
            { n: '04', title: 'Retirada', desc: 'Retire seu brinde e aproveite.' },
          ].map((s) => (
            <div key={s.n} className="card">
              <p className="text-gold-400 font-display text-2xl font-semibold mb-2">{s.n}</p>
              <p className="font-semibold mb-1">{s.title}</p>
              <p className="text-sm text-white/50">{s.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* BRINDE DO MÊS */}
      <section id="brinde" className="max-w-6xl mx-auto px-5 py-16 border-t border-ink-800/60 grid lg:grid-cols-2 gap-8">
        <div className="card flex flex-col gap-4">
          <span className="pill bg-gold-400/15 text-gold-300 w-fit">Exclusivo para assinantes</span>
          <h3 className="font-display text-2xl font-semibold">Brinde do mês</h3>
          <p className="text-white/60">Taça de Cerveja Premium Brinde Mais — retire no parceiro de sua escolha e ganhe um novo brinde a cada renovação.</p>
          <Link to="/cadastro" className="btn-gold w-fit">Ver detalhes</Link>
        </div>
        <div id="beneficios" className="card">
          <h3 className="font-display text-2xl font-semibold mb-4">Benefícios do clube</h3>
          <ul className="space-y-3 text-sm text-white/70">
            {[
              'Um brinde mensal em parceiro à sua escolha',
              'Descontos exclusivos em estabelecimentos parceiros',
              'Cashback e bonificação por indicação em até 7 níveis',
              'Loja virtual exclusiva com preços especiais',
              'Comunidade nacional de consumo e benefícios',
            ].map((b) => (
              <li key={b} className="flex gap-2.5">
                <ShieldCheck size={16} className="text-gold-400 shrink-0 mt-0.5" />
                {b}
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* PARCEIROS */}
      <section id="parceiros" className="max-w-6xl mx-auto px-5 py-16 border-t border-ink-800/60">
        <div className="flex items-center justify-between mb-6">
          <h2 className="font-display text-2xl sm:text-3xl font-semibold">Parceiros próximos</h2>
          <Link to="/cadastro" className="text-sm text-gold-400 font-medium flex items-center gap-1">Ver todos <ChevronRight size={15} /></Link>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {(partners.length ? partners : Array.from({ length: 4 })).map((p, i) => (
            <div key={p ? (p as Partner).id : i} className="card text-center">
              <div className="w-14 h-14 rounded-full bg-ink-800 mx-auto mb-3 flex items-center justify-center font-display font-semibold text-gold-400">
                {p ? (p as Partner).trade_name.slice(0, 2).toUpperCase() : '—'}
              </div>
              <p className="font-medium text-sm">{p ? (p as Partner).trade_name : 'Em breve'}</p>
              <p className="text-xs text-white/40">{p ? (p as Partner).neighborhood ?? (p as Partner).city : 'Rio de Janeiro'}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA PARCEIRO + FOOTER */}
      <section className="max-w-6xl mx-auto px-5 py-16 border-t border-ink-800/60 grid lg:grid-cols-2 gap-6">
        <div className="card !bg-gold-gradient !border-transparent text-ink-950">
          <p className="text-xs font-bold uppercase tracking-wide opacity-70 mb-1">Descontos exclusivos</p>
          <h3 className="font-display text-xl font-semibold mb-2">10% OFF em cervejas selecionadas</h3>
          <p className="text-sm opacity-80 mb-4">Ofertas especiais renovadas todo mês, exclusivas para assinantes Brinde Mais.</p>
          <Link to="/cadastro" className="btn-dark !bg-ink-950 !text-white w-fit">Aproveitar</Link>
        </div>
        <div className="card">
          <p className="text-xs font-bold uppercase tracking-wide text-gold-400 mb-1">Quero ser parceiro</p>
          <h3 className="font-display text-xl font-semibold mb-2">Junte-se ao Brinde Mais</h3>
          <p className="text-sm text-white/60 mb-4">Aumente suas vendas, fidelize clientes e destaque sua marca para milhares de assinantes.</p>
          <a href={WHATSAPP_PARTNER_LINK} target="_blank" rel="noreferrer" className="btn-gold w-fit">Falar com um consultor</a>
        </div>
      </section>

      <footer className="border-t border-ink-800/60">
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
              <li>Termos e condições</li>
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
