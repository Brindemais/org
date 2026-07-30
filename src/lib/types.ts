export type UserRole = 'subscriber' | 'partner' | 'admin' | 'operator'
export type SubscriptionStatus = 'pending' | 'active' | 'overdue' | 'suspended' | 'cancelled'
export type PaymentStatus = 'pending' | 'confirmed' | 'failed' | 'duplicate' | 'cancelled' | 'refunded'
export type PartnerStatus = 'interested' | 'pending_docs' | 'analyzing' | 'approved' | 'active' | 'suspended' | 'rejected' | 'closed'
export type PickupStatus = 'reserved' | 'ready' | 'withdrawn' | 'cancelled' | 'expired'
export type WithdrawalStatus = 'requested' | 'analyzing' | 'approved' | 'rejected' | 'paid'
export type PromotionStatus = 'draft' | 'pending_approval' | 'approved' | 'rejected' | 'suspended' | 'expired'
export type OrderStatus = 'pending_payment' | 'paid' | 'ready' | 'completed' | 'cancelled'
export type TicketStatus = 'open' | 'in_progress' | 'resolved' | 'closed'

export interface Profile {
  id: string
  role: UserRole
  full_name: string
  cpf: string | null
  birth_date: string | null
  phone: string | null
  email: string | null
  cep: string | null
  address: string | null
  neighborhood: string | null
  city: string | null
  state: string | null
  pix_key: string | null
  referral_code: string
  referred_by: string | null
  active: boolean
  created_at: string
}

export interface Partner {
  id: string
  company_name: string
  trade_name: string
  cnpj_cpf: string | null
  responsible_name: string | null
  phone: string | null
  whatsapp: string | null
  email: string | null
  cep: string | null
  address: string | null
  neighborhood: string | null
  city: string | null
  state: string | null
  category: string
  opening_hours: string | null
  logo_url: string | null
  images: string[]
  pix_key: string | null
  status: PartnerStatus
  rating: number
  created_at: string
  approved_at: string | null
}

export interface Subscription {
  id: string
  subscriber_id: string
  status: SubscriptionStatus
  amount: number
  activated_at: string | null
  expires_at: string | null
  cancelled_at: string | null
  created_at: string
}

export interface Payment {
  id: string
  subscriber_id: string
  subscription_id: string | null
  order_id: string | null
  amount: number
  type: 'subscription' | 'store'
  status: PaymentStatus
  pix_code: string | null
  external_reference: string
  confirmed_at: string | null
  confirmed_by: string | null
  created_at: string
}

export interface ProductRow {
  id: string
  partner_id: string | null
  name: string
  description: string | null
  image_url: string | null
  category: string
  normal_price: number
  subscriber_price: number
  is_gift: boolean
  store_visible: boolean
  active: boolean
  created_at: string
}

export interface StockPartnerRow {
  id: string
  partner_id: string
  product_id: string
  quantity: number
}

export interface Pickup {
  id: string
  subscriber_id: string
  subscription_id: string
  partner_id: string
  product_id: string | null
  status: PickupStatus
  code: string
  cycle_month: number
  cycle_year: number
  authorized_person_id: string | null
  actually_withdrawn_by: string | null
  confirmed_by: string | null
  confirmed_at: string | null
  cancelled_reason: string | null
  deadline: string
  created_at: string
}

export interface WalletTransaction {
  id: string
  user_id: string
  type: string
  direction: 'in' | 'out'
  amount: number
  balance_after: number
  status: string
  reference_type: string | null
  reference_id: string | null
  description: string
  created_at: string
}

export interface Withdrawal {
  id: string
  user_id: string
  amount: number
  pix_key: string
  status: WithdrawalStatus
  requested_at: string
  processed_at: string | null
  notes: string | null
}

export interface Promotion {
  id: string
  partner_id: string
  title: string
  description: string | null
  normal_price: number | null
  subscriber_price: number | null
  discount_pct: number | null
  valid_from: string
  valid_until: string
  status: PromotionStatus
  created_at: string
}

export interface NotificationRow {
  id: string
  user_id: string
  type: string
  title: string
  message: string
  read: boolean
  created_at: string
}

export interface AuthorizedPerson {
  id: string
  subscriber_id: string
  full_name: string
  cpf: string
  phone: string | null
  relationship: string | null
  active: boolean
}

export const PARTNER_CATEGORIES = [
  { value: 'bar', label: 'Bares' },
  { value: 'restaurante', label: 'Restaurantes' },
  { value: 'deposito', label: 'Depósitos de bebidas' },
  { value: 'supermercado', label: 'Supermercados' },
  { value: 'conveniencia', label: 'Lojas de conveniência' },
  { value: 'adega', label: 'Adegas' },
  { value: 'distribuidora', label: 'Distribuidoras' },
  { value: 'outros', label: 'Outros parceiros' },
]
