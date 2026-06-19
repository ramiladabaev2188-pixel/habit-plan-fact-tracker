create table if not exists public.user_preferences (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  daily_reminder_enabled boolean not null default false,
  daily_reminder_time text not null default '21:00' check (daily_reminder_time ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'),
  risk_alerts_enabled boolean not null default true,
  theme text not null default 'system' check (theme in ('light', 'dark', 'system')),
  default_month_target numeric not null default 0.8 check (default_month_target > 0 and default_month_target <= 2),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id)
);

drop trigger if exists user_preferences_touch_updated_at on public.user_preferences;
create trigger user_preferences_touch_updated_at
before update on public.user_preferences
for each row execute function public.touch_updated_at();

drop trigger if exists user_preferences_change_log on public.user_preferences;
create trigger user_preferences_change_log
after insert or update or delete on public.user_preferences
for each row execute function public.log_row_change();

alter table public.user_preferences enable row level security;

drop policy if exists "user_preferences_own_all" on public.user_preferences;
create policy "user_preferences_own_all"
on public.user_preferences for all
using (user_id = auth.uid())
with check (user_id = auth.uid());

create index if not exists daily_plans_month_date_idx on public.daily_plans(month_id, date);
create index if not exists daily_plans_task_date_idx on public.daily_plans(task_id, date);
create index if not exists daily_facts_month_date_idx on public.daily_facts(month_id, date);
create index if not exists daily_facts_task_date_idx on public.daily_facts(task_id, date);
create index if not exists tasks_user_category_perf_idx on public.tasks(user_id, category_id);
create index if not exists months_user_year_month_perf_idx on public.months(user_id, year, month);
create index if not exists notes_user_date_idx on public.notes(user_id, date);
create index if not exists goals_user_status_idx on public.goals(user_id, status);
create index if not exists user_preferences_user_idx on public.user_preferences(user_id);
