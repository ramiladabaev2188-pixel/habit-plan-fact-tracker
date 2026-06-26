create table if not exists public.life_areas (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  name text not null,
  color text not null default '#2563eb' check (color ~ '^#[0-9A-Fa-f]{6}$'),
  icon text,
  description text,
  is_active boolean not null default true,
  sort_order int default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id, name)
);

alter table public.categories
  add column if not exists life_area_id uuid references public.life_areas(id) on delete set null;

alter table public.goals
  add column if not exists life_area_id uuid references public.life_areas(id) on delete set null,
  add column if not exists why_text text,
  add column if not exists target_value numeric,
  add column if not exists current_value numeric,
  add column if not exists unit text,
  add column if not exists desired_identity text,
  add column if not exists progress_mode text not null default 'linked_tasks',
  add column if not exists completed_at timestamptz;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'goals_progress_mode_check'
      and conrelid = 'public.goals'::regclass
  ) then
    alter table public.goals
      add constraint goals_progress_mode_check
      check (progress_mode in ('linked_tasks', 'manual_value', 'mixed'));
  end if;
end $$;

create index if not exists life_areas_user_active_idx on public.life_areas(user_id, is_active, sort_order);
create index if not exists categories_life_area_idx on public.categories(life_area_id);
create index if not exists goals_life_area_idx on public.goals(life_area_id);
create index if not exists goals_user_progress_mode_idx on public.goals(user_id, progress_mode);

drop trigger if exists life_areas_touch_updated_at on public.life_areas;
create trigger life_areas_touch_updated_at
before update on public.life_areas
for each row execute function public.touch_updated_at();

alter table public.life_areas enable row level security;

drop policy if exists "life_areas_own_all" on public.life_areas;
create policy "life_areas_own_all"
on public.life_areas for all
using (user_id = auth.uid())
with check (user_id = auth.uid());

create or replace function public.ensure_category_life_area_owner()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.life_area_id is not null and not exists (
    select 1
    from public.life_areas la
    where la.id = new.life_area_id and la.user_id = new.user_id
  ) then
    raise exception 'Life area does not belong to this user';
  end if;

  return new;
end;
$$;

drop trigger if exists categories_life_area_owner_guard on public.categories;
create trigger categories_life_area_owner_guard
before insert or update of life_area_id, user_id on public.categories
for each row execute function public.ensure_category_life_area_owner();

create or replace function public.ensure_goal_life_area_owner()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.life_area_id is not null and not exists (
    select 1
    from public.life_areas la
    where la.id = new.life_area_id and la.user_id = new.user_id
  ) then
    raise exception 'Life area does not belong to this user';
  end if;

  return new;
end;
$$;

drop trigger if exists goals_life_area_owner_guard on public.goals;
create trigger goals_life_area_owner_guard
before insert or update of life_area_id, user_id on public.goals
for each row execute function public.ensure_goal_life_area_owner();

with defaults(name, color, icon, description, sort_order) as (
  values
    ('Здоровье', '#16a34a', 'heart-pulse', 'Тело, сон, питание, движение и базовая энергия.', 10),
    ('Дисциплина', '#2563eb', 'shield-check', 'Режим, регулярность, фокус и выполнение обещаний себе.', 20),
    ('Финансы', '#f97316', 'wallet', 'Доход, навыки монетизации, учет и финансовая устойчивость.', 30),
    ('Работа/карьера', '#0f766e', 'briefcase-business', 'Профессиональный рост, проекты и карьерная траектория.', 40),
    ('Обучение', '#7c3aed', 'book-open-check', 'Книги, курсы, практика и развитие мышления.', 50),
    ('Семья/отношения', '#db2777', 'users-round', 'Близость, коммуникация, вклад в семью и окружение.', 60),
    ('Вера/духовность', '#0891b2', 'sparkles', 'Внутренний стержень, поклонение, смыслы и духовная практика.', 70),
    ('Отдых/энергия', '#65a30d', 'battery-charging', 'Восстановление, паузы, настроение и ресурс.', 80)
)
insert into public.life_areas(user_id, name, color, icon, description, sort_order)
select p.id, d.name, d.color, d.icon, d.description, d.sort_order
from public.profiles p
cross join defaults d
on conflict (user_id, name) do nothing;

with area_map as (
  select user_id, name, id
  from public.life_areas
)
update public.categories c
set life_area_id = case
  when lower(c.name) in ('тело', 'здоровье') then (select id from area_map where user_id = c.user_id and name = 'Здоровье')
  when lower(c.name) in ('дух', 'вера', 'духовность') then (select id from area_map where user_id = c.user_id and name = 'Вера/духовность')
  when lower(c.name) in ('отношения', 'семья') then (select id from area_map where user_id = c.user_id and name = 'Семья/отношения')
  when lower(c.name) in ('финансы', 'деньги') then (select id from area_map where user_id = c.user_id and name = 'Финансы')
  else c.life_area_id
end
where c.life_area_id is null;
