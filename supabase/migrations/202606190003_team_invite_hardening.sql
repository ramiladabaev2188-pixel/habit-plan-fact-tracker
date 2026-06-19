create or replace function public.prevent_team_owner_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.owner_id is distinct from old.owner_id then
    raise exception 'TEAM_OWNER_IMMUTABLE';
  end if;

  return new;
end;
$$;

drop trigger if exists prevent_team_owner_change_on_teams on public.teams;
create trigger prevent_team_owner_change_on_teams
before update on public.teams
for each row
execute function public.prevent_team_owner_change();

create or replace function public.enforce_team_owner_member_role()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.role = 'owner' and not exists (
    select 1
    from public.teams t
    where t.id = new.team_id and t.owner_id = new.user_id
  ) then
    raise exception 'OWNER_ROLE_RESERVED';
  end if;

  return new;
end;
$$;

drop trigger if exists enforce_team_owner_member_role_on_team_members on public.team_members;
create trigger enforce_team_owner_member_role_on_team_members
before insert or update on public.team_members
for each row
execute function public.enforce_team_owner_member_role();

drop policy if exists "team_members_insert_self_or_admin" on public.team_members;
create policy "team_members_insert_owner_or_admin"
on public.team_members for insert
with check (
  public.is_team_admin(team_id, auth.uid())
  or exists (
    select 1
    from public.teams t
    where t.id = team_id
      and t.owner_id = auth.uid()
      and user_id = auth.uid()
      and role = 'owner'
  )
);

drop policy if exists "team_members_update_admin" on public.team_members;
create policy "team_members_update_admin"
on public.team_members for update
using (public.is_team_admin(team_id, auth.uid()) and role <> 'owner')
with check (public.is_team_admin(team_id, auth.uid()));

drop policy if exists "team_members_delete_admin_or_self" on public.team_members;
create policy "team_members_delete_admin_non_owner"
on public.team_members for delete
using (role <> 'owner' and public.is_team_admin(team_id, auth.uid()));

create or replace function public.leave_team(checked_team_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  team_owner_id uuid;
begin
  if current_user_id is null then
    raise exception 'AUTH_REQUIRED';
  end if;

  select owner_id
  into team_owner_id
  from public.teams
  where id = checked_team_id;

  if team_owner_id is null then
    raise exception 'TEAM_NOT_FOUND';
  end if;

  if team_owner_id = current_user_id then
    raise exception 'OWNER_CANNOT_LEAVE';
  end if;

  update public.team_members
  set status = 'left'
  where team_id = checked_team_id
    and user_id = current_user_id
    and status = 'active';
end;
$$;

drop policy if exists "team_invites_select_member_or_token" on public.team_invites;
drop policy if exists "team_invites_update_admin_or_accepting_user" on public.team_invites;

create policy "team_invites_select_admin"
on public.team_invites for select
using (public.is_team_admin(team_id, auth.uid()));

create policy "team_invites_update_admin"
on public.team_invites for update
using (public.is_team_admin(team_id, auth.uid()))
with check (public.is_team_admin(team_id, auth.uid()));

create or replace function public.get_team_invite_by_token(invite_token text)
returns table (
  team_id uuid,
  role text,
  expires_at timestamptz,
  accepted_at timestamptz,
  accepted_by uuid,
  team_name text
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'AUTH_REQUIRED';
  end if;

  return query
  select i.team_id, i.role, i.expires_at, i.accepted_at, i.accepted_by, t.name
  from public.team_invites i
  join public.teams t on t.id = i.team_id
  where i.token = invite_token
  limit 1;
end;
$$;

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
  invite_record public.team_invites%rowtype;
  current_member public.team_members%rowtype;
begin
  if current_user_id is null then
    raise exception 'AUTH_REQUIRED';
  end if;

  select *
  into invite_record
  from public.team_invites
  where token = invite_token
  for update;

  if invite_record.id is null then
    raise exception 'INVITE_NOT_FOUND';
  end if;

  select *
  into current_member
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

revoke all on function public.get_team_invite_by_token(text) from public;
revoke all on function public.accept_team_invite_by_token(text) from public;
revoke all on function public.leave_team(uuid) from public;
grant execute on function public.get_team_invite_by_token(text) to authenticated;
grant execute on function public.accept_team_invite_by_token(text) to authenticated;
grant execute on function public.leave_team(uuid) to authenticated;
