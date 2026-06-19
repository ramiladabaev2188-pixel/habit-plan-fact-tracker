create table if not exists public.goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  description text,
  type text not null default 'monthly' check (type in ('long_term', 'monthly', 'weekly')),
  status text not null default 'active' check (status in ('active', 'completed', 'paused', 'archived')),
  priority text not null default 'medium' check (priority in ('low', 'medium', 'high')),
  start_date date,
  due_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.goal_tasks (
  id uuid primary key default gen_random_uuid(),
  goal_id uuid not null references public.goals(id) on delete cascade,
  task_id uuid not null references public.tasks(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (goal_id, task_id)
);

create table if not exists public.notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  month_id uuid references public.months(id) on delete set null,
  task_id uuid references public.tasks(id) on delete set null,
  goal_id uuid references public.goals(id) on delete set null,
  date date,
  title text,
  content text not null,
  tags text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists goals_user_status_idx on public.goals(user_id, status, type, priority);
create index if not exists goal_tasks_goal_idx on public.goal_tasks(goal_id);
create index if not exists goal_tasks_task_idx on public.goal_tasks(task_id);
create index if not exists notes_user_created_idx on public.notes(user_id, created_at desc);
create index if not exists notes_user_date_idx on public.notes(user_id, date);
create index if not exists notes_tags_idx on public.notes using gin(tags);

drop trigger if exists goals_touch_updated_at on public.goals;
create trigger goals_touch_updated_at
before update on public.goals
for each row execute function public.touch_updated_at();

drop trigger if exists notes_touch_updated_at on public.notes;
create trigger notes_touch_updated_at
before update on public.notes
for each row execute function public.touch_updated_at();

create or replace function public.prevent_closed_fact_changes()
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

drop trigger if exists daily_facts_prevent_closed_changes on public.daily_facts;
create trigger daily_facts_prevent_closed_changes
before insert or update or delete on public.daily_facts
for each row execute function public.prevent_closed_fact_changes();

drop trigger if exists goals_change_log on public.goals;
create trigger goals_change_log
after insert or update or delete on public.goals
for each row execute function public.log_row_change();

drop trigger if exists notes_change_log on public.notes;
create trigger notes_change_log
after insert or update or delete on public.notes
for each row execute function public.log_row_change();

alter table public.goals enable row level security;
alter table public.goal_tasks enable row level security;
alter table public.notes enable row level security;

drop policy if exists "goals_own_all" on public.goals;
create policy "goals_own_all"
on public.goals for all
using (user_id = auth.uid())
with check (user_id = auth.uid());

drop policy if exists "goal_tasks_own_all" on public.goal_tasks;
create policy "goal_tasks_own_all"
on public.goal_tasks for all
using (
  exists (
    select 1 from public.goals g
    where g.id = goal_id and g.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1 from public.goals g
    where g.id = goal_id and g.user_id = auth.uid()
  )
  and exists (
    select 1 from public.tasks t
    where t.id = task_id and t.user_id = auth.uid()
  )
);

drop policy if exists "notes_own_all" on public.notes;
create policy "notes_own_all"
on public.notes for all
using (user_id = auth.uid())
with check (
  user_id = auth.uid()
  and (
    month_id is null
    or exists (
      select 1 from public.months m
      where m.id = month_id and m.user_id = auth.uid()
    )
  )
  and (
    task_id is null
    or exists (
      select 1 from public.tasks t
      where t.id = task_id and t.user_id = auth.uid()
    )
  )
  and (
    goal_id is null
    or exists (
      select 1 from public.goals g
      where g.id = goal_id and g.user_id = auth.uid()
    )
  )
);
