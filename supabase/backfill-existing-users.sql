-- Optional one-time repair for completed users created before app data tables existed.
-- Safe to rerun: it only inserts missing active setup rows.

create or replace function pg_temp.saver_safe_numeric(value text)
returns numeric
language sql
immutable
as $$
  select
    case
      when coalesce(value, '') ~ '^[0-9]+(\.[0-9]+)?$' then value::numeric
      else 0
    end;
$$;

with profile_numbers as (
  select
    id as user_id,
    onboarding_data as data,
    onboarding_data ->> 'mode' as money_mode,
    pg_temp.saver_safe_numeric(onboarding_data ->> 'totalMoney') as total_money,
    pg_temp.saver_safe_numeric(onboarding_data ->> 'salary') as salary,
    pg_temp.saver_safe_numeric(onboarding_data ->> 'allowanceAmount') as allowance_amount,
    pg_temp.saver_safe_numeric(onboarding_data ->> 'avgIncome') as avg_income,
    pg_temp.saver_safe_numeric(onboarding_data ->> 'fixedExpenses') as fixed_expenses_raw,
    pg_temp.saver_safe_numeric(onboarding_data ->> 'saveAmount') as save_amount,
    pg_temp.saver_safe_numeric(onboarding_data ->> 'goalPrice') as goal_price,
    greatest(pg_temp.saver_safe_numeric(onboarding_data ->> 'cycleLength'), 1) as cycle_length,
    greatest(pg_temp.saver_safe_numeric(onboarding_data ->> 'payDay'), 1) as pay_day
  from public.profiles
  where onboarding_completed is true
    and onboarding_data ->> 'mode' in ('fixed', 'irregular', 'allowance')
),
base_setup as (
  select
    *,
    case
      when money_mode = 'fixed' then coalesce(nullif(salary, 0), total_money)
      when money_mode = 'allowance' then coalesce(nullif(allowance_amount, 0), total_money)
      when money_mode = 'irregular' then coalesce(nullif(avg_income, 0), total_money)
      else total_money
    end as base_money,
    case
      when money_mode = 'fixed' then coalesce(nullif(salary, 0), total_money)
      when money_mode = 'allowance' then coalesce(nullif(allowance_amount, 0), total_money)
      when money_mode = 'irregular' then coalesce(nullif(avg_income, 0), total_money)
      else 0
    end as income_amount,
    case
      when money_mode = 'fixed' then fixed_expenses_raw
      else 0
    end as fixed_expenses,
    case
      when money_mode = 'allowance' then 0.2
      else 0.3
    end as smart_percent
  from profile_numbers
),
saving_setup as (
  select
    *,
    case
      when data ->> 'saveMode' = 'smart' then round(base_money * smart_percent)
      else save_amount
    end as saving_target
  from base_setup
  where base_money > 0
),
snapshot as (
  select
    *,
    greatest(base_money - fixed_expenses - saving_target, 0) as free_to_spend,
    round(greatest(base_money - fixed_expenses - saving_target, 0) / cycle_length) as daily_limit
  from saving_setup
),
budget_insert as (
  insert into public.budget_cycles (
    user_id,
    money_mode,
    currency,
    cycle_start,
    cycle_end,
    starting_balance,
    income_amount,
    fixed_expenses_amount,
    saving_target_amount,
    free_to_spend_amount,
    daily_limit_amount,
    is_active,
    settings
  )
  select
    user_id,
    money_mode,
    'INR',
    current_date,
    current_date + (cycle_length::int - 1),
    base_money,
    income_amount,
    fixed_expenses,
    saving_target,
    free_to_spend,
    daily_limit,
    true,
    jsonb_build_object(
      'saveMode', coalesce(data ->> 'saveMode', ''),
      'payDay', pay_day,
      'cycleLength', cycle_length,
      'allowanceFrequency', coalesce(data ->> 'allowanceFrequency', 'monthly'),
      'setupSource', 'sql_backfill',
      'onboardingState', data
    )
  from snapshot
  where not exists (
    select 1
    from public.budget_cycles existing
    where existing.user_id = snapshot.user_id
      and existing.is_active is true
  )
  returning user_id
),
goal_insert as (
  insert into public.savings_goals (
    user_id,
    goal_type,
    title,
    target_amount,
    saved_amount,
    is_active,
    metadata
  )
  select
    user_id,
    case
      when data ->> 'goalType' = 'specific' then 'specific'
      when data ->> 'goalType' = 'safety' then 'safety'
      else 'custom'
    end,
    case
      when data ->> 'goalType' = 'specific' then coalesce(nullif(data ->> 'goalItem', ''), 'Saving goal')
      else 'Safety Buffer'
    end,
    case
      when data ->> 'goalType' = 'specific' then coalesce(nullif(goal_price, 0), greatest(saving_target * 3, 5000))
      else greatest(saving_target * 3, 5000)
    end,
    saving_target,
    true,
    jsonb_build_object(
      'saveMode', coalesce(data ->> 'saveMode', ''),
      'cycleSavingAmount', saving_target,
      'setupSource', 'sql_backfill'
    )
  from snapshot
  where not exists (
    select 1
    from public.savings_goals existing
    where existing.user_id = snapshot.user_id
      and existing.is_active is true
  )
  returning user_id
)
select
  (select count(*) from budget_insert) as budget_cycles_created,
  (select count(*) from goal_insert) as savings_goals_created;
