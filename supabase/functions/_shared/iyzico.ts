// iyzico Checkout Form (hosted card page): Visa, Mastercard, Amex and Troy,
// credit or debit, with 3-D Secure handled by iyzico. No card data touches
// this app. Amounts are in the minor unit (kuruş / cents) of `currency`.
const LIVE = 'https://api.iyzipay.com';
const SANDBOX = 'https://sandbox-api.iyzipay.com';
const INIT_PATH = '/payment/iyzipos/checkoutform/initialize/auth/ecom';
const DETAIL_PATH = '/payment/iyzipos/checkoutform/auth/ecom/detail';

const base = () => (Deno.env.get('IYZICO_SANDBOX') === 'true' ? SANDBOX : LIVE);
export const iyzicoConfigured = (): boolean => !!Deno.env.get('IYZICO_API_KEY') && !!Deno.env.get('IYZICO_SECRET_KEY');
const value = (minor: number) => (minor / 100).toFixed(2);

const hex = (buf: ArrayBuffer) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');

/** IYZWSv2 request signing: HMAC-SHA256(secret, randomKey + path + body). */
async function call(path: string, payload: unknown) {
  const apiKey = Deno.env.get('IYZICO_API_KEY');
  const secret = Deno.env.get('IYZICO_SECRET_KEY');
  if (!apiKey || !secret) throw new Error('IYZICO_API_KEY / IYZICO_SECRET_KEY are not set');
  const body = JSON.stringify(payload);
  const randomKey = `${Date.now()}${crypto.randomUUID().replace(/-/g, '')}`;
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const signature = hex(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(randomKey + path + body)));
  const auth = btoa(`apiKey:${apiKey}&randomKey:${randomKey}&signature:${signature}`);
  const res = await fetch(base() + path, {
    method: 'POST',
    headers: { authorization: `IYZWSv2 ${auth}`, 'x-iyzi-rnd': randomKey, 'content-type': 'application/json', accept: 'application/json' },
    body,
  });
  return res.json();
}

/** Opens a checkout form and returns its token plus the hosted page to send the buyer to. */
export async function createCheckoutForm(opts: {
  minor: number;
  currency: 'TRY' | 'USD';
  description: string;
  plan: string;
  paymentId: string;
  callbackUrl: string;
  buyer: { id: string; email: string; ip: string };
}) {
  const price = value(opts.minor);
  // The app collects no postal address or national ID (it sells a digital
  // subscription), so the fields iyzico requires are filled with neutral values.
  const address = { contactName: opts.buyer.email, city: 'Istanbul', country: 'Turkey', address: 'Digital subscription' };
  const body = await call(INIT_PATH, {
    locale: opts.currency === 'TRY' ? 'tr' : 'en',
    conversationId: opts.paymentId,
    price,
    paidPrice: price,
    currency: opts.currency,
    basketId: opts.paymentId,
    paymentGroup: 'SUBSCRIPTION',
    callbackUrl: opts.callbackUrl,
    enabledInstallments: [1],
    buyer: {
      id: opts.buyer.id,
      name: opts.buyer.email.split('@')[0] || 'Fitora',
      surname: 'Fitora',
      email: opts.buyer.email,
      identityNumber: '11111111111',
      registrationAddress: address.address,
      city: address.city,
      country: address.country,
      ip: opts.buyer.ip,
    },
    billingAddress: address,
    basketItems: [{ id: opts.plan, name: opts.description, category1: 'Subscription', itemType: 'VIRTUAL', price }],
  });
  if (body?.status !== 'success' || !body.token || !body.paymentPageUrl) {
    throw new Error(`iyzico init failed: ${JSON.stringify(body)}`);
  }
  return { token: body.token as string, url: body.paymentPageUrl as string };
}

/** Asks iyzico what happened to a checkout form. Only a SUCCESS payment of the exact amount counts. */
export async function retrieveCheckoutForm(opts: { token: string; paymentId: string; minor: number; currency: string }) {
  const body = await call(DETAIL_PATH, { locale: 'en', conversationId: opts.paymentId, token: opts.token });
  const ok =
    body?.status === 'success' &&
    body?.paymentStatus === 'SUCCESS' &&
    body?.basketId === opts.paymentId &&
    body?.currency === opts.currency &&
    Math.round(Number(body?.paidPrice) * 100) === opts.minor;
  return { ok, refId: body?.paymentId ? String(body.paymentId) : null, raw: body };
}
