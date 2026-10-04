import { startCheckout } from './cloud';
import { cloudEnabled, PAY_PROVIDER } from './config';
import { getLocale } from './i18n';
import { update } from './store';
import type { BillingPlan } from './types';

export interface PriceOption {
  id: BillingPlan;
  title: string;
  /** Toman, charged through ZarinPal */
  price: number;
  /** Turkish lira, charged through iyzico (cards) */
  try: number;
  /** US dollars, charged through iyzico (foreign cards) or PayPal */
  usd: number;
  days: number;
  per: string;
  note?: string;
}

/** Edit prices and currency here (and in supabase/functions/_shared/plans.ts, which is what is actually charged). */
export const CURRENCY = 'تومان';
export const PRICES: PriceOption[] = [
  { id: 'monthly', title: 'ماهانه', price: 149_000, try: 149, usd: 4.99, days: 30, per: 'در ماه' },
  { id: 'yearly', title: 'سالانه', price: 990_000, try: 999, usd: 32.99, days: 365, per: 'در سال', note: '۴۵٪ ارزان‌تر' },
];
export const TRIAL_DAYS = 7;

export type PayProvider = 'zarinpal' | 'iyzico' | 'paypal';
export type PayCurrency = 'IRT' | 'TRY' | 'USD';
/** The payment page for the current language. */
export const payProvider = (): PayProvider => PAY_PROVIDER[getLocale()];
/** What the current language is charged in: Toman at ZarinPal, lira for Turkish card payments, dollars otherwise. */
export const payCurrency = (): PayCurrency =>
  payProvider() === 'zarinpal' ? 'IRT' : payProvider() === 'iyzico' && getLocale() === 'tr' ? 'TRY' : 'USD';

export interface CheckoutResult {
  ok: boolean;
  error?: string;
}

/**
 * Payments are verified on the server (supabase/functions). The flow:
 *   1. POST /functions/v1/checkout {plan, provider} → the server creates a
 *      transaction with ZarinPal (Iran), iyzico (credit / debit cards) or
 *      PayPal and returns its redirect URL.
 *   2. The gateway redirects back to /#/pay/callback?…; your server verifies
 *      the transaction and returns the subscription end date.
 * Never grant premium from the client alone in production.
 */
export interface PaymentProvider {
  checkout(plan: BillingPlan): Promise<CheckoutResult>;
}

export const mockProvider: PaymentProvider = {
  checkout: () => new Promise((res) => setTimeout(() => res({ ok: true }), 900)),
};

/** Real payments: the server creates the ZarinPal, iyzico or PayPal transaction and grants the subscription after verifying it. */
export const cloudProvider: PaymentProvider = { checkout: (plan) => startCheckout(plan, payProvider(), payCurrency()) };

export let provider: PaymentProvider = cloudEnabled() ? cloudProvider : mockProvider;
export const isRealPayments = (): boolean => provider === cloudProvider;
export const setProvider = (p: PaymentProvider): void => {
  provider = p;
};

export function grant(plan: BillingPlan): void {
  const days = plan === 'trial' ? TRIAL_DAYS : PRICES.find((p) => p.id === plan)!.days;
  update((s) => {
    const from = s.sub && s.sub.until > Date.now() ? s.sub.until : Date.now();
    s.sub = { plan, until: from + days * 86_400_000 };
    if (plan === 'trial') s.trialUsed = true;
  });
}
