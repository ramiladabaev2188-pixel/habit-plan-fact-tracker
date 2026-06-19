create table if not exists public.teams (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  name text not null,
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.team_members (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role text not null default 'member' check (role in ('owner', 'admin', 'member')),
  status text not null default 'active' check (status in ('active', 'left')),
  joined_at timestamptz,
  created_at timestamptz not null default now(),
  unique (team_id, user_id)
);

create table if not exists public.team_invites (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete cascade,
  created_by uuid not null references public.profiles(id) on delete cascade,
  token text not null unique,
  email text,
  role text not null default 'member' check (role in ('admin', 'member')),
  expires_at timestamptz not null default (now() + interval '14 days'),
  accepted_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists teams_owner_idx on public.teams(owner_id);
create index if not exists team_members_user_idx on public.team_members(user_id, status);
create index if not exists team_members_team_idx on public.team_members(team_id, status);
create index if not exists team_invites_token_idx on public.team_invites(token);
create index if not exists team_invites_team_idx on public.team_invites(team_id, accepted_at, expires_at);

drop trigger if exists teams_touch_updated_at on public.teams;
create trigger teams_touch_updated_at
before update on public.teams
for each row execute function public.touch_updated_at();

create or replace function public.is_team_member(checked_team_id uuid, checked_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.team_members tm
    where tm.team_id = checked_team_id
      and tm.user_id = checked_user_id
      and tm.status = 'active'
  );
$$;

create or replace function public.is_team_admin(checked_team_id uuid, checked_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.team_members tm
    where tm.team_id = checked_team_id
      and tm.user_id = checked_user_id
      and tm.status = 'active'
      and tm.role in ('owner', 'admin')
  );
$$;

create or replace function public.share_team(user_a uuid, user_b uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select user_a = user_b or exists (
    select 1
    from public.team_members a
    join public.team_members b on b.team_id = a.team_id
    where a.user_id = user_a
      and b.user_id = user_b
      and a.status = 'active'
      and b.status = 'active'
  );
$$;

alter table public.teams enable row level security;
alter table public.team_members enable row level security;
alter table public.team_invites enable row level security;

drop policy if exists "teams_select_member" on public.teams;
create policy "teams_select_member"
on public.teams for select
using (owner_id = auth.uid() or public.is_team_member(id, auth.uid()));

drop policy if exists "teams_insert_owner" on public.teams;
create policy "teams_insert_owner"
on public.teams for insert
with check (owner_id = auth.uid());

drop policy if exists "teams_update_admin" on public.teams;
create policy "teams_update_admin"
on public.teams for update
using (public.is_team_admin(id, auth.uid()))
with check (public.is_team_admin(id, auth.uid()));

drop policy if exists "teams_delete_owner" on public.teams;
create policy "teams_delete_owner"
on public.teams for delete
using (owner_id = auth.uid());

drop policy if exists "team_members_select_team" on public.team_members;
create policy "team_members_select_team"
on public.team_members for select
using (public.is_team_member(team_id, auth.uid()) or user_id = auth.uid());

drop policy if exists "team_members_insert_self_or_admin" on public.team_members;
create policy "team_members_insert_self_or_admin"
on public.team_members for insert
with check (
  user_id = auth.uid()
  or public.is_team_admin(team_id, auth.uid())
);

drop policy if exists "team_members_update_admin" on public.team_members;
create policy "team_members_update_admin"
on public.team_members for update
using (public.is_team_admin(team_id, auth.uid()) or user_id = auth.uid())
with check (public.is_team_admin(team_id, auth.uid()) or user_id = auth.uid());

drop policy if exists "team_members_delete_admin_or_self" on public.team_members;
create policy "team_members_delete_admin_or_self"
on public.team_members for delete
using (public.is_team_admin(team_id, auth.uid()) or user_id = auth.uid());

drop policy if exists "team_invites_select_member_or_token" on public.team_invites;
create policy "team_invites_select_member_or_token"
on public.team_invites for select
using (
  public.is_team_member(team_id, auth.uid())
  or (
    auth.uid() is not null
    and accepted_at is null
    and expires_at > now()
  )
);

drop policy if exists "team_invites_insert_admin" on public.team_invites;
create policy "team_invites_insert_admin"
on public.team_invites for insert
with check (
  created_by = auth.uid()
  and public.is_team_admin(team_id, auth.uid())
);

drop policy if exists "team_invites_update_admin_or_accepting_user" on public.team_invites;
create policy "team_invites_update_admin_or_accepting_user"
on public.team_invites for update
using (
  public.is_team_admin(team_id, auth.uid())
  or (
    auth.uid() is not null
    and accepted_at is null
    and expires_at > now()
  )
)
with check (
  public.is_team_admin(team_id, auth.uid())
  or auth.uid() is not null
);

drop policy if exists "team_invites_delete_admin" on public.team_invites;
create policy "team_invites_delete_admin"
on public.team_invites for delete
using (public.is_team_admin(team_id, auth.uid()));

drop policy if exists "profiles_select_team_members" on public.profiles;
create policy "profiles_select_team_members"
on public.profiles for select
using (public.share_team(id, auth.uid()));

drop policy if exists "categories_team_select" on public.categories;
create policy "categories_team_select"
on public.categories for select
using (public.share_team(user_id, auth.uid()));

drop policy if exists "tasks_team_select" on public.tasks;
create policy "tasks_team_select"
on public.tasks for select
using (public.share_team(user_id, auth.uid()));

drop policy if exists "months_team_select" on public.months;
create policy "months_team_select"
on public.months for select
using (public.share_team(user_id, auth.uid()));

drop policy if exists "daily_plans_team_select" on public.daily_plans;
create policy "daily_plans_team_select"
on public.daily_plans for select
using (
  exists (
    select 1 from public.months m
    where m.id = month_id and public.share_team(m.user_id, auth.uid())
  )
);

drop policy if exists "daily_facts_team_select" on public.daily_facts;
create policy "daily_facts_team_select"
on public.daily_facts for select
using (
  exists (
    select 1 from public.months m
    where m.id = month_id and public.share_team(m.user_id, auth.uid())
  )
);
