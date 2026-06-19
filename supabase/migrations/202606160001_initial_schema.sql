create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  name text,
  timezone text not null default 'Asia/Yekaterinburg',
  created_at timestamptz not null default now()
);

create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  name text not null,
  color text not null default '#2563eb',
  sort_order int,
  created_at timestamptz not null default now(),
  unique (user_id, name)
);

create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  category_id uuid references public.categories(id) on delete set null,
  title text not null,
  description text,
  weight numeric not null check (weight > 0),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, title)
);

create table if not exists public.months (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  year int not null check (year between 2020 and 2100),
  month int not null check (month between 1 and 12),
  title text not null,
  status text not null default 'draft' check (status in ('draft', 'approved', 'closed')),
  target_percent numeric not null default 0.8 check (target_percent > 0),
  approved_at timestamptz,
  closed_at timestamptz,
  created_at timestamptz not null default now(),
  unique (user_id, year, month)
);

create table if not exists public.daily_plans (
  id uuid primary key default gen_random_uuid(),
  month_id uuid not null references public.months(id) on delete cascade,
  task_id uuid not null references public.tasks(id) on delete cascade,
  date date not null,
  planned_value numeric not null default 0 check (
    planned_value >= 0 and planned_value <= 2 and planned_value * 4 = floor(planned_value * 4)
  ),
  planned_score numeric not null default 0,
  locked boolean not null default false,
  created_at timestamptz not null default now(),
  unique (month_id, task_id, date)
);

create table if not exists public.daily_facts (
  id uuid primary key default gen_random_uuid(),
  month_id uuid not null references public.months(id) on delete cascade,
  task_id uuid not null references public.tasks(id) on delete cascade,
  date date not null,
  actual_value numeric not null default 0 check (
    actual_value >= 0 and actual_value <= 2 and actual_value * 4 = floor(actual_value * 4)
  ),
  actual_score numeric not null default 0,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (month_id, task_id, date)
);

create table if not exists public.change_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  entity_type text not null,
  entity_id uuid,
  action text not null,
  before_json jsonb,
  after_json jsonb,
  created_at timestamptz not null default now()
);

create index if not exists categories_user_sort_idx on public.categories(user_id, sort_order, name);
create index if not exists tasks_user_category_idx on public.tasks(user_id, category_id, is_active);
create index if not exists months_user_date_idx on public.months(user_id, year desc, month desc);
create index if not exists daily_plans_month_date_idx on public.daily_plans(month_id, date);
create index if not exists daily_plans_task_date_idx on public.daily_plans(task_id, date);
create index if not exists daily_facts_month_date_idx on public.daily_facts(month_id, date);
create index if not exists daily_facts_task_date_idx on public.daily_facts(task_id, date);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'name', split_part(new.email, '@', 1))
  )
  on conflict (id) do update
  set email = excluded.email;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists tasks_touch_updated_at on public.tasks;
create trigger tasks_touch_updated_at
before update on public.tasks
for each row execute function public.touch_updated_at();

drop trigger if exists daily_facts_touch_updated_at on public.daily_facts;
create trigger daily_facts_touch_updated_at
before update on public.daily_facts
for each row execute function public.touch_updated_at();

create or replace function public.set_daily_plan_score()
returns trigger
language plpgsql
as $$
declare
  task_weight numeric;
begin
  select weight into task_weight from public.tasks where id = new.task_id;

  if task_weight is null then
    raise exception 'Task % not found', new.task_id;
  end if;

  new.planned_score = new.planned_value * task_weight;

  if exists (
    select 1 from public.months m
    where m.id = new.month_id and m.status in ('approved', 'closed')
  ) then
    new.locked = true;
  end if;

  return new;
end;
$$;

drop trigger if exists daily_plans_set_score on public.daily_plans;
create trigger daily_plans_set_score
before insert or update on public.daily_plans
for each row execute function public.set_daily_plan_score();

create or replace function public.set_daily_fact_score()
returns trigger
language plpgsql
as $$
declare
  task_weight numeric;
begin
  select weight into task_weight from public.tasks where id = new.task_id;

  if task_weight is null then
    raise exception 'Task % not found', new.task_id;
  end if;

  new.actual_score = new.actual_value * task_weight;
  return new;
end;
$$;

drop trigger if exists daily_facts_set_score on public.daily_facts;
create trigger daily_facts_set_score
before insert or update on public.daily_facts
for each row execute function public.set_daily_fact_score();

create or replace function public.prevent_locked_plan_decrease()
returns trigger
language plpgsql
as $$
declare
  month_is_locked boolean;
begin
  if tg_op = 'DELETE' then
    select status in ('approved', 'closed') into month_is_locked
    from public.months where id = old.month_id;

    if old.locked or month_is_locked then
      raise exception 'Утвержденный план нельзя удалять';
    end if;

    return old;
  end if;

  select status in ('approved', 'closed') into month_is_locked
  from public.months where id = new.month_id;

  if (old.locked or month_is_locked) and new.planned_value < old.planned_value then
    raise exception 'После утверждения план нельзя уменьшать';
  end if;

  if old.locked or month_is_locked then
    new.locked = true;
  end if;

  return new;
end;
$$;

drop trigger if exists daily_plans_prevent_locked_decrease on public.daily_plans;
create trigger daily_plans_prevent_locked_decrease
before update or delete on public.daily_plans
for each row execute function public.prevent_locked_plan_decrease();

create or replace function public.handle_month_status_change()
returns trigger
language plpgsql
as $$
begin
  if new.status = 'approved' and old.status <> 'approved' then
    new.approved_at = coalesce(new.approved_at, now());
  end if;

  if new.status = 'closed' and old.status <> 'closed' then
    new.closed_at = coalesce(new.closed_at, now());
  end if;

  return new;
end;
$$;

drop trigger if exists months_status_timestamps on public.months;
create trigger months_status_timestamps
before update on public.months
for each row execute function public.handle_month_status_change();

create or replace function public.lock_month_plans()
returns trigger
language plpgsql
as $$
begin
  if new.status in ('approved', 'closed') and old.status <> new.status then
    update public.daily_plans
    set locked = true
    where month_id = new.id;
  end if;

  return new;
end;
$$;

drop trigger if exists months_lock_plans_after_approval on public.months;
create trigger months_lock_plans_after_approval
after update on public.months
for each row execute function public.lock_month_plans();

create or replace function public.log_row_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  owner_id uuid;
  changed_entity_id uuid;
begin
  if tg_op = 'DELETE' then
    owner_id := old.user_id;
    changed_entity_id := old.id;
  else
    owner_id := new.user_id;
    changed_entity_id := new.id;
  end if;

  insert into public.change_logs (
    user_id,
    entity_type,
    entity_id,
    action,
    before_json,
    after_json
  )
  values (
    owner_id,
    tg_table_name,
    changed_entity_id,
    tg_op,
    case when tg_op in ('UPDATE', 'DELETE') then to_jsonb(old) else null end,
    case when tg_op in ('INSERT', 'UPDATE') then to_jsonb(new) else null end
  );

  if tg_op = 'DELETE' then
    return old;
  end if;

  return new;
end;
$$;

drop trigger if exists categories_change_log on public.categories;
create trigger categories_change_log
after insert or update or delete on public.categories
for each row execute function public.log_row_change();

drop trigger if exists tasks_change_log on public.tasks;
create trigger tasks_change_log
after insert or update or delete on public.tasks
for each row execute function public.log_row_change();

drop trigger if exists months_change_log on public.months;
create trigger months_change_log
after insert or update or delete on public.months
for each row execute function public.log_row_change();

alter table public.profiles enable row level security;
alter table public.categories enable row level security;
alter table public.tasks enable row level security;
alter table public.months enable row level security;
alter table public.daily_plans enable row level security;
alter table public.daily_facts enable row level security;
alter table public.change_logs enable row level security;

drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own"
on public.profiles for select
using (id = auth.uid());

drop policy if exists "profiles_insert_own" on public.profiles;
create policy "profiles_insert_own"
on public.profiles for insert
with check (id = auth.uid());

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own"
on public.profiles for update
using (id = auth.uid())
with check (id = auth.uid());

drop policy if exists "categories_own_all" on public.categories;
create policy "categories_own_all"
on public.categories for all
using (user_id = auth.uid())
with check (user_id = auth.uid());

drop policy if exists "tasks_own_all" on public.tasks;
create policy "tasks_own_all"
on public.tasks for all
using (user_id = auth.uid())
with check (
  user_id = auth.uid()
  and (
    category_id is null
    or exists (
      select 1 from public.categories c
      where c.id = category_id and c.user_id = auth.uid()
    )
  )
);

drop policy if exists "months_own_all" on public.months;
create policy "months_own_all"
on public.months for all
using (user_id = auth.uid())
with check (user_id = auth.uid());

drop policy if exists "daily_plans_own_all" on public.daily_plans;
create policy "daily_plans_own_all"
on public.daily_plans for all
using (
  exists (
    select 1 from public.months m
    where m.id = month_id and m.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1 from public.months m
    where m.id = month_id and m.user_id = auth.uid()
  )
  and exists (
    select 1 from public.tasks t
    where t.id = task_id and t.user_id = auth.uid()
  )
);

drop policy if exists "daily_facts_own_all" on public.daily_facts;
create policy "daily_facts_own_all"
on public.daily_facts for all
using (
  exists (
    select 1 from public.months m
    where m.id = month_id and m.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1 from public.months m
    where m.id = month_id and m.user_id = auth.uid()
  )
  and exists (
    select 1 from public.tasks t
    where t.id = task_id and t.user_id = auth.uid()
  )
);

drop policy if exists "change_logs_own_select" on public.change_logs;
create policy "change_logs_own_select"
on public.change_logs for select
using (user_id = auth.uid());

create or replace function public.seed_demo_data_for_current_user()
returns void
language plpgsql
security invoker
as $$
declare
  current_user_id uuid := auth.uid();
  selected_month_id uuid;
  task_record record;
  day_record record;
  body_id uuid;
  spirit_id uuid;
  relation_id uuid;
  finance_id uuid;
begin
  if current_user_id is null then
    raise exception 'Требуется авторизация';
  end if;

  insert into public.profiles (id, email, name)
  values (
    current_user_id,
    auth.jwt() ->> 'email',
    coalesce(auth.jwt() -> 'user_metadata' ->> 'name', 'Демо пользователь')
  )
  on conflict (id) do nothing;

  insert into public.categories (user_id, name, color, sort_order)
  values
    (current_user_id, 'Тело', '#16a34a', 10),
    (current_user_id, 'Дух', '#7c3aed', 20),
    (current_user_id, 'Отношения', '#f97316', 30),
    (current_user_id, 'Финансы', '#2563eb', 40)
  on conflict (user_id, name) do update
  set color = excluded.color,
      sort_order = excluded.sort_order;

  select id into body_id from public.categories where user_id = current_user_id and name = 'Тело';
  select id into spirit_id from public.categories where user_id = current_user_id and name = 'Дух';
  select id into relation_id from public.categories where user_id = current_user_id and name = 'Отношения';
  select id into finance_id from public.categories where user_id = current_user_id and name = 'Финансы';

  insert into public.tasks (user_id, category_id, title, weight)
  values
    (current_user_id, body_id, 'Подъем в 9 утра', 1),
    (current_user_id, body_id, 'Упражнения на спину и колени', 3),
    (current_user_id, body_id, 'Контрастный душ', 1),
    (current_user_id, body_id, 'Отслеживание питания', 1),
    (current_user_id, body_id, 'Зал', 1),
    (current_user_id, body_id, 'Прогулка, мин. 5 тыс. шагов', 3),
    (current_user_id, spirit_id, 'Намаз 5 раз в день', 3),
    (current_user_id, spirit_id, 'Слушать Коран', 2),
    (current_user_id, spirit_id, 'Ходить на джума', 3),
    (current_user_id, spirit_id, 'Чтение мин. 10 стр / 1 глава', 1),
    (current_user_id, relation_id, 'Просмотр/чтение материала по нормам ислама', 1),
    (current_user_id, finance_id, 'Изучение вайбкодинга', 1),
    (current_user_id, finance_id, 'Занятие полезным делом', 1)
  on conflict (user_id, title) do update
  set category_id = excluded.category_id,
      weight = excluded.weight,
      is_active = true;

  insert into public.months (user_id, year, month, title, status, target_percent)
  values (
    current_user_id,
    extract(year from current_date)::int,
    extract(month from current_date)::int,
    to_char(current_date, 'TMMonth YYYY'),
    'draft',
    0.8
  )
  on conflict (user_id, year, month) do update
  set title = excluded.title
  returning id into selected_month_id;

  for task_record in
    select id, title from public.tasks where user_id = current_user_id and is_active = true
  loop
    for day_record in
      select generate_series(
        date_trunc('month', current_date)::date,
        (date_trunc('month', current_date) + interval '1 month - 1 day')::date,
        interval '1 day'
      )::date as date_value
    loop
      if task_record.title = 'Ходить на джума' and extract(dow from day_record.date_value) <> 5 then
        continue;
      end if;

      if task_record.title = 'Зал' and extract(dow from day_record.date_value) not in (1, 3, 5) then
        continue;
      end if;

      insert into public.daily_plans (month_id, task_id, date, planned_value)
      values (selected_month_id, task_record.id, day_record.date_value, 1)
      on conflict (month_id, task_id, date) do update
      set planned_value = greatest(public.daily_plans.planned_value, excluded.planned_value);

      if day_record.date_value <= current_date then
        insert into public.daily_facts (month_id, task_id, date, actual_value)
        values (
          selected_month_id,
          task_record.id,
          day_record.date_value,
          case
            when extract(day from day_record.date_value)::int % 7 = 0 then 0.5
            when extract(day from day_record.date_value)::int % 5 = 0 then 0.75
            when extract(day from day_record.date_value)::int % 4 = 0 then 1.25
            else 1
          end
        )
        on conflict (month_id, task_id, date) do nothing;
      end if;
    end loop;
  end loop;
end;
$$;
