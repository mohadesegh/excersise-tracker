// PayPal Orders API v2. The buyer pays on PayPal's own page, with a PayPal
// account or (where PayPal offers it) a debit / credit card as a guest, so no
// card data ever touches this app. Amounts are in CENTS of `currency`.
const LIVE = 'https://api-m.paypal.com';
const SANDBOX = 'https://api-m.sandbox.paypal.com';

const base = () => (Deno.env.get('PAYPAL_SANDBOX') === 'true' ? SANDBOX : LIVE);
export const paypalConfigured = (): boolean => !!Deno.env.get('PAYPAL_CLIENT_ID') && !!Deno.env.get('PAYPAL_SECRET');
const value = (cents: number) => (cents / 100).toFixed(2);

async function accessToken(): Promise<string> {
  const id = Deno.env.get('PAYPAL_CLIENT_ID');
  const secret = Deno.env.get('PAYPAL_SECRET');
  if (!id || !secret) throw new Error('PAYPAL_CLIENT_ID / PAYPAL_SECRET are not set');
  const res = await fetch(`${base()}/v1/oauth2/token`, {
    method: 'POST',
    headers: { authorization: `Basic ${btoa(`${id}:${secret}`)}`, 'content-type': 'application/x-www-form-urlencoded' },
    body: 'grant_type=client_credentials',
  });
  const body = await res.json();
  if (!res.ok || !body.access_token) throw new Error(`paypal auth failed: ${JSON.stringify(body)}`);
  return body.access_token as string;
}

/** Creates the order and returns its id plus the page to send the buyer to. */
export async function createOrder(opts: {
  cents: number;
  currency: string;
  description: string;
  paymentId: string;
  returnUrl: string;
  cancelUrl: string;
}) {
  const res = await fetch(`${base()}/v2/checkout/orders`, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${await accessToken()}`,
      'content-type': 'application/json',
      'PayPal-Request-Id': opts.paymentId, // retries never create a second order
    },
    body: JSON.stringify({
      intent: 'CAPTURE',
      purchase_units: [
        {
          reference_id: opts.paymentId,
          custom_id: opts.paymentId,
          description: opts.description,
          amount: { currency_code: opts.currency, value: value(opts.cents) },
        },
      ],
      payment_source: {
        paypal: {
          experience_context: {
            brand_name: 'Fitora',
            user_action: 'PAY_NOW',
            shipping_preference: 'NO_SHIPPING',
            landing_page: 'NO_PREFERENCE',
            return_url: opts.returnUrl,
            cancel_url: opts.cancelUrl,
          },
        },
      },
    }),
  });
  const body = await res.json();
  const url = (body?.links as { rel: string; href: string }[] | undefined)?.find(
    (l) => l.rel === 'payer-action' || l.rel === 'approve',
  )?.href;
  if (!res.ok || !body.id || !url) throw new Error(`paypal order failed: ${JSON.stringify(body)}`);
  return { orderId: body.id as string, url };
}

/** Takes the money for an approved order. Only a COMPLETED capture of the exact amount counts. */
export async function captureOrder(opts: { orderId: string; cents: number; currency: string }) {
  const res = await fetch(`${base()}/v2/checkout/orders/${encodeURIComponent(opts.orderId)}/capture`, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${await accessToken()}`,
      'content-type': 'application/json',
      'PayPal-Request-Id': `capture-${opts.orderId}`,
    },
  });
  const body = await res.json();
  const capture = body?.purchase_units?.[0]?.payments?.captures?.[0];
  const ok =
    res.ok &&
    body?.status === 'COMPLETED' &&
    capture?.status === 'COMPLETED' &&
    capture?.amount?.currency_code === opts.currency &&
    capture?.amount?.value === value(opts.cents);
  return { ok, refId: capture?.id ? String(capture.id) : null, raw: body };
}
