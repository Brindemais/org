// Mesma regra de available_balance/available_bonus_balance no banco:
// só bonus_subscription e adjustment ficam disponíveis na hora — todo o
// resto (bônus de indicação de parceiro, bônus de consumo, cashback,
// venda de produto recebida pelo parceiro) fica retido por 7 dias.
const HOLD_DAYS = 7

export function pendingDaysLeft(tx: { type: string; direction: string; created_at: string }): number | null {
  if (tx.direction !== 'in') return null
  if (tx.type === 'bonus_subscription' || tx.type === 'adjustment') return null
  const daysElapsed = (Date.now() - new Date(tx.created_at).getTime()) / 86_400_000
  const left = Math.ceil(HOLD_DAYS - daysElapsed)
  return left > 0 ? left : null
}
