import { Link, useNavigate } from 'react-router-dom'
import { useEffect, useMemo, useState } from 'react'
import {
  Gift, Users2, UserPlus, ShieldCheck, Wallet, PackageCheck, Instagram, Facebook, Youtube, Music2,
  ChevronRight, ChevronDown, MapPin, ShoppingBag, Percent, Lock, History,
  Headset, Ban, Copy, Share2, Search, ArrowRight,
} from 'lucide-react'
import { supabase } from '../../lib/supabase'
import type { Partner, Promotion, ProductRow } from '../../lib/types'

// Landing is public/unauthenticated — only request the columns the card
// actually renders. `partners_public_read` grants row access by status, not
// column access, so a bare select('*') here would ship phone/email/
// responsible_name/cnpj_cpf/address of every partner to any visitor's
// network tab even though the UI never shows them.
type PublicPartner = Pick<Partner, 'id' | 'trade_name' | 'category' | 'neighborhood' | 'logo_url' | 'opening_hours'>
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
];
