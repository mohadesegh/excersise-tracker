// GET or POST /functions/v1/verify?pid=…
//   ZarinPal adds  &Authority=…&Status=OK|NOK
//   PayPal adds    &token=<order id>&PayerID=…   (or &cancel=1 when the buyer backs out)
//   iyzico POSTs a form with  token=<checkout form token>
// The payment page sends the user's browser here. We confirm with the provider
// (never trusting the query string alone), extend the subscription, and send
// the user back to the app: #/pay?ok=1 or #/pay?ok=0.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { retrieveCheckoutForm } from '../_shared/iyzico.ts';
import { PLANS } from '../_shared/plans.ts';
import { captureOrder } from '../_shared/paypal.ts';
import { verifyPayment } from '../_shared/zarinpal.ts';

const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
const back = (returnUrl: string, ok: boolean) =>
  // 303: iyzico arrives with a POST, and the app must be opened with a GET
  new Response(null, { status: 303, headers: { location: `${returnUrl}#/pay?ok=${ok ? 1 : 0}` } });

Deno.serve(async (req) => {
  const q = new URL(req.url).searchParams;
  const pid = q.get('pid');

  const { data: pay } = await admin.from('payments').select('*').eq('id', pid).maybeSingle();
  const fallback = (Deno.env.get('APP_URLS') ?? '').split(',')[0]?.trim() || '/';
  const paypal = pay?.provider === 'paypal';
  const iyzico = pay?.provider === 'iyzico';
  let authority = paypal ? q.get('token') : q.get('Authority');
  if (iyzico && req.method === 'POST') {
    const form = await req.formData().catch(() => null);
    authority = form ? String(form.get('token') ?? '') : null;
  }
  if (!pay || !pay.authority || pay.authority !== authority) return back(fallback, false);
  if (pay.status === 'paid') return back(pay.return_url, true); // refresh / double callback

  const fail = async () => {
    await admin.from('payments').update({ status: 'failed' }).eq('id', pay.id);
    return back(pay.return_url, false);
  };

  if (paypal ? q.get('cancel') === '1' : !iyzico && q.get('Status') !== 'OK') return fail();

  const v = iyzico
    ? await retrieveCheckoutForm({ token: pay.authority, paymentId: pay.id, minor: pay.amount_cents, currency: pay.currency })
    : paypal
      ? await captureOrder({ orderId: pay.authority, cents: pay.amount_cents, currency: pay.currency })
      : await verifyPayment({ amountRial: pay.amount_rial, authority: pay.authority });
  if (!v.ok) {
    console.error('verify failed', v.raw);
    return fail();
  }

  // extend from the later of now / current end date
  const { data: sub } = await admin.from('subscriptions').select('until').eq('user_id', pay.user_id).maybeSingle();
  const from = Math.max(Date.now(), sub ? new Date(sub.until).getTime() : 0);
  const until = new Date(from + PLANS[pay.plan].days * 86_400_000).toISOString();

  await admin.from('subscriptions').upsert({ user_id: pay.user_id, plan: pay.plan, until, updated_at: new Date().toISOString() });
  await admin.from('payments').update({ status: 'paid', ref_id: v.refId, paid_at: new Date().toISOString() }).eq('id', pay.id);

  return back(pay.return_url, true);
});
