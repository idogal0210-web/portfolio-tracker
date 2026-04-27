-- ────────────────────────────────────────────────────────────────────────────
-- Portfolio Tracker — initial schema
-- profiles, holdings, transactions, budgets, recurring_templates
-- All tables are user-scoped via auth.uid() RLS policies.
-- ────────────────────────────────────────────────────────────────────────────

-- ── profiles ────────────────────────────────────────────────────────────────
create table if not exists public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  currency    text not null default 'USD' check (currency in ('USD', 'ILS')),
  created_at  timestamptz not null default now()
);

-- ── holdings ────────────────────────────────────────────────────────────────
create table if not exists public.holdings (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users(id) on delete cascade,
  symbol          text not null,
  shares          numeric not null check (shares > 0),
  purchase_price  numeric not null default 0,
  fees            numeric not null default 0,
  dividends       numeric not null default 0,
  purchase_date   date,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (user_id, symbol)
);

create index if not exists holdings_user_idx on public.holdings (user_id);

-- ── transactions ───────────────────────────────────────────────────────────
create table if not exists public.transactions (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  type          text not null check (type in ('INCOME', 'EXPENSE')),
  amount        numeric not null check (amount > 0),
  currency      text not null check (currency in ('USD', 'ILS')),
  category      text not null,
  note          text not null default '',
  date          date not null,
  recurring_template_id uuid,
  created_at    timestamptz not null default now()
);

create index if not exists transactions_user_date_idx
  on public.transactions (user_id, date desc);

-- ── budgets ────────────────────────────────────────────────────────────────
create table if not exists public.budgets (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  category    text not null,
  amount      numeric not null check (amount >= 0),
  currency    text not null check (currency in ('USD', 'ILS')),
  created_at  timestamptz not null default now(),
  unique (user_id, category)
);

-- ── recurring_templates ────────────────────────────────────────────────────
create table if not exists public.recurring_templates (
  id                       uuid primary key default gen_random_uuid(),
  user_id                  uuid not null references auth.users(id) on delete cascade,
  type                     text not null check (type in ('INCOME', 'EXPENSE')),
  amount                   numeric not null check (amount > 0),
  currency                 text not null check (currency in ('USD', 'ILS')),
  category                 text not null,
  note                     text not null default '',
  cadence                  text not null check (cadence in ('MONTHLY', 'YEARLY')),
  start_date               date not null,
  last_materialized_date   date,
  active                   boolean not null default true,
  created_at               timestamptz not null default now()
);

create index if not exists recurring_user_idx on public.recurring_templates (user_id);

-- ── RLS ────────────────────────────────────────────────────────────────────
alter table public.profiles            enable row level security;
alter table public.holdings            enable row level security;
alter table public.transactions        enable row level security;
alter table public.budgets             enable row level security;
alter table public.recurring_templates enable row level security;

-- profiles: a user can only see / modify their own row
create policy "profiles_self_select" on public.profiles for select
  using (id = auth.uid());
create policy "profiles_self_modify" on public.profiles for all
  using (id = auth.uid()) with check (id = auth.uid());

-- generic per-user CRUD on the other four tables
create policy "holdings_user_all" on public.holdings for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "transactions_user_all" on public.transactions for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "budgets_user_all" on public.budgets for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "recurring_user_all" on public.recurring_templates for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ── handle_new_user trigger: auto-create profile on signup ─────────────────
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, currency)
  values (new.id, 'USD')
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ── updated_at maintenance ─────────────────────────────────────────────────
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists holdings_set_updated_at on public.holdings;
create trigger holdings_set_updated_at
  before update on public.holdings
  for each row execute function public.set_updated_at();
