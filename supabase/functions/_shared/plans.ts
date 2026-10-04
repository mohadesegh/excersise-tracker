// Prices live on the server so nobody can pay less by editing the app.
// Keep in sync with PRICES in src/payments.ts (which only displays them).
//  - toman: charged through ZarinPal (Iranian bank cards)
//  - tryKurus: charged through iyzico in Turkish lira (cards issued in Turkey)
//  - usdCents: charged through iyzico (foreign cards) or PayPal
export const PLANS: Record<
  string,
  { toman: number; tryKurus: number; usdCents: number; days: number; title: string; titleEn: string }
> = {
  monthly: { toman: 149_000, tryKurus: 14_900, usdCents: 499, days: 30, title: 'اشتراک ماهانه فیتورا', titleEn: 'Fitora monthly subscription' },
  yearly: { toman: 990_000, tryKurus: 99_900, usdCents: 3299, days: 365, title: 'اشتراک سالانه فیتورا', titleEn: 'Fitora yearly subscription' },
};

export const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
