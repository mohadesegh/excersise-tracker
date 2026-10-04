/**
 * Cloud settings. Leave `url` empty to run fully offline (everything stays on
 * the device, payments are simulated). Fill these in after following
 * supabase/README.md to turn on accounts, sync and real payments.
 *
 * The anon key is meant to be public; security comes from the row-level
 * security policies in supabase/schema.sql. Never put the service-role key
 * or the ZarinPal merchant id here: those live only in the Edge Functions.
 */
export const CLOUD = {
  /** e.g. https://abcd1234.supabase.co */
  url: '',
  anonKey: '',
};

export const cloudEnabled = (): boolean => !!CLOUD.url && !!CLOUD.anonKey;

/**
 * Which payment page each language is sent to, and so which price it sees:
 *  - 'zarinpal': Iranian bank cards, priced in Toman
 *  - 'iyzico': credit / debit card page (Visa, Mastercard, Troy); Turkish lira
 *    in Turkish, US dollars in the other languages
 *  - 'paypal': PayPal, priced in USD (not available to merchants in Iran or Turkey)
 * A provider only works once its secrets are set on the server (supabase/README.md).
 */
export const PAY_PROVIDER: Record<'fa' | 'en' | 'tr', 'zarinpal' | 'iyzico' | 'paypal'> = {
  fa: 'zarinpal',
  en: 'iyzico',
  tr: 'iyzico',
};
