// ZarinPal REST API v4. Amounts are in RIALS (1 toman = 10 rials).
const API = 'https://payment.zarinpal.com/pg/v4/payment';
const START = 'https://www.zarinpal.com/pg/StartPay/';
const SANDBOX_API = 'https://sandbox.zarinpal.com/pg/v4/payment';
const SANDBOX_START = 'https://sandbox.zarinpal.com/pg/StartPay/';

const sandbox = () => Deno.env.get('ZARINPAL_SANDBOX') === 'true';
const merchant = () => {
  const id = Deno.env.get('ZARINPAL_MERCHANT_ID');
  if (!id) throw new Error('ZARINPAL_MERCHANT_ID is not set');
  return id;
};

export async function requestPayment(opts: { amountRial: number; description: string; callbackUrl: string; email?: string }) {
  const res = await fetch(`${sandbox() ? SANDBOX_API : API}/request.json`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', accept: 'application/json' },
    body: JSON.stringify({
      merchant_id: merchant(),
      amount: opts.amountRial,
      description: opts.description,
      callback_url: opts.callbackUrl,
      metadata: opts.email ? { email: opts.email } : undefined,
    }),
  });
  const body = await res.json();
  if (body?.data?.code !== 100 || !body.data.authority) {
    throw new Error(`zarinpal request failed: ${JSON.stringify(body?.errors ?? body)}`);
  }
  return { authority: body.data.authority as string, url: (sandbox() ? SANDBOX_START : START) + body.data.authority };
}

/** code 100 = verified now, 101 = already verified earlier (still a success). */
export async function verifyPayment(opts: { amountRial: number; authority: string }) {
  const res = await fetch(`${sandbox() ? SANDBOX_API : API}/verify.json`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', accept: 'application/json' },
    body: JSON.stringify({ merchant_id: merchant(), amount: opts.amountRial, authority: opts.authority }),
  });
  const body = await res.json();
  const code = body?.data?.code;
  return { ok: code === 100 || code === 101, refId: body?.data?.ref_id ? String(body.data.ref_id) : null, raw: body };
}
