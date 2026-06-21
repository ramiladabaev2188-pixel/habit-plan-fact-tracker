-- Pilot team board. This workflow is intentionally independent from personal
-- habits, monthly plans and daily facts.

create table if not exists public.team_boards (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete cascade,
  created_by uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  description text,
  is_archived boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.team_board_columns (
  id uuid primary key default gen_random_uuid(),
  board_id uuid not null references public.team_boards(id) on delete cascade,
  title text not null,
  color text not null default '#3478d4' check (color ~ '^#[0-9a-fA-F]{6}$'),
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  unique (board_id, title)
);

create table if not exists public.team_board_tasks (
  id uuid primary key default gen_random_uuid(),
  board_id uuid not null references public.team_boards(id) on delete cascade,
  column_id uuid not null references public.team_board_columns(id) on delete restrict,
  created_by uuid not null references public.profiles(id) on delete cascade,
  assignee_id uuid references public.profiles(id) on delete set null,
  title text not null,
  description text,
  priority text not null default 'medium' check (priority in ('low', 'medium', 'high', 'urgent')),
  due_date date,
  sort_order numeric not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.team_board_comments (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.team_board_tasks(id) on delete cascade,
  author_id uuid not null references public.profiles(id) on delete cascade,
  content text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists team_boards_team_idx on public.team_boards(team_id, is_archived, created_at);
create index if not exists team_board_columns_board_idx on public.team_board_columns(board_id, sort_order);
create index if not exists team_board_tasks_board_column_idx on public.team_board_tasks(board_id, column_id, sort_order);
create index if not exists team_board_tasks_assignee_idx on public.team_board_tasks(assignee_id, due_date);
create index if not exists team_board_comments_task_idx on public.team_board_comments(task_id, created_at);

create or replace function public.ensure_team_board_task_integrity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  board_team_id uuid;
begin
  select team_id into board_team_id from public.team_boards where id = new.board_id;

  if board_team_id is null then
    raise exception 'BOARD_NOT_FOUND';
  end if;

  if not exists (
    select 1 from public.team_board_columns c
    where c.id = new.column_id and c.board_id = new.board_id
  ) then
    raise exception 'COLUMN_NOT_IN_BOARD';
  end if;

  if new.assignee_id is not null and not public.is_team_member(board_team_id, new.assignee_id) then
    raise exception 'ASSIGNEE_NOT_IN_TEAM';
  end if;

  return new;
end;
$$;

drop trigger if exists ensure_team_board_task_integrity_on_tasks on public.team_board_tasks;
create trigger ensure_team_board_task_integrity_on_tasks
before insert or update on public.team_board_tasks
for each row execute function public.ensure_team_board_task_integrity();

drop trigger if exists team_boards_touch_updated_at on public.team_boards;
create trigger team_boards_touch_updated_at
before update on public.team_boards
for each row execute function public.touch_updated_at();

drop trigger if exists team_board_tasks_touch_updated_at on public.team_board_tasks;
create trigger team_board_tasks_touch_updated_at
before update on public.team_board_tasks
for each row execute function public.touch_updated_at();

drop trigger if exists team_board_comments_touch_updated_at on public.team_board_comments;
create trigger team_board_comments_touch_updated_at
before update on public.team_board_comments
for each row execute function public.touch_updated_at();

alter table public.team_boards enable row level security;
alter table public.team_board_columns enable row level security;
alter table public.team_board_tasks enable row level security;
alter table public.team_board_comments enable row level security;

drop policy if exists "team_boards_select_member" on public.team_boards;
create policy "team_boards_select_member"
on public.team_boards for select
using (public.is_team_member(team_id, auth.uid()));

drop policy if exists "team_boards_insert_admin" on public.team_boards;
create policy "team_boards_insert_admin"
on public.team_boards for insert
with check (created_by = auth.uid() and public.is_team_admin(team_id, auth.uid()));

drop policy if exists "team_boards_update_admin" on public.team_boards;
create policy "team_boards_update_admin"
on public.team_boards for update
using (public.is_team_admin(team_id, auth.uid()))
with check (public.is_team_admin(team_id, auth.uid()));

drop policy if exists "team_boards_delete_admin" on public.team_boards;
create policy "team_boards_delete_admin"
on public.team_boards for delete
using (public.is_team_admin(team_id, auth.uid()));

drop policy if exists "team_board_columns_select_member" on public.team_board_columns;
create policy "team_board_columns_select_member"
on public.team_board_columns for select
using (
  exists (
    select 1 from public.team_boards b
    where b.id = board_id and public.is_team_member(b.team_id, auth.uid())
  )
);

drop policy if exists "team_board_columns_manage_admin" on public.team_board_columns;
create policy "team_board_columns_manage_admin"
on public.team_board_columns for all
using (
  exists (
    select 1 from public.team_boards b
    where b.id = board_id and public.is_team_admin(b.team_id, auth.uid())
  )
)
with check (
  exists (
    select 1 from public.team_boards b
    where b.id = board_id and public.is_team_admin(b.team_id, auth.uid())
  )
);

drop policy if exists "team_board_tasks_select_member" on public.team_board_tasks;
create policy "team_board_tasks_select_member"
on public.team_board_tasks for select
using (
  exists (
    select 1 from public.team_boards b
    where b.id = board_id and public.is_team_member(b.team_id, auth.uid())
  )
);

drop policy if exists "team_board_tasks_insert_member" on public.team_board_tasks;
create policy "team_board_tasks_insert_member"
on public.team_board_tasks for insert
with check (
  created_by = auth.uid()
  and exists (
    select 1 from public.team_boards b
    where b.id = board_id and public.is_team_member(b.team_id, auth.uid())
  )
);

drop policy if exists "team_board_tasks_update_member" on public.team_board_tasks;
create policy "team_board_tasks_update_member"
on public.team_board_tasks for update
using (
  exists (
    select 1 from public.team_boards b
    where b.id = board_id and public.is_team_member(b.team_id, auth.uid())
  )
)
with check (
  exists (
    select 1 from public.team_boards b
    where b.id = board_id and public.is_team_member(b.team_id, auth.uid())
  )
);

drop policy if exists "team_board_tasks_delete_creator_or_admin" on public.team_board_tasks;
create policy "team_board_tasks_delete_creator_or_admin"
on public.team_board_tasks for delete
using (
  created_by = auth.uid()
  or exists (
    select 1 from public.team_boards b
    where b.id = board_id and public.is_team_admin(b.team_id, auth.uid())
  )
);

drop policy if exists "team_board_comments_select_member" on public.team_board_comments;
create policy "team_board_comments_select_member"
on public.team_board_comments for select
using (
  exists (
    select 1
    from public.team_board_tasks t
    join public.team_boards b on b.id = t.board_id
    where t.id = task_id and public.is_team_member(b.team_id, auth.uid())
  )
);

drop policy if exists "team_board_comments_insert_author" on public.team_board_comments;
create policy "team_board_comments_insert_author"
on public.team_board_comments for insert
with check (
  author_id = auth.uid()
  and exists (
    select 1
    from public.team_board_tasks t
    join public.team_boards b on b.id = t.board_id
    where t.id = task_id and public.is_team_member(b.team_id, auth.uid())
  )
);

drop policy if exists "team_board_comments_update_author" on public.team_board_comments;
create policy "team_board_comments_update_author"
on public.team_board_comments for update
using (author_id = auth.uid())
with check (author_id = auth.uid());

drop policy if exists "team_board_comments_delete_author" on public.team_board_comments;
create policy "team_board_comments_delete_author"
on public.team_board_comments for delete
using (author_id = auth.uid());
