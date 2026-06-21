-- Independent team initiatives. They intentionally do not reference personal
-- tasks, plans or facts: a team goal is shared only when participants add a
-- separate contribution to it.

create table if not exists public.team_goals (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete cascade,
  created_by uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  description text,
  unit text not null default 'шагов',
  target_value numeric not null check (target_value > 0),
  status text not null default 'active' check (status in ('active', 'completed', 'archived')),
  start_date date,
  due_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.team_goal_contributions (
  id uuid primary key default gen_random_uuid(),
  goal_id uuid not null references public.team_goals(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  value numeric not null check (value > 0),
  note text,
  date date not null default current_date,
  created_at timestamptz not null default now()
);

create table if not exists public.team_challenges (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete cascade,
  created_by uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  description text,
  unit text not null default 'раз',
  target_value numeric not null check (target_value > 0),
  status text not null default 'active' check (status in ('draft', 'active', 'completed', 'archived')),
  start_date date,
  due_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.team_challenge_checkins (
  id uuid primary key default gen_random_uuid(),
  challenge_id uuid not null references public.team_challenges(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  value numeric not null check (value > 0),
  note text,
  date date not null default current_date,
  created_at timestamptz not null default now()
);

create index if not exists team_goals_team_status_idx on public.team_goals(team_id, status, due_date);
create index if not exists team_goal_contributions_goal_date_idx on public.team_goal_contributions(goal_id, date);
create index if not exists team_goal_contributions_user_date_idx on public.team_goal_contributions(user_id, date);
create index if not exists team_challenges_team_status_idx on public.team_challenges(team_id, status, due_date);
create index if not exists team_challenge_checkins_challenge_date_idx on public.team_challenge_checkins(challenge_id, date);
create index if not exists team_challenge_checkins_user_date_idx on public.team_challenge_checkins(user_id, date);

drop trigger if exists team_goals_touch_updated_at on public.team_goals;
create trigger team_goals_touch_updated_at
before update on public.team_goals
for each row execute function public.touch_updated_at();

drop trigger if exists team_challenges_touch_updated_at on public.team_challenges;
create trigger team_challenges_touch_updated_at
before update on public.team_challenges
for each row execute function public.touch_updated_at();

alter table public.team_goals enable row level security;
alter table public.team_goal_contributions enable row level security;
alter table public.team_challenges enable row level security;
alter table public.team_challenge_checkins enable row level security;

drop policy if exists "team_goals_select_member" on public.team_goals;
create policy "team_goals_select_member"
on public.team_goals for select
using (public.is_team_member(team_id, auth.uid()));

drop policy if exists "team_goals_insert_admin" on public.team_goals;
create policy "team_goals_insert_admin"
on public.team_goals for insert
with check (created_by = auth.uid() and public.is_team_admin(team_id, auth.uid()));

drop policy if exists "team_goals_update_admin" on public.team_goals;
create policy "team_goals_update_admin"
on public.team_goals for update
using (public.is_team_admin(team_id, auth.uid()))
with check (public.is_team_admin(team_id, auth.uid()));

drop policy if exists "team_goals_delete_admin" on public.team_goals;
create policy "team_goals_delete_admin"
on public.team_goals for delete
using (public.is_team_admin(team_id, auth.uid()));

drop policy if exists "team_goal_contributions_select_member" on public.team_goal_contributions;
create policy "team_goal_contributions_select_member"
on public.team_goal_contributions for select
using (
  exists (
    select 1 from public.team_goals g
    where g.id = goal_id and public.is_team_member(g.team_id, auth.uid())
  )
);

drop policy if exists "team_goal_contributions_insert_self" on public.team_goal_contributions;
create policy "team_goal_contributions_insert_self"
on public.team_goal_contributions for insert
with check (
  user_id = auth.uid()
  and exists (
    select 1 from public.team_goals g
    where g.id = goal_id and g.status = 'active' and public.is_team_member(g.team_id, auth.uid())
  )
);

drop policy if exists "team_goal_contributions_delete_self" on public.team_goal_contributions;
create policy "team_goal_contributions_delete_self"
on public.team_goal_contributions for delete
using (user_id = auth.uid());

drop policy if exists "team_challenges_select_member" on public.team_challenges;
create policy "team_challenges_select_member"
on public.team_challenges for select
using (public.is_team_member(team_id, auth.uid()));

drop policy if exists "team_challenges_insert_admin" on public.team_challenges;
create policy "team_challenges_insert_admin"
on public.team_challenges for insert
with check (created_by = auth.uid() and public.is_team_admin(team_id, auth.uid()));

drop policy if exists "team_challenges_update_admin" on public.team_challenges;
create policy "team_challenges_update_admin"
on public.team_challenges for update
using (public.is_team_admin(team_id, auth.uid()))
with check (public.is_team_admin(team_id, auth.uid()));

drop policy if exists "team_challenges_delete_admin" on public.team_challenges;
create policy "team_challenges_delete_admin"
on public.team_challenges for delete
using (public.is_team_admin(team_id, auth.uid()));

drop policy if exists "team_challenge_checkins_select_member" on public.team_challenge_checkins;
create policy "team_challenge_checkins_select_member"
on public.team_challenge_checkins for select
using (
  exists (
    select 1 from public.team_challenges c
    where c.id = challenge_id and public.is_team_member(c.team_id, auth.uid())
  )
);

drop policy if exists "team_challenge_checkins_insert_self" on public.team_challenge_checkins;
create policy "team_challenge_checkins_insert_self"
on public.team_challenge_checkins for insert
with check (
  user_id = auth.uid()
  and exists (
    select 1 from public.team_challenges c
    where c.id = challenge_id and c.status = 'active' and public.is_team_member(c.team_id, auth.uid())
  )
);

drop policy if exists "team_challenge_checkins_delete_self" on public.team_challenge_checkins;
create policy "team_challenge_checkins_delete_self"
on public.team_challenge_checkins for delete
using (user_id = auth.uid());
