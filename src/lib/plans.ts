import type { SubscriptionPlan } from './types'

// Keep these in sync with the server-side check in the
// `validate_subscription_payment` trigger (0020_subscription_plans.sql) —
// that trigger is the real source of truth; this is only for display and
// for building the Pix payment the client submits.
export const PLAN_PRICES: Record<SubscriptionPlan, number> = {
  monthly: 129.9,
  annual: 1247.04,
}

export const PLAN_LABELS: Record<SubscriptionPlan, string> = {
  monthly: 'Mensal',
  annual: 'Anual',
}

export const ANNUAL_DISCOUNT_PCT = 20

// What the annual package works out to per month, for the "compare to
// paying monthly" line under the annual plan card.
export const ANNUAL_MONTHLY_EQUIVALENT = PLAN_PRICES.annual / 12

// Subscribers see benefits suspended once their current cycle (30 days for
// monthly, 365 for annual) runs out without a renewal — this is how many
// days out from that expiration the dashboard starts showing a renewal
// countdown.
export const RENEWAL_WARNING_DAYS = 7
