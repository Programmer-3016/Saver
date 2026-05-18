-- Saver Supabase schema
-- Run this in Supabase SQL Editor before testing onboarding on production.

create schema if not exists private;
create schema if not exists extensions;
create extension if not exists pgcrypto with schema extensions;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  full_name text,
  onboarding_completed boolean not null default false,
  onboarding_data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

grant usage on schema public to anon, authenticated, service_role;
grant select, insert, update on table public.profiles to authenticated;
grant select, insert, update, delete on table public.profiles to service_role;

alter table public.profiles enable row level security;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own"
on public.profiles
for select
to authenticated
using ((select auth.uid()) = id);

drop policy if exists "profiles_insert_own" on public.profiles;
create policy "profiles_insert_own"
on public.profiles
for insert
to authenticated
with check ((select auth.uid()) = id);

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own"
on public.profiles
for update
to authenticated
using ((select auth.uid()) = id)
with check ((select auth.uid()) = id);

create or replace function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public, auth, private
as $$
begin
  insert into public.profiles (id, email, full_name)
  values (
    new.id,
    new.email,
    coalesce(
      new.raw_user_meta_data ->> 'full_name',
      new.raw_user_meta_data ->> 'name',
      new.raw_user_meta_data ->> 'display_name'
    )
  )
  on conflict (id) do update
  set
    email = excluded.email,
    full_name = coalesce(public.profiles.full_name, excluded.full_name);

  return new;
end;
$$;

revoke execute on function private.handle_new_user() from public;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function private.handle_new_user();

insert into public.profiles (id, email, full_name)
select
  id,
  email,
  coalesce(
    raw_user_meta_data ->> 'full_name',
    raw_user_meta_data ->> 'name',
    raw_user_meta_data ->> 'display_name'
  )
from auth.users
on conflict (id) do update
set
  email = excluded.email,
  full_name = coalesce(public.profiles.full_name, excluded.full_name);

-- App data tables

create table if not exists public.budget_cycles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  money_mode text not null check (money_mode in ('fixed', 'irregular', 'allowance')),
  currency text not null default 'INR',
  cycle_start date not null default current_date,
  cycle_end date,
  starting_balance numeric(12, 2) not null default 0 check (starting_balance >= 0),
  income_amount numeric(12, 2) not null default 0 check (income_amount >= 0),
  fixed_expenses_amount numeric(12, 2) not null default 0 check (fixed_expenses_amount >= 0),
  saving_target_amount numeric(12, 2) not null default 0 check (saving_target_amount >= 0),
  free_to_spend_amount numeric(12, 2) not null default 0 check (free_to_spend_amount >= 0),
  daily_limit_amount numeric(12, 2) not null default 0 check (daily_limit_amount >= 0),
  is_active boolean not null default true,
  settings jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (cycle_end is null or cycle_end >= cycle_start)
);

create table if not exists public.transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  budget_cycle_id uuid references public.budget_cycles(id) on delete set null,
  kind text not null default 'expense' check (kind in ('expense', 'income')),
  amount numeric(12, 2) not null check (amount > 0),
  category text not null default 'other',
  description text,
  payment_source text not null default 'savings',
  occurred_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.savings_goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  goal_type text not null check (goal_type in ('specific', 'safety', 'custom')),
  title text not null,
  target_amount numeric(12, 2) not null default 0 check (target_amount >= 0),
  saved_amount numeric(12, 2) not null default 0 check (saved_amount >= 0),
  target_date date,
  is_active boolean not null default true,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

grant select, insert, update, delete on table public.budget_cycles to authenticated;
grant select, insert, update, delete on table public.transactions to authenticated;
grant select, insert, update, delete on table public.savings_goals to authenticated;

grant select, insert, update, delete on table public.budget_cycles to service_role;
grant select, insert, update, delete on table public.transactions to service_role;
grant select, insert, update, delete on table public.savings_goals to service_role;

alter table public.budget_cycles enable row level security;
alter table public.transactions enable row level security;
alter table public.savings_goals enable row level security;

create index if not exists budget_cycles_user_id_idx
on public.budget_cycles (user_id);

create unique index if not exists budget_cycles_one_active_per_user_idx
on public.budget_cycles (user_id)
where is_active;

create index if not exists transactions_user_id_occurred_at_idx
on public.transactions (user_id, occurred_at desc);

create index if not exists transactions_budget_cycle_id_idx
on public.transactions (budget_cycle_id);

create index if not exists transactions_user_id_category_idx
on public.transactions (user_id, category);

create index if not exists savings_goals_user_id_idx
on public.savings_goals (user_id);

create index if not exists savings_goals_user_id_active_idx
on public.savings_goals (user_id, is_active);

drop trigger if exists budget_cycles_set_updated_at on public.budget_cycles;
create trigger budget_cycles_set_updated_at
before update on public.budget_cycles
for each row execute function public.set_updated_at();

drop trigger if exists transactions_set_updated_at on public.transactions;
create trigger transactions_set_updated_at
before update on public.transactions
for each row execute function public.set_updated_at();

drop trigger if exists savings_goals_set_updated_at on public.savings_goals;
create trigger savings_goals_set_updated_at
before update on public.savings_goals
for each row execute function public.set_updated_at();

drop policy if exists "budget_cycles_select_own" on public.budget_cycles;
create policy "budget_cycles_select_own"
on public.budget_cycles
for select
to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists "budget_cycles_insert_own" on public.budget_cycles;
create policy "budget_cycles_insert_own"
on public.budget_cycles
for insert
to authenticated
with check ((select auth.uid()) = user_id);

drop policy if exists "budget_cycles_update_own" on public.budget_cycles;
create policy "budget_cycles_update_own"
on public.budget_cycles
for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

drop policy if exists "budget_cycles_delete_own" on public.budget_cycles;
create policy "budget_cycles_delete_own"
on public.budget_cycles
for delete
to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists "transactions_select_own" on public.transactions;
create policy "transactions_select_own"
on public.transactions
for select
to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists "transactions_insert_own" on public.transactions;
create policy "transactions_insert_own"
on public.transactions
for insert
to authenticated
with check (
  (select auth.uid()) = user_id
  and (
    budget_cycle_id is null
    or exists (
      select 1
      from public.budget_cycles
      where public.budget_cycles.id = budget_cycle_id
        and public.budget_cycles.user_id = (select auth.uid())
    )
  )
);

drop policy if exists "transactions_update_own" on public.transactions;
create policy "transactions_update_own"
on public.transactions
for update
to authenticated
using ((select auth.uid()) = user_id)
with check (
  (select auth.uid()) = user_id
  and (
    budget_cycle_id is null
    or exists (
      select 1
      from public.budget_cycles
      where public.budget_cycles.id = budget_cycle_id
        and public.budget_cycles.user_id = (select auth.uid())
    )
  )
);

drop policy if exists "transactions_delete_own" on public.transactions;
create policy "transactions_delete_own"
on public.transactions
for delete
to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists "savings_goals_select_own" on public.savings_goals;
create policy "savings_goals_select_own"
on public.savings_goals
for select
to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists "savings_goals_insert_own" on public.savings_goals;
create policy "savings_goals_insert_own"
on public.savings_goals
for insert
to authenticated
with check ((select auth.uid()) = user_id);

drop policy if exists "savings_goals_update_own" on public.savings_goals;
create policy "savings_goals_update_own"
on public.savings_goals
for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

drop policy if exists "savings_goals_delete_own" on public.savings_goals;
create policy "savings_goals_delete_own"
on public.savings_goals
for delete
to authenticated
using ((select auth.uid()) = user_id);
