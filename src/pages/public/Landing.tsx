import { Link, useNavigate } from 'react-router-dom'
import { useEffect, useMemo, useState } from 'react'
import {
  Gift, Users2, UserPlus, ShieldCheck, Wallet, PackageCheck, Instagram, Facebook,
  ChevronRight, ChevronDown, MapPin, ShoppingBag, Percent, Lock, History,
  Headset, Ban, Copy, Share2, Search, ArrowRight,
} from 'lucide-react'
import { supabase } from '../../lib/supabase'
import type { Partner, Promotion, ProductRow } from '../../lib/types'
import { PARTNER_CATEGORIES } from '../../lib/types'
import { PublicHeader } from './PublicHeader'
import { Logo } from '../../components/layout/Logo'
import { BeerBottleArt } from '../../components/layout/Illustrations'
import { ResponsiveContainer } from '../../components/ui/ResponsiveContainer'
import { SectionTitle } from '../../components/ui/SectionTitle'
import { BenefitCard } from '../../components/ui/BenefitCard'
import { PartnerCard } from '../../components/ui/PartnerCard'
import { OfferCard } from '../../components/ui/OfferCard'
import { ProductCard } from '../../components/ui/ProductCard'
import { WalletCard } from '../../components/ui/WalletCard'
import { GiftCard } from '../../components/ui/GiftCard'
import { EmptyState } from '../../components/ui/EmptyState'
import { ImagePlaceholder } from '../../components/ui/ImagePlaceholder'
import { useToast } from '../../components/ui/Toast'

const WHATSAPP_PARTNER_LINK = 'https://wa.me/5521999999999?text=Quero%20ser%20parceiro%20Brinde%20Mais'
const REFERRAL_DEMO_LINK = 'brindemais.com.br/cadastro?ref=SEUCODIGO'

const STEPS = [
  { icon: UserPlus, title: 'Faça seu cadastro', desc: 'Crie sua conta em poucos passos' },
  { icon: ShieldCheck, title: 'Ative via Pix', desc: 'Confirmação oficial e segura' },
  { icon: MapPin, title: 'Escolha um parceiro', desc: 'Com estoque disponível perto de você' },
  { icon: PackageCheck, title: 'Retire e aproveite', desc: 'Seu brinde e os benefícios do clube' },
]

const BENEFITS = [
  { icon: Gift, title: 'Brinde mensal', description: 'Todo mês, um brinde à sua escolha em um parceiro com estoque disponível.' },
  { icon: Percent, title: 'Descontos exclusivos', description: 'Vantagens em bares, restaurantes, adegas e distribuidoras parceiras.' },
  { icon: Wallet, title: 'Cashback e créditos', description: 'Parte do seu consumo na rede volta para você em créditos.' },
  { icon: ShieldCheck, title: 'Promoções especiais', description: 'Ofertas por tempo limitado só para assinantes ativos.' },
  { icon: Users2, title: 'Indique e ganhe', description: 'Bonificações por indicação em até 7 níveis da sua rede.' },
  { icon: MapPin, title: 'Parceiros próximos', description: 'Encontre estabelecimentos por cidade, bairro ou distância.' },
  { icon: ShoppingBag, title: 'Loja exclusiva', description: 'Produtos personalizados com preço especial para assinantes.' },
  { icon: History, title: 'Carteira e extrato', description: 'Acompanhe saldo, origem dos créditos e solicite saques.' },
]

const FAQ = [
  { q: 'Quanto custa a assinatura?', a: 'A assinatura mensal custa R$ 79,00, com pagamento via Pix.' },
  { q: 'Como funciona o pagamento?', a: 'O pagamento é feito via Pix. A assinatura é ativada somente após a confirmação oficial do pagamento.' },
  { q: 'Quando recebo meu brinde?', a: 'Após a ativação da assinatura, você escolhe um parceiro com estoque disponível e retira seu brinde do mês dentro do prazo informado.' },
  { q: 'Como escolho o ponto de retirada?', a: 'Você escolhe entre os parceiros próximos que possuem estoque disponível no momento da retirada.' },
  { q: 'Posso trocar de parceiro?', a: 'A troca de parceiro após a confirmação da retirada segue as regras da plataforma e pode não ser permitida a qualquer momento.' },
  { q: 'Qual é o prazo para retirar?', a: 'O prazo para retirada é exibido na sua tela de retirada e varia conforme o ciclo mensal.' },
  { q: 'Outra pessoa pode retirar por mim?', a: 'Sim, é possível cadastrar uma pessoa autorizada para retirar o brinde em seu lugar.' },
  { q: 'Como funcionam os descontos?', a: 'Assinantes ativos têm acesso a preços e promoções exclusivas nos estabelecimentos parceiros participantes.' },
  { q: 'Como funciona o cashback?', a: 'Parte do valor de determinadas transações é convertida em crédito na sua carteira, conforme as regras vigentes da plataforma.' },
  { q: 'Como funcionam as indicações?', a: 'Você compartilha seu link exclusivo; quando indicados assinam e o pagamento é confirmado, você recebe bonificações em até 7 níveis da sua rede.' },
  { q: 'Posso usar meu saldo na plataforma?', a: 'Sim, o saldo disponível na sua carteira pode ser usado dentro da plataforma, conforme as regras de cada funcionalidade.' },
  { q: 'Como solicitar um saque?', a: 'Pela sua carteira, informando a chave Pix. A solicitação passa por validação antes do pagamento.' },
  { q: 'Como cancelar a assinatura?', a: 'O cancelamento pode ser solicitado a qualquer momento na área do assinante, na tela de Assinatura.' },
  { q: 'Como entrar em contato com o suporte?', a: 'Pela área de Suporte dentro da plataforma, após login, ou pelos canais de contato no rodapé deste site.' },
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
              aria-controls={`faq-${i}`}
            >
              <span className="text-sm font-medium text-ink-950">{item.q}</span>
              <ChevronDown size={18} className={`text-black/40 shrink-0 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
            </button>
            {isOpen && (
              <div id={`faq-${i}`} className="px-5 pb-4 text-sm text-black/55 leading-relaxed animate-fade-in-up">
                {item.a}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

export default function Landing() {
  const navigate = useNavigate()
  const goToSignup = () => navigate('/cadastro')
  const { showToast } = useToast()
  const [partners, setPartners] = useState<Partner[]>([])
  const [promos, setPromos] = useState<Promotion[]>([])
  const [products, setProducts] = useState<ProductRow[]>([])
  const [categoryFilter, setCategoryFilter] = useState<string>('')
  const [searchTerm, setSearchTerm] = useState('')

  useEffect(() => {
    supabase.from('partners').select('*').in('status', ['approved', 'active']).limit(8)
      .then(({ data }) => setPartners((data as Partner[]) ?? []))
    supabase.from('promotions').select('*').eq('status', 'approved').gte('valid_until', new Date().toISOString().slice(0, 10)).limit(3)
      .then(({ data }) => setPromos((data as Promotion[]) ?? []))
    supabase.from('products').select('*').eq('store_visible', true).eq('active', true).eq('approved', true).limit(4)
      .then(({ data }) => setProducts((data as ProductRow[]) ?? []))
  }, [])

  const filteredPartners = useMemo(() => {
    return partners.filter((p) => {
      if (categoryFilter && p.category !== categoryFilter) return false
      if (searchTerm && !p.trade_name.toLowerCase().includes(searchTerm.toLowerCase()) && !(p.neighborhood ?? '').toLowerCase().includes(searchTerm.toLowerCase())) return false
      return true
    })
  }, [partners, categoryFilter, searchTerm])

  function copyReferralLink() {
    navigator.clipboard?.writeText(`https://${REFERRAL_DEMO_LINK}`).then(() => showToast('Link copiado! Crie sua conta para gerar o seu link exclusivo.', 'success'))
  }

  return (
    <div className="bg-white text-ink-950">
      <PublicHeader />

      {/* ============ 4.2 HERO ============ */}
      <section id="inicio" className="relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_80%_-10%,rgba(212,148,30,0.10),transparent_55%)]" />
        <ResponsiveContainer className="pt-12 pb-10 grid lg:grid-cols-2 gap-12 items-center relative">
          <div>
            <span className="pill bg-gold-400/15 text-gold-600 mb-5">Clube de benefícios</span>
            <h1 className="font-display text-4xl sm:text-5xl font-semibold leading-[1.1] mb-5 text-ink-950">
              Mais amigos. Mais benefícios.<br className="hidden sm:block" /> Mais motivos para <span className="text-gold-500">brindar!</span>
            </h1>
            <p className="text-black/55 text-lg mb-4 max-w-md">
              Faça parte de uma comunidade nacional de consumo inteligente e tenha acesso a brindes mensais, descontos, cashback, promoções e vantagens exclusivas.
            </p>
            <p className="text-sm font-semibold text-gold-600 mb-8">Assinatura mensal por R$ 79,00 via Pix.</p>
            <div className="flex flex-wrap items-center gap-4">
              <Link to="/cadastro" className="btn-gold">
                Quero assinar agora <ChevronRight size={17} />
              </Link>
              <a href="#beneficios" className="btn-outline-light">Conheça os benefícios</a>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-10">
              {[
                { icon: Gift, label: 'Brinde mensal' },
                { icon: Percent, label: 'Descontos exclusivos' },
                { icon: Wallet, label: 'Cashback e créditos' },
                { icon: ShieldCheck, label: 'Vantagens em parceiros' },
              ].map(({ icon: Icon, label }) => (
                <div key={label} className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-gold-400/10 flex items-center justify-center shrink-0">
                    <Icon size={15} className="text-gold-500" />
                  </div>
                  <p className="text-xs font-medium text-black/60 leading-snug">{label}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="relative mt-4 lg:mt-0">
            <img
              src="/images/hero-glass-wallet.webp"
              alt="Taça de cerveja Brinde Mais sobre base dourada, ao lado de um cartão com o saldo disponível"
              width={1100}
              height={733}
              loading="eager"
              decoding="async"
              className="w-full rounded-xl2 shadow-lg"
            />
          </div>
        </ResponsiveContainer>
      </section>

      {/* ============ 4.3 COMO FUNCIONA ============ */}
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
          <p className="text-center text-xs text-black/40 mt-8 max-w-md mx-auto">
            A assinatura é ativada somente após a confirmação oficial do pagamento.
          </p>
        </ResponsiveContainer>
      </section>

      {/* ============ 4.4 BENEFÍCIOS PRINCIPAIS ============ */}
      <section id="beneficios" className="border-t border-black/10 py-16 bg-surface-subtle">
        <ResponsiveContainer>
          <SectionTitle eyebrow="O clube completo" title="Benefícios principais" description="O copo faz parte de um clube completo de benefícios, economia, fidelização e recompensas." />
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {BENEFITS.map((b, i) => (
              <BenefitCard key={b.title} {...b} delay={i * 60} onLearnMore={goToSignup} />
            ))}
          </div>
        </ResponsiveContainer>
      </section>

      {/* ============ 4.5 BRINDE DO MÊS ============ */}
      <section id="brinde" className="border-t border-black/10 py-16">
        <ResponsiveContainer className="grid lg:grid-cols-[1fr,1.3fr] gap-10 items-center">
          <GiftCard
            name="Taça de Cerveja Premium Brinde Mais"
            description="Copo temático personalizado com a marca Brinde Mais, o primeiro brinde da sua assinatura."
            deadlineLabel="até o fim do ciclo mensal"
            stockNote="O ponto de retirada escolhido precisa possuir estoque disponível."
            image={
              <img
                src="/images/gift-glass.webp"
                alt="Taça de Cerveja Premium Brinde Mais"
                loading="lazy"
                decoding="async"
                className="w-full h-full object-contain"
              />
            }
            onView={goToSignup}
          />
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-gold-600 mb-2">Não é só um copo</p>
            <h3 className="font-display text-2xl font-semibold text-ink-950 mb-4">
              Um clube completo de benefícios, economia e recompensas
            </h3>
            <p className="text-black/55 leading-relaxed mb-4">
              O primeiro brinde é uma taça temática personalizada, mas a assinatura Brinde Mais vai muito além: descontos
              exclusivos, cashback, bonificações por indicação e por consumo na rede, loja virtual exclusiva, carteira
              interna e acesso a uma comunidade nacional de consumo inteligente.
            </p>
            <ul className="space-y-2 text-sm text-black/65">
              {['O modelo do brinde pode variar de acordo com o parceiro escolhido', 'Retirada disponível apenas em pontos com estoque', 'Novos brindes e parceiros são adicionados ao longo do tempo'].map((t) => (
                <li key={t} className="flex gap-2.5">
                  <ShieldCheck size={16} className="text-gold-500 shrink-0 mt-0.5" /> {t}
                </li>
              ))}
            </ul>
          </div>
        </ResponsiveContainer>
      </section>

      {/* ============ 4.6 PARCEIROS PRÓXIMOS ============ */}
      <section id="parceiros" className="border-t border-black/10 py-16 bg-surface-subtle">
        <ResponsiveContainer>
          <SectionTitle
            eyebrow="Rede em expansão"
            title="Parceiros próximos"
            description="Aproveite benefícios em bares, restaurantes, adegas e distribuidoras parceiras perto de você."
            action={<Link to="/cadastro" className="text-sm text-gold-600 font-medium inline-flex items-center gap-1">Ver todos <ChevronRight size={15} /></Link>}
          />

          <div className="flex flex-wrap items-center gap-3 mb-6">
            <div className="relative flex-1 min-w-[200px] max-w-xs">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-black/30" />
              <input
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Busque por cidade, bairro ou CEP"
                className="input-light !pl-9 !py-2 text-sm"
              />
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setCategoryFilter('')}
                className={`pill border ${categoryFilter === '' ? 'bg-ink-950 text-white border-ink-950' : 'border-black/15 text-black/60'}`}
              >
                Todas categorias
              </button>
              {PARTNER_CATEGORIES.slice(0, 5).map((c) => (
                <button
                  key={c.value}
                  onClick={() => setCategoryFilter(c.value)}
                  className={`pill border ${categoryFilter === c.value ? 'bg-ink-950 text-white border-ink-950' : 'border-black/15 text-black/60'}`}
                >
                  {c.label}
                </button>
              ))}
            </div>
          </div>

          {filteredPartners.length === 0 ? (
            <EmptyState
              icon={MapPin}
              title="Nenhum parceiro encontrado"
              description="Ainda não há parceiros ativos com esse filtro. Assine para ser avisado assim que novos parceiros chegarem na sua região."
              action={<Link to="/cadastro" className="btn-gold !py-2 !px-4 text-sm">Quero assinar agora</Link>}
            />
          ) : (
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
              {filteredPartners.slice(0, 4).map((p) => (
                <PartnerCard
                  key={p.id}
                  name={p.trade_name}
                  category={p.category}
                  neighborhood={p.neighborhood}
                  logoUrl={p.logo_url}
                  openingHours={p.opening_hours}
                  hasStock
                  discountLabel="Até 15% OFF"
                  onView={goToSignup}
                />
              ))}
            </div>
          )}
        </ResponsiveContainer>
      </section>

      {/* ============ 4.7 DESCONTOS E PROMOÇÕES ============ */}
      <section id="promocoes" className="border-t border-black/10 py-16">
        <ResponsiveContainer>
          <SectionTitle eyebrow="Ofertas para assinantes" title="Descontos e promoções" description="Preços e condições especiais em parceiros selecionados, válidos apenas para assinantes ativos." />
          {promos.length === 0 ? (
            <EmptyState icon={Percent} title="Sem promoções ativas no momento" description="Novas promoções são publicadas com frequência pelos parceiros do clube." />
          ) : (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {promos.map((promo) => (
                <OfferCard
                  key={promo.id}
                  title={promo.title}
                  normalPrice={promo.normal_price}
                  subscriberPrice={promo.subscriber_price}
                  discountPct={promo.discount_pct}
                  validUntil={promo.valid_until}
                  rulesSummary={promo.description}
                  onClaim={goToSignup}
                />
              ))}
            </div>
          )}
        </ResponsiveContainer>
      </section>

      {/* ============ 4.8 INDIQUE E GANHE ============ */}
      <section id="indique" className="border-t border-black/10 py-16 bg-ink-950 text-white overflow-hidden relative">
        <div className="absolute -right-10 -bottom-10 opacity-20 hidden lg:block">
          <BeerBottleArt width={140} />
        </div>
        <ResponsiveContainer className="grid lg:grid-cols-2 gap-10 items-center relative">
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-gold-400 mb-2">Programa de indicação</p>
            <h2 className="font-display text-2xl sm:text-3xl font-semibold mb-3">Mais amigos, mais benefícios.</h2>
            <p className="text-white/60 mb-6 max-w-md">Compartilhe seu link exclusivo e acompanhe suas indicações e bonificações.</p>

            <div className="flex items-center gap-2 bg-white/5 border border-white/10 rounded-xl px-4 py-3 mb-4 max-w-md">
              <span className="text-sm text-white/50 truncate flex-1">{REFERRAL_DEMO_LINK}</span>
              <button onClick={copyReferralLink} className="text-gold-400 hover:text-gold-300 shrink-0" aria-label="Copiar link de indicação">
                <Copy size={16} />
              </button>
            </div>

            <div className="flex flex-wrap gap-3 mb-5">
              <a
                href="https://wa.me/?text=Vem%20pro%20Brinde%20Mais!"
                target="_blank"
                rel="noreferrer"
                className="btn-gold !py-2.5 text-sm"
              >
                <Share2 size={15} /> Compartilhar no WhatsApp
              </a>
              <button onClick={copyReferralLink} className="btn-ghost !py-2.5 text-sm">
                <Copy size={15} /> Copiar link
              </button>
            </div>

            <p className="text-xs text-white/40 max-w-md">
              Ganhe bonificações por indicação em até 7 níveis da sua rede. Os créditos dependem da confirmação do
              pagamento da assinatura de cada indicado. Não divulgamos dados pessoais de pessoas indicadas.
            </p>
          </div>
          <div className="flex justify-center">
            <ImagePlaceholder
              src="/images/gift-box.webp"
              alt="Composição de presente Brinde Mais: caneca dourada e caixa preta com laço dourado"
              icon={Gift}
              aspect="aspect-square"
              className="w-full max-w-xs"
            />
          </div>
        </ResponsiveContainer>
      </section>

      {/* ============ 4.9 CARTEIRA E GANHOS ============ */}
      <section id="carteira" className="border-t border-black/10 py-16">
        <ResponsiveContainer className="grid lg:grid-cols-[1fr,1.2fr] gap-10 items-center">
          <WalletCard balance={245.6} pendingBalance={38.2} cashback={64.9} referralEarnings={142.5} onViewWallet={goToSignup} onViewStatement={goToSignup} />
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-gold-600 mb-2">Sua carteira interna</p>
            <h3 className="font-display text-2xl font-semibold text-ink-950 mb-4">Acompanhe cada crédito, com transparência</h3>
            <p className="text-black/55 leading-relaxed mb-4">
              O extrato mostra a origem de cada crédito (cashback, bonificação por indicação ou por consumo na rede)
              para que você acompanhe exatamente de onde vem o seu saldo.
            </p>
            <p className="text-sm text-black/50 bg-surface-subtle border border-border rounded-xl px-4 py-3">
              Solicitações de saque estão sujeitas às regras e validações da plataforma.
            </p>
          </div>
        </ResponsiveContainer>
      </section>

      {/* ============ 4.10 LOJA EXCLUSIVA ============ */}
      <section id="loja" className="border-t border-black/10 py-16 bg-surface-subtle">
        <ResponsiveContainer>
          <SectionTitle
            eyebrow="Só para assinantes"
            title="Loja exclusiva"
            description="Produtos personalizados com preço especial, retirada em parceiro participante. Sem entrega em domicílio nesta fase."
            action={<Link to="/cadastro" className="text-sm text-gold-600 font-medium inline-flex items-center gap-1">Ver loja completa <ArrowRight size={15} /></Link>}
          />
          {products.length === 0 ? (
            <EmptyState icon={ShoppingBag} title="Loja em preparação" description="Os primeiros produtos exclusivos para assinantes chegam em breve." />
          ) : (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-5">
              {products.map((p) => (
                <ProductCard
                  key={p.id}
                  name={p.name}
                  imageUrl={p.image_url}
                  normalPrice={p.normal_price}
                  subscriberPrice={p.subscriber_price}
                  onView={goToSignup}
                />
              ))}
            </div>
          )}
        </ResponsiveContainer>
      </section>

      {/* ============ 4.11 QUERO SER PARCEIRO ============ */}
      <section id="seja-parceiro" className="border-t border-black/10 py-16">
        <ResponsiveContainer className="grid lg:grid-cols-2 gap-10 items-center">
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-gold-600 mb-2">Para o seu negócio</p>
            <h2 className="font-display text-2xl sm:text-3xl font-semibold text-ink-950 mb-4">Leve mais clientes para o seu negócio.</h2>
            <ul className="grid sm:grid-cols-2 gap-3 text-sm text-black/65 mb-6">
              {[
                'Exposição da marca para uma comunidade de consumidores',
                'Fidelização de clientes recorrentes',
                'Participação em campanhas promocionais do clube',
                'Divulgação por meio de brindes personalizados',
                'Acesso a relatórios de desempenho',
                'Aumento de recorrência de compra',
              ].map((b) => (
                <li key={b} className="flex gap-2.5">
                  <ShieldCheck size={16} className="text-gold-500 shrink-0 mt-0.5" /> {b}
                </li>
              ))}
            </ul>
            <Link to="/cadastro" className="btn-gold">
              Quero ser parceiro
            </Link>
          </div>
          <ImagePlaceholder
            src="/images/tumbler-app.webp"
            alt="Copo térmico Brinde Mais ao lado do app com o resumo de benefícios do assinante"
            icon={Users2}
            aspect="aspect-[4/3]"
            className="w-full"
          />
        </ResponsiveContainer>
      </section>

      {/* ============ 4.12 SEGURANÇA E CONFIANÇA ============ */}
      <section id="seguranca" className="border-t border-black/10 py-16 bg-surface-subtle">
        <ResponsiveContainer>
          <SectionTitle eyebrow="Confiança" title="Segurança e confiança" align="center" />
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {[
              { icon: ShieldCheck, title: 'Pagamento confirmado oficialmente', desc: 'A assinatura só é ativada após a confirmação oficial do pagamento via Pix.' },
              { icon: Lock, title: 'Proteção de dados', desc: 'Seus dados pessoais são tratados conforme a LGPD, com página própria de privacidade.' },
              { icon: PackageCheck, title: 'Controle de retiradas', desc: 'Cada retirada é validada por código único, evitando confirmações em duplicidade.' },
              { icon: History, title: 'Histórico de transações', desc: 'Todo crédito, débito e retirada fica registrado no seu extrato.' },
              { icon: Ban, title: 'Prevenção contra duplicidade', desc: 'Regras internas impedem CPFs duplicados e ativações repetidas de assinatura.' },
              { icon: Headset, title: 'Suporte ao usuário', desc: 'Canal de suporte dedicado dentro da plataforma para dúvidas e solicitações.' },
            ].map((f) => (
              <div key={f.title} className="card-light flex flex-col gap-2.5">
                <div className="w-10 h-10 rounded-xl bg-gold-400/10 flex items-center justify-center">
                  <f.icon size={18} className="text-gold-500" />
                </div>
                <p className="font-semibold text-ink-950 text-sm">{f.title}</p>
                <p className="text-xs text-black/50 leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </ResponsiveContainer>
      </section>

      {/* ============ 4.13 FAQ ============ */}
      <section id="faq" className="border-t border-black/10 py-16">
        <ResponsiveContainer narrow>
          <SectionTitle eyebrow="Dúvidas" title="Perguntas frequentes" align="center" />
          <Accordion items={FAQ} />
        </ResponsiveContainer>
      </section>

      {/* ============ 4.14 RODAPÉ ============ */}
      <footer className="border-t border-black/10 bg-ink-950 text-white">
        <ResponsiveContainer className="py-12 grid sm:grid-cols-2 lg:grid-cols-5 gap-8 text-sm">
          <div className="lg:col-span-2">
            <Logo size="sm" />
            <p className="text-white/40 mt-3 text-xs leading-relaxed max-w-xs">
              Mais amigos, mais benefícios, mais motivos para brindar. Clube de assinatura e benefícios que conecta
              consumidores e estabelecimentos parceiros.
            </p>
            <div className="flex gap-3 text-white/50 mt-4">
              <a href="#" aria-label="Instagram" className="hover:text-gold-400"><Instagram size={18} /></a>
              <a href="#" aria-label="Facebook" className="hover:text-gold-400"><Facebook size={18} /></a>
            </div>
          </div>
          <div>
            <p className="text-white/40 font-semibold mb-3 text-xs uppercase tracking-wide">Institucional</p>
            <ul className="space-y-2 text-white/60">
              <li><a href="#beneficios" className="hover:text-gold-400">Benefícios</a></li>
              <li><a href="#parceiros" className="hover:text-gold-400">Parceiros</a></li>
              <li><a href="#como-funciona" className="hover:text-gold-400">Como funciona</a></li>
              <li><a href="#faq" className="hover:text-gold-400">Perguntas frequentes</a></li>
            </ul>
          </div>
          <div>
            <p className="text-white/40 font-semibold mb-3 text-xs uppercase tracking-wide">Legal</p>
            <ul className="space-y-2 text-white/60">
              <li><Link to="/termos" className="hover:text-gold-400">Termos de Uso</Link></li>
              <li><Link to="/privacidade" className="hover:text-gold-400">Política de Privacidade</Link></li>
            </ul>
          </div>
          <div>
            <p className="text-white/40 font-semibold mb-3 text-xs uppercase tracking-wide">Contato</p>
            <ul className="space-y-2 text-white/60">
              <li>contato@brindemais.com.br</li>
              <li><a href={WHATSAPP_PARTNER_LINK} target="_blank" rel="noreferrer" className="hover:text-gold-400">WhatsApp</a></li>
              <li>Piloto: Rio de Janeiro</li>
            </ul>
          </div>
        </ResponsiveContainer>
        <div className="border-t border-white/10">
          <ResponsiveContainer className="py-5 flex flex-col sm:flex-row gap-2 items-center justify-between text-xs text-white/35">
            <p>© {new Date().getFullYear()} Brinde Mais. Todos os direitos reservados.</p>
            <p className="text-center sm:text-right">Benefícios e disponibilidade podem variar por região e parceiro.</p>
          </ResponsiveContainer>
        </div>
      </footer>
    </div>
  )
}
