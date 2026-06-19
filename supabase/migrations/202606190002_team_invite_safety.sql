alter table public.team_invites
add column if not exists accepted_by uuid references public.profiles(id) on delete set null;

create index if not exists team_invites_accepted_by_idx on public.team_invites(accepted_by);

update public.team_members tm
set
  role = 'owner',
  status = 'active',
  joined_at = coalesce(tm.joined_at, now())
from public.teams t
where t.id = tm.team_id
  and t.owner_id = tm.user_id
  and (tm.role <> 'owner' or tm.status <> 'active' or tm.joined_at is null);

create or replace function public.force_team_owner_membership()
returns trigger
language plpgsql
as $$
declare
  team_owner_id uuid;
begin
  select owner_id into team_owner_id
  from public.teams
  where id = new.team_id;

  if team_owner_id = new.user_id then
    new.role = 'owner';
    new.status = 'active';
    new.joined_at = coalesce(new.joined_at, now());
  end if;

  return new;
end;
$$;

drop trigger if exists team_members_force_owner on public.team_members;
create trigger team_members_force_owner
before insert or update on public.team_members
for each row execute function public.force_team_owner_membership();
