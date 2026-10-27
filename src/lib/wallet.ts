// Mesma regra de available_balance/available_bonus_balance no banco:
// - adjustment: sempre disponível na hora (ajuste manual do admin).
// - bonus_subscription e bonus_consumption: disponível na hora, EXCETO
//   quando o pagamento que gerou a bonificação foi no cartão — aí fica
//   retido 7 dias (dá tempo de a plataforma detectar estorno/chargeback
//   via webhook da Asaas antes de liberar pro saque). Pix e saldo interno
//   continuam imediatos.
// - bonus_partner_fee: retido 7 dias sempre, repasse toda segunda.
// - purchase (venda de produto recebida pelo parceiro): só retido quando
//   o assinante pagou com saldo interno — Pix, cartão e ativação manual já
//   são dinheiro confirmado, libera na hora.
// O método de pagamento original não vem na linha da carteira, mas já é
// gravado no texto da descrição (award_referral_bonuses /
// confirm_product_order_delivery lá no banco), daí os textos abaixo.
const HOLD_DAYS = 7

export function pendingDaysLeft(tx: { type: string; direction: string; created_at: string; description?: string | null }): number | null {
  if (tx.direction !== 'in') return null
  const description = tx.description ?? ''
  if (tx.type === 'adjustment') return null
  if ((tx.type === 'bonus_subscription' || tx.type === 'bonus_consumption') && !description.includes('(cartão)')) return null
  if (tx.type === 'purchase' && !description.includes('saldo interno')) return null
  const daysElapsed = (Date.now() - new Date(tx.created_at).getTime()) / 86_400_000
  const left = Math.ceil(HOLD_DAYS - daysElapsed)
  return left > 0 ? left : null
}
