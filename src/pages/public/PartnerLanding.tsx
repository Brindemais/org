import { Link } from 'react-router-dom'
import { useState } from 'react'
import { ChevronDown, ChevronRight, Megaphone, Users2, TrendingUp, Gift, BarChart3, Repeat, Store, ShieldCheck, CreditCard, CheckCircle2 } from 'lucide-react'
import { Logo, LogoBadge } from '../../components/layout/Logo'
import { ResponsiveContainer } from '../../components/ui/ResponsiveContainer'
import { SectionTitle } from '../../components/ui/SectionTitle'
import { formatBRL } from '../../lib/format'

const FEE_AMOUNT = 149.9

const BENEFITS = [
  { icon: Users2, title: 'Exposição pra novos clientes', desc: 'Seu estabelecimento aparece pra toda a comunidade de assinantes Brinde Mais da sua região.' },
  { icon: Repeat, title: 'Clientes recorrentes', desc: 'Assinantes voltam todo mês pra retirar o brinde e aproveitar descontos, criando recorrência de visita.' },
  { icon: Gift, title: 'Divulgação com brindes', desc: 'Ofereça um item do seu cardápio como brinde mensal e ganhe visibilidade dentro do app.' },
  { icon: Megaphone, title: 'Campanhas promocionais', desc: 'Participe de promoções por tempo limitado divulgadas direto pra base de assinantes ativos.' },
  { icon: BarChart3, title: 'Relatórios de desempenho', desc: 'Acompanhe retiradas, promoções e desempenho do seu estabelecimento no painel do parceiro.' },
  { icon: TrendingUp, title: 'Aumento de recorrência', desc: 'Descontos exclusivos e cashback incentivam o assinante a escolher seu negócio outras vezes.' },
]

const STEPS = [
  { icon: Store, title: 'Cadastre seu negócio', desc: 'Dados do estabelecimento, responsável e categoria.' },
  { icon: CreditCard, title: 'Pague a taxa de anunciante', desc: `${formatBRL(FEE_AMOUNT)}/mês via Pix, direto no cadastro.` },
  { icon: ShieldCheck, title: 'Aguarde a aprovação', desc: 'Nossa equipe analisa e libera a visibilidade pública.' },
  { icon: CheckCircle2, title: 'Apareça na rede', desc: 'Assinantes da sua região passam a ver seu negócio no app.' },
]

const FAQ = [
  { q: 'Quanto custa ser parceiro?', a: `A taxa de anunciante é de ${formatBRL(FEE_AMOUNT)}/mês, o mesmo valor da assinatura do consumidor. Ela libera sua área de anunciante no painel do parceiro: cadastro de brindes, promoções e relatórios.` },
  { q: 'Quando meu negócio aparece pra assinantes?', a: 'Depois que o cadastro é enviado e a taxa é paga, nossa equipe analisa as informações do estabelecimento. Assim que aprovado, o negócio passa a aparecer nas buscas e listagens públicas da plataforma.' },
  { q: 'Que tipo de negócio pode participar?', a: 'Bares, restaurantes, adegas, distribuidoras e estabelecimentos do setor de bebidas e alimentação em geral. A categoria é informada no cadastro.' },
  { q: 'Como funciona o brinde mensal do meu negócio?', a: 'Você define um item do seu cardápio ou estoque como brinde, com estoque próprio controlado pelo seu painel. Assinantes que escolherem seu estabelecimento retiram esse item mediante código de confirmação.' },
  { q: 'Preciso oferecer desconto pra todo mundo?', a: 'Os descontos e promoções que você cadastra valem só pra assinantes ativos da Brinde Mais, não pro público em geral.' },
  { q: 'Posso cancelar depois?', a: 'Sim, o status do estabelecimento pode ser encerrado a qualquer momento entrando em contato com o suporte.' },
]

function Accordion({ items }: { items: { q: string; a: string }[] }) {
  const [openIndex, setOpenIndex] = useState<number | null>(0)
  return (
    <div className="divide-y divide-black/10 border border-black/10 rounded-xl2 bg-white overflow-hidden">
      {items.map((item, i) => {
        const isOpen = openIndex === i
        return (
          <div key={item.q}>
            <button
              onClick={() => setOpenIndex(isOpen ? null : i)}
              className="w-full flex items-center justify-between gap-4 text-left px-5 py-4 focus-ring"
              aria-expanded={isOpen}
            >
              <span className="text-sm font-medium text-ink-950">{item.q}</span>
              <ChevronDown size={18} className={`text-black/40 shrink-0 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
            </button>
            {isOpen && <div className="px-5 pb-4 text-sm text-black/55 leading-relaxed animate-fade-in-up">{item.a}</div>}
          </div>
        )
      })}
    </div>
  )
}

export default function PartnerLanding() {
  return (
    <div className="bg-white text-ink-950">
      <header className="safe-top sticky top-0 z-40 bg-white/90 backdrop-blur border-b border-black/10">
        <div className="max-w-content mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
          <Link to="/" className="focus-ring rounded-lg shrink-0"><Logo size="sm" dark /></Link>
          <div className="flex items-center gap-2">
            <Link to="/entrar/parceiro" className="btn-outline-light !px-3 !py-2 text-xs whitespace-nowrap">Já sou parceiro</Link>
            <Link to="/seja-parceiro/cadastro" className="btn-gold !px-4 !py-2 text-sm">Quero ser parceiro</Link>
          </div>
        </div>
      </header>

      {/* HERO */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_80%_-10%,rgba(212,148,30,0.10),transparent_55%)]" />
        <ResponsiveContainer className="pt-14 pb-12 grid lg:grid-cols-2 gap-12 items-center relative">
          <div>
            <span className="pill bg-gold-400/15 text-gold-600 mb-5">Para o seu negócio</span>
            <h1 className="font-display text-4xl sm:text-5xl font-semibold leading-[1.1] mb-5 text-ink-950">
              Leve mais clientes para o seu negócio
            </h1>
            <p className="text-black/55 text-lg mb-8 max-w-md">
              Seja parceiro Brinde Mais e ganhe exposição para uma comunidade de assinantes ativos, com brindes, descontos e promoções que trazem gente de verdade até a sua porta.
            </p>
            <div className="flex flex-wrap items-center gap-4">
              <Link to="/seja-parceiro/cadastro" className="btn-gold">
                Quero ser parceiro <ChevronRight size={17} />
              </Link>
              <a href="#como-funciona" className="btn-outline-light">Como funciona</a>
            </div>
          </div>
          <div className="flex justify-center lg:justify-end">
            <LogoBadge size={220} />
          </div>
        </ResponsiveContainer>
      </section>

      {/* BENEFÍCIOS */}
      <section className="border-t border-black/10 py-16 bg-surface-subtle">
        <ResponsiveContainer>
          <SectionTitle eyebrow="Por que ser parceiro" title="O que você ganha" description="Mais movimento, mais recorrência, mais visibilidade, sem depender só da sua própria divulgação." />
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {BENEFITS.map((b) => (
              <div key={b.title} className="card-light flex flex-col gap-3">
                <div className="w-11 h-11 rounded-xl bg-gold-400/10 flex items-center justify-center">
                  <b.icon size={20} className="text-gold-500" strokeWidth={2} />
                </div>
                <h3 className="font-semibold text-ink-950">{b.title}</h3>
                <p className="text-sm text-black/55 leading-relaxed">{b.desc}</p>
              </div>
            ))}
          </div>
        </ResponsiveContainer>
      </section>

      {/* COMO FUNCIONA */}
      <section id="como-funciona" className="border-t border-black/10 py-16">
        <ResponsiveContainer>
          <SectionTitle eyebrow="Simples e rápido" title="Como funciona" align="center" />
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-6 relative">
            <div className="hidden sm:block absolute top-6 left-[12.5%] right-[12.5%] h-px bg-black/10" />
            {STEPS.map(({ icon: Icon, title, desc }, i) => (
              <div key={title} className="relative flex flex-col items-center text-center gap-2">
                <div className="w-12 h-12 rounded-full border border-gold-400/30 bg-white flex items-center justify-center relative z-10">
                  <Icon size={20} className="text-gold-500" />
                </div>
                <p className="text-[11px] font-bold text-gold-500">PASSO {i + 1}</p>
                <p className="text-sm font-semibold text-ink-950">{title}</p>
                <p className="text-xs text-black/45 leading-snug">{desc}</p>
              </div>
            ))}
          </div>
        </ResponsiveContainer>
      </section>

      {/* TAXA */}
      <section className="border-t border-black/10 py-16 bg-surface-subtle">
        <ResponsiveContainer narrow>
          <div className="card-light text-center max-w-md mx-auto">
            <p className="text-xs font-bold uppercase text-black/40 tracking-wide">Taxa de anunciante</p>
            <p className="font-display text-4xl font-semibold text-ink-950 mt-2">
              {formatBRL(FEE_AMOUNT)}<span className="text-sm font-medium text-black/40">/mês</span>
            </p>
            <p className="text-sm text-black/50 mt-2 mb-6">Mesmo valor da assinatura do consumidor. Paga via Pix, direto no cadastro.</p>
            <Link to="/seja-parceiro/cadastro" className="btn-gold w-full">Quero ser parceiro</Link>
          </div>
        </ResponsiveContainer>
      </section>

      {/* FAQ */}
      <section className="border-t border-black/10 py-16">
        <ResponsiveContainer narrow>
          <SectionTitle eyebrow="Dúvidas" title="Perguntas frequentes" align="center" />
          <Accordion items={FAQ} />
        </ResponsiveContainer>
      </section>

      {/* CTA FINAL */}
      <section className="border-t border-black/10 py-16">
        <ResponsiveContainer>
          <div className="rounded-xl2 bg-ink-950 text-white p-8 sm:p-10 flex flex-col sm:flex-row items-center justify-between gap-6">
            <div>
              <h3 className="font-display text-xl sm:text-2xl font-semibold mb-1">Pronto para levar mais clientes ao seu negócio?</h3>
              <p className="text-white/60 text-sm">Cadastro em poucos minutos, ativação via Pix.</p>
            </div>
            <Link to="/seja-parceiro/cadastro" className="btn-gold !px-6 !py-3 shrink-0">Quero ser parceiro</Link>
          </div>
        </ResponsiveContainer>
      </section>

      <footer className="border-t border-black/10 py-8">
        <ResponsiveContainer className="flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-black/40">
          <Logo size="sm" dark />
          <Link to="/" className="hover:text-gold-600">Voltar ao início</Link>
        </ResponsiveContainer>
      </footer>
    </div>
  )
}
