// Mesma regra de available_balance/available_bonus_balance no banco:
// - adjustment: sempre disponível na hora (ajuste manual do admin).
// - bonus_subscription e bonus_consumption: disponível na hora só quando o
//   pagamento que gerou a bonificação foi via Pix (ou ativação manual do
//   admin) — pagamento no cartão OU com saldo interno ficam retidos 7
//   dias (dá tempo de a plataforma detectar estorno/chargeback via webhook
//   da Asaas, ou reversão do saldo de origem, antes de liberar pro saque).
// - bonus_partner_fee: retido 7 dias sempre, repasse toda segunda.
// - purchase (venda de produto recebida pelo parceiro): só retido quando
//   o assinante pagou com saldo interno — Pix, cartão e ativação manual já
//   são dinheiro confirmado, libera na hora. Regra separada, não mudou.
// O método de pagamento original não vem na linha da carteira, mas já é
// gravado no texto da descrição (award_referral_bonuses /
// confirm_product_order_delivery lá no banco), daí os textos abaixo.
const HOLD_DAYS = 7
const HELD_ORIGIN_SUFFIXES = ['(cartão)', '(saldo interno)']

export function pendingDaysLeft(tx: { type: string; direction: string; created_at: string; description?: string | null }): number | null {
  if (tx.direction !== 'in') return null
  const description = tx.description ?? ''
  if (tx.type === 'adjustment') return null
  if (
    (tx.type === 'bonus_subscription' || tx.type === 'bonus_consumption') &&
    !HELD_ORIGIN_SUFFIXES.some((suffix) => description.includes(suffix))
  ) return null
  if (tx.type === 'purchase' && !description.includes('saldo interno')) return null
  const daysElapsed = (Date.now() - new Date(tx.created_at).getTime()) / 86_400_000
  const left = Math.ceil(HOLD_DAYS - daysElapsed)
  return left > 0 ? left : null
}
