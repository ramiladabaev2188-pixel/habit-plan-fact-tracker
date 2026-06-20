-- Integrity and privacy hardening for production data.

create or replace function public.ensure_daily_record_matches_month()
returns trigger
language plpgsql
as $$
declare
  month_year int;
  month_number int;
begin
  select year, month into month_year, month_number
  from public.months
  where id = new.month_id;

  if month_year is null then
    raise exception 'MONTH_NOT_FOUND';
  end if;

  if extract(year from new.date)::int <> month_year or extract(month from new.date)::int <> month_number then
    raise exception 'DATE_OUTSIDE_MONTH';
  end if;

  return new;
end;
$$;

drop trigger if exists daily_plans_match_month on public.daily_plans;
create trigger daily_plans_match_month
before insert or update on public.daily_plans
for each row execute function public.ensure_daily_record_matches_month();

drop trigger if exists daily_facts_match_month on public.daily_facts;
create trigger daily_facts_match_month
before insert or update on public.daily_facts
for each row execute function public.ensure_daily_record_matches_month();

create or replace function public.prevent_fact_without_plan()
returns trigger
language plpgsql
as $$
begin
  if not exists (
    select 1
    from public.daily_plans
    where month_id = new.month_id
      and task_id = new.task_id
      and date = new.date
      and planned_value > 0
  ) then
    raise exception 'FACT_REQUIRES_PLAN';
  end if;

  return new;
end;
$$;

drop trigger if exists daily_facts_require_plan on public.daily_facts;
create trigger daily_facts_require_plan
before insert or update on public.daily_facts
for each row execute function public.prevent_fact_without_plan();

create or replace function public.prevent_closed_daily_fact_changes()
returns trigger
language plpgsql
as $$
declare
  checked_month_id uuid;
begin
  checked_month_id := case when tg_op = 'DELETE' then old.month_id else new.month_id end;

  if exists (
    select 1
    from public.months
    where id = checked_month_id and status = 'closed'
  ) then
    raise exception 'CLOSED_MONTH_READ_ONLY';
  end if;

  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

drop trigger if exists daily_facts_prevent_closed_changes on public.daily_facts;
create trigger daily_facts_prevent_closed_changes
before insert or update or delete on public.daily_facts
for each row execute function public.prevent_closed_daily_fact_changes();

create or replace function public.prevent_month_status_downgrade()
returns trigger
language plpgsql
as $$
begin
  if old.status in ('approved', 'closed') and new.status = 'draft' then
    raise exception 'PROTECTED_MONTH_CANNOT_BECOME_DRAFT';
  end if;

  return new;
end;
$$;

drop trigger if exists months_prevent_status_downgrade on public.months;
create trigger months_prevent_status_downgrade
before update on public.months
for each row execute function public.prevent_month_status_downgrade();

create or replace function public.accept_team_invite_by_token(invite_token text)
returns table (
  team_id uuid,
  already_member boolean
)
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  current_email text := lower(coalesce(auth.jwt() ->> 'email', ''));
  invite_record public.team_invites%rowtype;
  current_member public.team_members%rowtype;
begin
  if current_user_id is null then
    raise exception 'AUTH_REQUIRED';
  end if;

  select * into invite_record
  from public.team_invites
  where token = invite_token
  for update;

  if invite_record.id is null then
    raise exception 'INVITE_NOT_FOUND';
  end if;

  if invite_record.email is not null and lower(trim(invite_record.email)) <> current_email then
    raise exception 'INVITE_EMAIL_MISMATCH';
  end if;

  select * into current_member
  from public.team_members
  where team_members.team_id = invite_record.team_id
    and team_members.user_id = current_user_id;

  if current_member.status = 'active' then
    team_id := invite_record.team_id;
    already_member := true;
    return next;
    return;
  end if;

  if invite_record.accepted_at is not null then
    raise exception 'INVITE_ALREADY_USED';
  end if;

  if invite_record.expires_at <= now() then
    raise exception 'INVITE_EXPIRED';
  end if;

  insert into public.team_members(team_id, user_id, role, status, joined_at)
  values (invite_record.team_id, current_user_id, invite_record.role, 'active', now())
  on conflict (team_id, user_id)
  do update set
    role = excluded.role,
    status = 'active',
    joined_at = now();

  update public.team_invites
  set accepted_at = now(), accepted_by = current_user_id
  where id = invite_record.id;

  team_id := invite_record.team_id;
  already_member := false;
  return next;
end;
$$;

create or replace function public.get_team_member_profiles(checked_team_id uuid)
returns table (
  id uuid,
  name text
)
language sql
stable
security definer
set search_path = public
as $$
  select p.id, coalesce(p.name, 'Участник')
  from public.profiles p
  join public.team_members tm on tm.user_id = p.id
  where tm.team_id = checked_team_id
    and tm.status = 'active'
    and public.is_team_member(checked_team_id, auth.uid());
$$;

revoke all on function public.accept_team_invite_by_token(text) from public;
grant execute on function public.accept_team_invite_by_token(text) to authenticated;

drop policy if exists "profiles_select_team_members" on public.profiles;

revoke all on function public.get_team_member_profiles(uuid) from public;
grant execute on function public.get_team_member_profiles(uuid) to authenticated;

create table if not exists public.team_member_preferences (
  team_id uuid not null references public.teams(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  share_task_details boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (team_id, user_id)
);

insert into public.team_member_preferences(team_id, user_id, share_task_details)
select team_id, user_id, true
from public.team_members
on conflict (team_id, user_id) do nothing;

drop trigger if exists team_member_preferences_touch_updated_at on public.team_member_preferences;
create trigger team_member_preferences_touch_updated_at
before update on public.team_member_preferences
for each row execute function public.touch_updated_at();

alter table public.team_member_preferences enable row level security;

drop policy if exists "team_member_preferences_own_all" on public.team_member_preferences;
create policy "team_member_preferences_own_all"
on public.team_member_preferences for all
using (user_id = auth.uid())
with check (
  user_id = auth.uid()
  and public.is_team_member(team_id, auth.uid())
);

create or replace function public.share_team_details(owner_user_id uuid, viewer_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select owner_user_id = viewer_user_id or exists (
    select 1
    from public.team_members owner_member
    join public.team_members viewer_member on viewer_member.team_id = owner_member.team_id
    left join public.team_member_preferences preference
      on preference.team_id = owner_member.team_id
      and preference.user_id = owner_member.user_id
    where owner_member.user_id = owner_user_id
      and viewer_member.user_id = viewer_user_id
      and owner_member.status = 'active'
      and viewer_member.status = 'active'
      and coalesce(preference.share_task_details, true)
  );
$$;

drop policy if exists "categories_team_select" on public.categories;
create policy "categories_team_select"
on public.categories for select
using (public.share_team_details(user_id, auth.uid()));

drop policy if exists "tasks_team_select" on public.tasks;
create policy "tasks_team_select"
on public.tasks for select
using (public.share_team_details(user_id, auth.uid()));

drop policy if exists "months_team_select" on public.months;
create policy "months_team_select"
on public.months for select
using (public.share_team_details(user_id, auth.uid()));

drop policy if exists "daily_plans_team_select" on public.daily_plans;
create policy "daily_plans_team_select"
on public.daily_plans for select
using (
  exists (
    select 1 from public.months m
    where m.id = month_id and public.share_team_details(m.user_id, auth.uid())
  )
);

drop policy if exists "daily_facts_team_select" on public.daily_facts;
create policy "daily_facts_team_select"
on public.daily_facts for select
using (
  exists (
    select 1 from public.months m
    where m.id = month_id and public.share_team_details(m.user_id, auth.uid())
  )
);
