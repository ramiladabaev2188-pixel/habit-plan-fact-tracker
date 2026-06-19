create table if not exists public.task_planning_rules (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  task_id uuid not null references public.tasks(id) on delete cascade,
  mode text not null check (mode in ('daily', 'weekdays', 'weekends', 'specific_weekdays', 'specific_dates', 'n_times_per_month', 'manual')),
  weekdays int[],
  specific_dates date[],
  times_per_month int check (times_per_month is null or times_per_month > 0),
  default_planned_value numeric not null default 1 check (
    default_planned_value >= 0 and default_planned_value <= 2 and default_planned_value * 4 = floor(default_planned_value * 4)
  ),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, task_id)
);

create table if not exists public.daily_notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  month_id uuid not null references public.months(id) on delete cascade,
  date date not null,
  content text not null default '',
  mood text,
  energy int check (energy is null or energy between 1 and 5),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, date)
);

create index if not exists task_planning_rules_user_task_idx on public.task_planning_rules(user_id, task_id);
create index if not exists daily_notes_user_date_idx on public.daily_notes(user_id, date);
create index if not exists daily_notes_month_date_idx on public.daily_notes(month_id, date);

drop trigger if exists task_planning_rules_touch_updated_at on public.task_planning_rules;
create trigger task_planning_rules_touch_updated_at
before update on public.task_planning_rules
for each row execute function public.touch_updated_at();

drop trigger if exists daily_notes_touch_updated_at on public.daily_notes;
create trigger daily_notes_touch_updated_at
before update on public.daily_notes
for each row execute function public.touch_updated_at();

create or replace function public.prevent_closed_daily_note_changes()
returns trigger
language plpgsql
as $$
declare
  checked_month_id uuid;
begin
  if tg_op = 'DELETE' then
    checked_month_id := old.month_id;
  else
    checked_month_id := new.month_id;
  end if;

  if exists (
    select 1 from public.months
    where id = checked_month_id and status = 'closed'
  ) then
    raise exception 'Закрытый месяц нельзя редактировать. Сначала разблокируйте месяц.';
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;

  return new;
end;
$$;

drop trigger if exists daily_notes_prevent_closed_changes on public.daily_notes;
create trigger daily_notes_prevent_closed_changes
before insert or update or delete on public.daily_notes
for each row execute function public.prevent_closed_daily_note_changes();

drop trigger if exists task_planning_rules_change_log on public.task_planning_rules;
create trigger task_planning_rules_change_log
after insert or update or delete on public.task_planning_rules
for each row execute function public.log_row_change();

drop trigger if exists daily_notes_change_log on public.daily_notes;
create trigger daily_notes_change_log
after insert or update or delete on public.daily_notes
for each row execute function public.log_row_change();

alter table public.task_planning_rules enable row level security;
alter table public.daily_notes enable row level security;

drop policy if exists "task_planning_rules_own_all" on public.task_planning_rules;
create policy "task_planning_rules_own_all"
on public.task_planning_rules for all
using (user_id = auth.uid())
with check (
  user_id = auth.uid()
  and exists (
    select 1 from public.tasks t
    where t.id = task_id and t.user_id = auth.uid()
  )
);

drop policy if exists "daily_notes_own_all" on public.daily_notes;
create policy "daily_notes_own_all"
on public.daily_notes for all
using (user_id = auth.uid())
with check (
  user_id = auth.uid()
  and exists (
    select 1 from public.months m
    where m.id = month_id and m.user_id = auth.uid()
  )
);
