// POST /functions/v1/checkout  { plan: 'monthly' | 'yearly', provider?: 'zarinpal' | 'iyzico' | 'paypal', currency?: 'TRY' | 'USD', returnUrl }
// Requires the user's Supabase access token. Returns { url } to the payment page:
// ZarinPal (Iranian cards), iyzico (Visa / Mastercard / Troy card page) or PayPal.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { createCheckoutForm, iyzicoConfigured } from '../_shared/iyzico.ts';
import { cors, PLANS } from '../_shared/plans.ts';
import { createOrder, paypalConfigured } from '../_shared/paypal.ts';
import { requestPayment } from '../_shared/zarinpal.ts';

const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { ...cors, 'content-type': 'application/json' } });

  try {
    const jwt = req.headers.get('authorization')?.replace('Bearer ', '');
    const { data: { user } } = await admin.auth.getUser(jwt ?? '');
    if (!user) return json({ error: 'signin' }, 401);

    const { plan, returnUrl, provider = 'zarinpal', currency: asked } = await req.json();
    const p = PLANS[plan];
    if (!p) return json({ error: 'unknown plan' }, 400);
    if (!['zarinpal', 'iyzico', 'paypal'].includes(provider)) return json({ error: 'unknown provider' }, 400);
    if (provider === 'paypal' && !paypalConfigured()) return json({ error: 'provider not configured' }, 400);
    if (provider === 'iyzico' && !iyzicoConfigured()) return json({ error: 'provider not configured' }, 400);

    // only allow returning to your own app
    const allowed = (Deno.env.get('APP_URLS') ?? '').split(',').map((s) => s.trim()).filter(Boolean);
    if (!allowed.some((a) => String(returnUrl).startsWith(a))) return json({ error: 'return url not allowed' }, 400);

    const paypal = provider === 'paypal';
    const iyzico = provider === 'iyzico';
    const amountRial = p.toman * 10;
    // card payments: lira for Turkish cards, dollars otherwise; the amount always comes from PLANS
    const currency = iyzico ? (asked === 'USD' ? 'USD' : 'TRY') : paypal ? 'USD' : 'IRR';
    const minor = currency === 'TRY' ? p.tryKurus : p.usdCents;
    const { data: payment, error } = await admin
      .from('payments')
      .insert({
        user_id: user.id,
        plan,
        provider,
        amount_rial: paypal || iyzico ? null : amountRial,
        amount_cents: paypal || iyzico ? minor : null,
        currency,
        return_url: returnUrl,
      })
      .select('id')
      .single();
    if (error) throw error;

    const callbackUrl = `${Deno.env.get('SUPABASE_URL')}/functions/v1/verify?pid=${payment.id}`;
    let authority: string;
    let url: string;
    if (paypal) {
      const order = await createOrder({
        cents: p.usdCents,
        currency: 'USD',
        description: p.titleEn,
        paymentId: payment.id,
        returnUrl: callbackUrl,
        cancelUrl: `${callbackUrl}&cancel=1`,
      });
      authority = order.orderId;
      url = order.url;
    } else if (iyzico) {
      const form = await createCheckoutForm({
        minor,
        currency: currency as 'TRY' | 'USD',
        description: p.titleEn,
        plan,
        paymentId: payment.id,
        callbackUrl,
        buyer: {
          id: user.id,
          email: user.email ?? 'customer@example.com',
          ip: req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || '85.34.78.112',
        },
      });
      authority = form.token;
      url = form.url;
    } else {
      ({ authority, url } = await requestPayment({ amountRial, description: p.title, callbackUrl, email: user.email }));
    }
    await admin.from('payments').update({ authority }).eq('id', payment.id);

    return json({ url });
  } catch (e) {
    console.error(e);
    return json({ error: 'checkout failed' }, 500);
  }
});
