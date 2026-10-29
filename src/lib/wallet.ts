// Mesma regra de available_balance/available_bonus_balance no banco:
// bonus_subscription, adjustment, bonus_consumption e bonus_partner_fee
// ficam disponíveis na hora, independente da forma de pagamento que
// originou o bônus (pedido explícito do dono — todo bônus de indicação
// libera na hora agora, sem exceção). A venda de produto recebida pelo
// parceiro (purchase) é o único que continua com retenção: só fica retida
// quando o assinante pagou com saldo interno — Pix, cartão e ativação
// manual já são dinheiro confirmado, então libera na hora. O método de
// pagamento original não vem na linha da carteira, mas já é gravado no
// texto da descrição pelo confirm_product_order_delivery() lá no banco,
// daí o "saldo interno" aqui.
const HOLD_DAYS = 7
const IMMEDIATE_TYPES = new Set(['bonus_subscription', 'adjustment', 'bonus_consumption', 'bonus_partner_fee'])

export function pendingDaysLeft(tx: { type: string; direction: string; created_at: string; description?: string | null }): number | null {
  if (tx.direction !== 'in') return null
  if (IMMEDIATE_TYPES.has(tx.type)) return null
  if (tx.type === 'purchase' && !(tx.description ?? '').includes('saldo interno')) return null
  const daysElapsed = (Date.now() - new Date(tx.created_at).getTime()) / 86_400_000
  const left = Math.ceil(HOLD_DAYS - daysElapsed)
  return left > 0 ? left : null
}
