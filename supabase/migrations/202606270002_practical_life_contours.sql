create table if not exists public.finance_snapshots (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  date date not null,
  income numeric not null default 0 check (income >= 0),
  required_expenses numeric not null default 0 check (required_expenses >= 0),
  optional_expenses numeric not null default 0 check (optional_expenses >= 0),
  savings numeric not null default 0,
  debt_total numeric not null default 0 check (debt_total >= 0),
  investments numeric not null default 0 check (investments >= 0),
  comment text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id, date)
);

create table if not exists public.finance_goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  target_amount numeric not null check (target_amount > 0),
  current_amount numeric not null default 0 check (current_amount >= 0),
  due_date date,
  life_area_id uuid references public.life_areas(id) on delete set null,
  goal_id uuid references public.goals(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.health_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  date date not null,
  weight numeric check (weight is null or weight > 0),
  sleep_hours numeric check (sleep_hours is null or (sleep_hours >= 0 and sleep_hours <= 24)),
  energy int check (energy is null or energy between 1 and 5),
  mood text,
  pain_level int check (pain_level is null or pain_level between 0 and 10),
  workout_done boolean not null default false,
  steps int check (steps is null or steps >= 0),
  comment text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id, date)
);

create table if not exists public.cars (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  name text not null,
  brand text,
  model text,
  year int check (year is null or (year >= 1950 and year <= 2100)),
  current_mileage int not null default 0 check (current_mileage >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.car_service_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  car_id uuid not null references public.cars(id) on delete cascade,
  name text not null,
  system text not null check (
    system in (
      'engine',
      'transmission',
      'transfer_case',
      'front_diff',
      'rear_diff',
      'brakes',
      'spark_plugs',
      'filters',
      'antifreeze',
      'power_steering',
      'battery',
      'tires',
      'other'
    )
  ),
  last_service_date date,
  last_service_mileage int check (last_service_mileage is null or last_service_mileage >= 0),
  interval_months int check (interval_months is null or interval_months > 0),
  interval_km int check (interval_km is null or interval_km > 0),
  comment text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.car_service_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  car_id uuid not null references public.cars(id) on delete cascade,
  service_item_id uuid references public.car_service_items(id) on delete set null,
  service_date date not null,
  mileage int not null check (mileage >= 0),
  cost numeric not null default 0 check (cost >= 0),
  comment text,
  created_at timestamptz not null default now()
);

create table if not exists public.work_projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  description text,
  status text not null default 'active' check (status in ('active', 'paused', 'completed', 'archived')),
  start_date date,
  due_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.work_cases (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  problem text,
  actions text,
  result text,
  metrics_before text,
  metrics_after text,
  conclusion text,
  skills text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.work_skills (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  name text not null,
  level int not null default 1 check (level between 1 and 10),
  target_level int not null default 5 check (target_level between 1 and 10),
  comment text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id, name)
);

drop trigger if exists finance_snapshots_touch_updated_at on public.finance_snapshots;
create trigger finance_snapshots_touch_updated_at
before update on public.finance_snapshots
for each row execute function public.touch_updated_at();

drop trigger if exists finance_goals_touch_updated_at on public.finance_goals;
create trigger finance_goals_touch_updated_at
before update on public.finance_goals
for each row execute function public.touch_updated_at();

drop trigger if exists health_logs_touch_updated_at on public.health_logs;
create trigger health_logs_touch_updated_at
before update on public.health_logs
for each row execute function public.touch_updated_at();

drop trigger if exists cars_touch_updated_at on public.cars;
create trigger cars_touch_updated_at
before update on public.cars
for each row execute function public.touch_updated_at();

drop trigger if exists car_service_items_touch_updated_at on public.car_service_items;
create trigger car_service_items_touch_updated_at
before update on public.car_service_items
for each row execute function public.touch_updated_at();

drop trigger if exists work_projects_touch_updated_at on public.work_projects;
create trigger work_projects_touch_updated_at
before update on public.work_projects
for each row execute function public.touch_updated_at();

drop trigger if exists work_cases_touch_updated_at on public.work_cases;
create trigger work_cases_touch_updated_at
before update on public.work_cases
for each row execute function public.touch_updated_at();

drop trigger if exists work_skills_touch_updated_at on public.work_skills;
create trigger work_skills_touch_updated_at
before update on public.work_skills
for each row execute function public.touch_updated_at();

alter table public.finance_snapshots enable row level security;
alter table public.finance_goals enable row level security;
alter table public.health_logs enable row level security;
alter table public.cars enable row level security;
alter table public.car_service_items enable row level security;
alter table public.car_service_logs enable row level security;
alter table public.work_projects enable row level security;
alter table public.work_cases enable row level security;
alter table public.work_skills enable row level security;

drop policy if exists "finance_snapshots_own_all" on public.finance_snapshots;
create policy "finance_snapshots_own_all"
on public.finance_snapshots for all
using (user_id = auth.uid())
with check (user_id = auth.uid());

drop policy if exists "finance_goals_own_all" on public.finance_goals;
create policy "finance_goals_own_all"
on public.finance_goals for all
using (user_id = auth.uid())
with check (
  user_id = auth.uid()
  and (
    life_area_id is null
    or exists (select 1 from public.life_areas la where la.id = life_area_id and la.user_id = auth.uid())
  )
  and (
    goal_id is null
    or exists (select 1 from public.goals g where g.id = goal_id and g.user_id = auth.uid())
  )
);

drop policy if exists "health_logs_own_all" on public.health_logs;
create policy "health_logs_own_all"
on public.health_logs for all
using (user_id = auth.uid())
with check (user_id = auth.uid());

drop policy if exists "cars_own_all" on public.cars;
create policy "cars_own_all"
on public.cars for all
using (user_id = auth.uid())
with check (user_id = auth.uid());

drop policy if exists "car_service_items_own_all" on public.car_service_items;
create policy "car_service_items_own_all"
on public.car_service_items for all
using (user_id = auth.uid())
with check (
  user_id = auth.uid()
  and exists (select 1 from public.cars c where c.id = car_id and c.user_id = auth.uid())
);

drop policy if exists "car_service_logs_own_all" on public.car_service_logs;
create policy "car_service_logs_own_all"
on public.car_service_logs for all
using (user_id = auth.uid())
with check (
  user_id = auth.uid()
  and exists (select 1 from public.cars c where c.id = car_id and c.user_id = auth.uid())
  and (
    service_item_id is null
    or exists (
      select 1 from public.car_service_items i
      where i.id = service_item_id and i.user_id = auth.uid() and i.car_id = car_id
    )
  )
);

drop policy if exists "work_projects_own_all" on public.work_projects;
create policy "work_projects_own_all"
on public.work_projects for all
using (user_id = auth.uid())
with check (user_id = auth.uid());

drop policy if exists "work_cases_own_all" on public.work_cases;
create policy "work_cases_own_all"
on public.work_cases for all
using (user_id = auth.uid())
with check (user_id = auth.uid());

drop policy if exists "work_skills_own_all" on public.work_skills;
create policy "work_skills_own_all"
on public.work_skills for all
using (user_id = auth.uid())
with check (user_id = auth.uid());

create index if not exists finance_snapshots_user_date_idx on public.finance_snapshots(user_id, date desc);
create index if not exists finance_goals_user_due_idx on public.finance_goals(user_id, due_date);
create index if not exists health_logs_user_date_idx on public.health_logs(user_id, date desc);
create index if not exists cars_user_idx on public.cars(user_id);
create index if not exists car_service_items_car_idx on public.car_service_items(car_id);
create index if not exists car_service_logs_car_date_idx on public.car_service_logs(car_id, service_date desc);
create index if not exists work_projects_user_status_idx on public.work_projects(user_id, status);
create index if not exists work_cases_user_created_idx on public.work_cases(user_id, created_at desc);
create index if not exists work_skills_user_level_idx on public.work_skills(user_id, level);
