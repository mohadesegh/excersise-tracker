-- فیتورا: database schema. Run once in Supabase → SQL Editor.

-- 1. Each user's app state (plan, sessions, weights, loads) as one JSON document.
create table if not exists public.user_state (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  data       jsonb not null,
  updated_at timestamptz not null default now()
);
alter table public.user_state enable row level security;
create policy "own state: read"   on public.user_state for select using (auth.uid() = user_id);
create policy "own state: insert" on public.user_state for insert with check (auth.uid() = user_id);
create policy "own state: update" on public.user_state for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- 2. Subscriptions. Users can only READ their own row; only the payment
--    Edge Function (service role, which bypasses RLS) can write it.
create table if not exists public.subscriptions (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  plan       text not null check (plan in ('monthly', 'yearly')),
  until      timestamptz not null,
  updated_at timestamptz not null default now()
);
alter table public.subscriptions enable row level security;
create policy "own subscription: read" on public.subscriptions for select using (auth.uid() = user_id);

-- 3. Payment attempts, for verification and your own bookkeeping. No client access at all.
create table if not exists public.payments (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  plan        text not null,
  provider    text not null default 'zarinpal' check (provider in ('zarinpal', 'iyzico', 'paypal')),
  amount_rial bigint,            -- ZarinPal payments
  amount_cents integer,          -- iyzico / PayPal payments, in kuruş or cents of `currency`
  currency    text not null default 'IRR',
  authority   text unique,       -- ZarinPal authority, iyzico form token or PayPal order id
  status      text not null default 'pending' check (status in ('pending', 'paid', 'failed')),
  ref_id      text,
  return_url  text not null,
  created_at  timestamptz not null default now(),
  paid_at     timestamptz
);
alter table public.payments enable row level security;
-- (no policies: only the service role can touch this table)

-- Upgrading a database created before card payments were added? Run these once:
alter table public.payments add column if not exists provider text not null default 'zarinpal';
alter table public.payments add column if not exists amount_cents integer;
alter table public.payments add column if not exists currency text not null default 'IRR';
alter table public.payments alter column amount_rial drop not null;
alter table public.payments drop constraint if exists payments_provider_check;
alter table public.payments add constraint payments_provider_check check (provider in ('zarinpal', 'iyzico', 'paypal'));
