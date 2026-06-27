alter table public.daily_facts
  add column if not exists miss_reason text,
  add column if not exists miss_comment text;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'daily_facts_miss_reason_check'
  ) then
    alter table public.daily_facts
      add constraint daily_facts_miss_reason_check
      check (
        miss_reason is null
        or miss_reason in (
          'no_time',
          'low_energy',
          'forgot',
          'not_important',
          'overloaded_plan',
          'health',
          'other_priorities',
          'no_conditions',
          'other'
        )
      );
  end if;
end $$;

create table if not exists public.weekly_reviews (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  month_id uuid not null references public.months(id) on delete cascade,
  week_number int not null check (week_number between 1 and 5),
  start_date date not null,
  end_date date not null,
  worked_well text,
  didnt_work text,
  blockers text,
  repeat_next text,
  remove_next text,
  lesson text,
  next_week_focus text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id, month_id, week_number)
);

create table if not exists public.experiments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  hypothesis text,
  life_area_id uuid references public.life_areas(id) on delete set null,
  start_date date not null,
  end_date date not null,
  status text not null default 'draft' check (status in ('draft', 'active', 'completed', 'archived')),
  success_metric text,
  result_summary text,
  conclusion text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (end_date >= start_date)
);

create table if not exists public.experiment_checkins (
  id uuid primary key default gen_random_uuid(),
  experiment_id uuid not null references public.experiments(id) on delete cascade,
  date date not null,
  value numeric not null default 1 check (value >= 0),
  note text,
  created_at timestamptz not null default now(),
  unique(experiment_id, date)
);

create table if not exists public.life_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  life_area_id uuid references public.life_areas(id) on delete set null,
  goal_id uuid references public.goals(id) on delete set null,
  title text not null,
  description text,
  event_date date not null,
  type text not null default 'custom' check (
    type in (
      'achievement',
      'milestone',
      'decision',
      'failure',
      'recovery',
      'purchase',
      'health',
      'finance',
      'work',
      'family',
      'faith',
      'custom'
    )
  ),
  importance int not null default 3 check (importance between 1 and 5),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists weekly_reviews_touch_updated_at on public.weekly_reviews;
create trigger weekly_reviews_touch_updated_at
before update on public.weekly_reviews
for each row execute function public.touch_updated_at();

drop trigger if exists experiments_touch_updated_at on public.experiments;
create trigger experiments_touch_updated_at
before update on public.experiments
for each row execute function public.touch_updated_at();

drop trigger if exists life_events_touch_updated_at on public.life_events;
create trigger life_events_touch_updated_at
before update on public.life_events
for each row execute function public.touch_updated_at();

alter table public.weekly_reviews enable row level security;
alter table public.experiments enable row level security;
alter table public.experiment_checkins enable row level security;
alter table public.life_events enable row level security;

drop policy if exists "weekly_reviews_select_own" on public.weekly_reviews;
create policy "weekly_reviews_select_own"
on public.weekly_reviews for select
using (user_id = auth.uid());

drop policy if exists "weekly_reviews_insert_own" on public.weekly_reviews;
create policy "weekly_reviews_insert_own"
on public.weekly_reviews for insert
with check (
  user_id = auth.uid()
  and exists (
    select 1 from public.months m
    where m.id = month_id and m.user_id = auth.uid()
  )
);

drop policy if exists "weekly_reviews_update_own" on public.weekly_reviews;
create policy "weekly_reviews_update_own"
on public.weekly_reviews for update
using (user_id = auth.uid())
with check (
  user_id = auth.uid()
  and exists (
    select 1 from public.months m
    where m.id = month_id and m.user_id = auth.uid()
  )
);

drop policy if exists "weekly_reviews_delete_own" on public.weekly_reviews;
create policy "weekly_reviews_delete_own"
on public.weekly_reviews for delete
using (user_id = auth.uid());

drop policy if exists "experiments_select_own" on public.experiments;
create policy "experiments_select_own"
on public.experiments for select
using (user_id = auth.uid());

drop policy if exists "experiments_insert_own" on public.experiments;
create policy "experiments_insert_own"
on public.experiments for insert
with check (
  user_id = auth.uid()
  and (
    life_area_id is null
    or exists (
      select 1 from public.life_areas la
      where la.id = life_area_id and la.user_id = auth.uid()
    )
  )
);

drop policy if exists "experiments_update_own" on public.experiments;
create policy "experiments_update_own"
on public.experiments for update
using (user_id = auth.uid())
with check (
  user_id = auth.uid()
  and (
    life_area_id is null
    or exists (
      select 1 from public.life_areas la
      where la.id = life_area_id and la.user_id = auth.uid()
    )
  )
);

drop policy if exists "experiments_delete_own" on public.experiments;
create policy "experiments_delete_own"
on public.experiments for delete
using (user_id = auth.uid());

drop policy if exists "experiment_checkins_select_own" on public.experiment_checkins;
create policy "experiment_checkins_select_own"
on public.experiment_checkins for select
using (
  exists (
    select 1 from public.experiments e
    where e.id = experiment_id and e.user_id = auth.uid()
  )
);

drop policy if exists "experiment_checkins_insert_own" on public.experiment_checkins;
create policy "experiment_checkins_insert_own"
on public.experiment_checkins for insert
with check (
  exists (
    select 1 from public.experiments e
    where e.id = experiment_id and e.user_id = auth.uid()
  )
);

drop policy if exists "experiment_checkins_update_own" on public.experiment_checkins;
create policy "experiment_checkins_update_own"
on public.experiment_checkins for update
using (
  exists (
    select 1 from public.experiments e
    where e.id = experiment_id and e.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1 from public.experiments e
    where e.id = experiment_id and e.user_id = auth.uid()
  )
);

drop policy if exists "experiment_checkins_delete_own" on public.experiment_checkins;
create policy "experiment_checkins_delete_own"
on public.experiment_checkins for delete
using (
  exists (
    select 1 from public.experiments e
    where e.id = experiment_id and e.user_id = auth.uid()
  )
);

drop policy if exists "life_events_select_own" on public.life_events;
create policy "life_events_select_own"
on public.life_events for select
using (user_id = auth.uid());

drop policy if exists "life_events_insert_own" on public.life_events;
create policy "life_events_insert_own"
on public.life_events for insert
with check (
  user_id = auth.uid()
  and (
    life_area_id is null
    or exists (
      select 1 from public.life_areas la
      where la.id = life_area_id and la.user_id = auth.uid()
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

drop policy if exists "life_events_update_own" on public.life_events;
create policy "life_events_update_own"
on public.life_events for update
using (user_id = auth.uid())
with check (
  user_id = auth.uid()
  and (
    life_area_id is null
    or exists (
      select 1 from public.life_areas la
      where la.id = life_area_id and la.user_id = auth.uid()
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

drop policy if exists "life_events_delete_own" on public.life_events;
create policy "life_events_delete_own"
on public.life_events for delete
using (user_id = auth.uid());

create index if not exists daily_facts_miss_reason_idx on public.daily_facts(miss_reason);
create index if not exists weekly_reviews_user_month_week_idx on public.weekly_reviews(user_id, month_id, week_number);
create index if not exists experiments_user_status_idx on public.experiments(user_id, status);
create index if not exists experiments_life_area_idx on public.experiments(life_area_id);
create index if not exists experiment_checkins_experiment_date_idx on public.experiment_checkins(experiment_id, date);
create index if not exists life_events_user_date_idx on public.life_events(user_id, event_date desc);
create index if not exists life_events_life_area_date_idx on public.life_events(life_area_id, event_date desc);
