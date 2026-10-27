// Mesma regra de available_balance/available_bonus_balance no banco:
// bonus_subscription, adjustment e bonus_consumption ficam disponíveis na
// hora — bonus_partner_fee, cashback e venda de produto recebida pelo
// parceiro (purchase) ficam retidos por 7 dias.
const HOLD_DAYS = 7
const IMMEDIATE_TYPES = new Set(['bonus_subscription', 'adjustment', 'bonus_consumption'])

export function pendingDaysLeft(tx: { type: string; direction: string; created_at: string }): number | null {
  if (tx.direction !== 'in') return null
  if (IMMEDIATE_TYPES.has(tx.type)) return null
  const daysElapsed = (Date.now() - new Date(tx.created_at).getTime()) / 86_400_000
  const left = Math.ceil(HOLD_DAYS - daysElapsed)
  return left > 0 ? left : null
}
