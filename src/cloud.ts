/**
 * Accounts, sync and subscriptions on Supabase, using its REST API directly
 * (no SDK, to keep the app small).
 *
 *  - Sign-in: 6-digit code sent by email (Supabase email OTP).
 *  - Sync: the whole app state is one JSON row per user; merged on sign-in
 *    and pushed (debounced) after every change.
 *  - Subscription: read-only for the client; only the payment Edge Function
 *    can write it, after ZarinPal confirms the payment.
 */
import { CLOUD, cloudEnabled } from './config';
import { onSave, state } from './store';
import type { AppState, BillingPlan } from './types';

interface AuthSession {
  access_token: string;
  refresh_token: string;
  expires_at: number; // ms
  user: { id: string; email?: string };
}

const AUTH_KEY = 'varzideh:auth';
let session: AuthSession | null = readSession();
let pushTimer = 0;
let syncing = false;
const listeners = new Set<() => void>();

export type SyncStatus = 'off' | 'signed-out' | 'syncing' | 'synced' | 'error';
let status: SyncStatus = cloudEnabled() ? (session ? 'synced' : 'signed-out') : 'off';
export const syncStatus = (): SyncStatus => status;
export const signedInEmail = (): string | null => session?.user.email ?? null;
export const onCloudChange = (fn: () => void): (() => void) => {
  listeners.add(fn);
  return () => listeners.delete(fn);
};
const setStatus = (s: SyncStatus) => {
  status = s;
  listeners.forEach((f) => f());
};

function readSession(): AuthSession | null {
  try {
    const raw = localStorage.getItem(AUTH_KEY);
    return raw ? (JSON.parse(raw) as AuthSession) : null;
  } catch {
    return null;
  }
}
function writeSession(s: AuthSession | null) {
  session = s;
  try {
    if (s) localStorage.setItem(AUTH_KEY, JSON.stringify(s));
    else localStorage.removeItem(AUTH_KEY);
  } catch {
    /* storage blocked */
  }
}

const headers = (token?: string): HeadersInit => ({
  apikey: CLOUD.anonKey,
  'Content-Type': 'application/json',
  ...(token ? { Authorization: `Bearer ${token}` } : {}),
});

async function authCall(path: string, body: unknown): Promise<AuthSession> {
  const res = await fetch(`${CLOUD.url}/auth/v1/${path}`, { method: 'POST', headers: headers(), body: JSON.stringify(body) });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.msg || data.error_description || data.message || `auth ${res.status}`);
  return { ...data, expires_at: Date.now() + (data.expires_in ?? 3600) * 1000 } as AuthSession;
}

/** A valid access token, refreshing it when it's about to expire. */
async function token(): Promise<string | null> {
  if (!session) return null;
  if (session.expires_at - Date.now() > 60_000) return session.access_token;
  try {
    writeSession(await authCall('token?grant_type=refresh_token', { refresh_token: session.refresh_token }));
    return session!.access_token;
  } catch {
    writeSession(null);
    setStatus('signed-out');
    return null;
  }
}

/* ---------- sign-in ---------- */

export async function sendCode(email: string): Promise<void> {
  const res = await fetch(`${CLOUD.url}/auth/v1/otp`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify({ email, create_user: true }),
  });
  if (!res.ok) throw new Error(`otp ${res.status}`);
}

export async function verifyCode(email: string, code: string): Promise<void> {
  writeSession(await authCall('verify', { type: 'email', email, token: code }));
  await syncNow();
  await refreshSubscription();
}

export function signOut(): void {
  writeSession(null);
  setStatus('signed-out');
}

/* ---------- sync ---------- */

/** Combine two copies of the state without losing logged workouts or weigh-ins. */
export function merge(local: AppState, remote: AppState): AppState {
  const newer = (remote.updatedAt ?? 0) > (local.updatedAt ?? 0) ? remote : local;
  const sessions = new Map<number, AppState['sessions'][number]>();
  for (const s of [...remote.sessions, ...local.sessions]) sessions.set(s.ts, s);
  const weights = new Map<string, AppState['weights'][number]>();
  for (const w of [...(newer === local ? remote : local).weights, ...newer.weights]) weights.set(w.date, w);
  return {
    ...newer,
    sessions: [...sessions.values()].sort((a, b) => a.ts - b.ts),
    weights: [...weights.values()].sort((a, b) => a.date.localeCompare(b.date)),
    loads: { ...(newer === local ? remote : local).loads, ...newer.loads },
    // the subscription always comes from the server, never from a synced blob
    sub: local.sub,
    updatedAt: Math.max(local.updatedAt ?? 0, remote.updatedAt ?? 0),
  };
}

async function pull(t: string): Promise<AppState | null> {
  const res = await fetch(`${CLOUD.url}/rest/v1/user_state?select=data&user_id=eq.${session!.user.id}`, { headers: headers(t) });
  if (!res.ok) throw new Error(`pull ${res.status}`);
  const rows = (await res.json()) as { data: AppState }[];
  return rows[0]?.data ?? null;
}

async function push(t: string): Promise<void> {
  const { sub: _omit, ...data } = state;
  void _omit;
  const res = await fetch(`${CLOUD.url}/rest/v1/user_state`, {
    method: 'POST',
    headers: { ...headers(t), Prefer: 'resolution=merge-duplicates' },
    body: JSON.stringify({ user_id: session!.user.id, data, updated_at: new Date().toISOString() }),
  });
  if (!res.ok) throw new Error(`push ${res.status}`);
}

export async function syncNow(): Promise<void> {
  if (!cloudEnabled() || syncing) return;
  const t = await token();
  if (!t) return;
  syncing = true;
  setStatus('syncing');
  try {
    const remote = await pull(t);
    if (remote) Object.assign(state, merge(state, { ...remote, sub: null } as AppState));
    await push(t);
    setStatus('synced');
  } catch {
    setStatus('error');
  } finally {
    syncing = false;
  }
}

/* ---------- subscription & payments ---------- */

export async function refreshSubscription(): Promise<void> {
  const t = await token();
  if (!t) return;
  try {
    const res = await fetch(`${CLOUD.url}/rest/v1/subscriptions?select=plan,until&user_id=eq.${session!.user.id}`, { headers: headers(t) });
    const rows = (await res.json()) as { plan: BillingPlan; until: string }[];
    state.sub = rows[0] ? { plan: rows[0].plan, until: new Date(rows[0].until).getTime() } : state.sub && state.sub.plan === 'trial' ? state.sub : null;
  } catch {
    /* keep what we had */
  }
}

/** Ask the server for a ZarinPal payment link, then leave for the gateway. */
export async function startCheckout(
  plan: BillingPlan,
  provider: 'zarinpal' | 'iyzico' | 'paypal',
  currency: string,
): Promise<{ ok: boolean; error?: string }> {
  const t = await token();
  if (!t) return { ok: false, error: 'signin' };
  const res = await fetch(`${CLOUD.url}/functions/v1/checkout`, {
    method: 'POST',
    headers: headers(t),
    body: JSON.stringify({ plan, provider, currency, returnUrl: location.origin + location.pathname }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.url) return { ok: false, error: data.error ?? `checkout ${res.status}` };
  location.href = data.url;
  return { ok: true };
}

/** Wire sync into the app: push a few seconds after every local change. */
export function initCloud(): void {
  if (!cloudEnabled()) return;
  onSave(() => {
    if (!session) return;
    clearTimeout(pushTimer);
    pushTimer = window.setTimeout(() => void syncNow(), 2500);
  });
  window.addEventListener('online', () => void syncNow());
  if (session) {
    void syncNow();
    void refreshSubscription();
  }
}
