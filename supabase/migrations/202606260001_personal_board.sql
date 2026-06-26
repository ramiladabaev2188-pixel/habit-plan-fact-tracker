-- Personal task board. This is intentionally separate from team boards,
-- monthly plans and daily facts.

create table if not exists public.personal_boards (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  description text,
  is_default boolean not null default false,
  is_archived boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.personal_board_columns (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  board_id uuid not null references public.personal_boards(id) on delete cascade,
  title text not null,
  color text not null default '#3478d4' check (color ~ '^#[0-9a-fA-F]{6}$'),
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  unique (board_id, title)
);

create table if not exists public.personal_board_tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  board_id uuid not null references public.personal_boards(id) on delete cascade,
  column_id uuid not null references public.personal_board_columns(id) on delete restrict,
  title text not null,
  description text,
  priority text not null default 'medium' check (priority in ('low', 'medium', 'high', 'urgent')),
  due_date date,
  goal_id uuid references public.goals(id) on delete set null,
  habit_task_id uuid references public.tasks(id) on delete set null,
  month_id uuid references public.months(id) on delete set null,
  sort_order numeric not null default 0,
  is_archived boolean not null default false,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.personal_board_comments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  task_id uuid not null references public.personal_board_tasks(id) on delete cascade,
  content text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists personal_boards_one_default_idx
on public.personal_boards(user_id)
where is_default and not is_archived;

create index if not exists personal_boards_user_idx on public.personal_boards(user_id, is_archived, created_at);
create index if not exists personal_board_columns_board_idx on public.personal_board_columns(board_id, sort_order);
create index if not exists personal_board_tasks_board_column_idx on public.personal_board_tasks(board_id, column_id, is_archived, sort_order);
create index if not exists personal_board_tasks_user_due_idx on public.personal_board_tasks(user_id, due_date, priority);
create index if not exists personal_board_tasks_goal_idx on public.personal_board_tasks(goal_id);
create index if not exists personal_board_tasks_habit_task_idx on public.personal_board_tasks(habit_task_id);
create index if not exists personal_board_comments_task_idx on public.personal_board_comments(task_id, created_at);

create or replace function public.ensure_personal_board_integrity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_table_name = 'personal_board_columns' then
    if not exists (
      select 1 from public.personal_boards b
      where b.id = new.board_id and b.user_id = new.user_id
    ) then
      raise exception 'PERSONAL_BOARD_NOT_FOUND';
    end if;

    return new;
  end if;

  if tg_table_name = 'personal_board_tasks' then
    if not exists (
      select 1 from public.personal_boards b
      where b.id = new.board_id and b.user_id = new.user_id
    ) then
      raise exception 'PERSONAL_BOARD_NOT_FOUND';
    end if;

    if not exists (
      select 1 from public.personal_board_columns c
      where c.id = new.column_id and c.board_id = new.board_id and c.user_id = new.user_id
    ) then
      raise exception 'PERSONAL_COLUMN_NOT_IN_BOARD';
    end if;

    if new.goal_id is not null and not exists (
      select 1 from public.goals g where g.id = new.goal_id and g.user_id = new.user_id
    ) then
      raise exception 'PERSONAL_GOAL_NOT_FOUND';
    end if;

    if new.habit_task_id is not null and not exists (
      select 1 from public.tasks t where t.id = new.habit_task_id and t.user_id = new.user_id
    ) then
      raise exception 'PERSONAL_HABIT_TASK_NOT_FOUND';
    end if;

    if new.month_id is not null and not exists (
      select 1 from public.months m where m.id = new.month_id and m.user_id = new.user_id
    ) then
      raise exception 'PERSONAL_MONTH_NOT_FOUND';
    end if;

    return new;
  end if;

  if tg_table_name = 'personal_board_comments' then
    if not exists (
      select 1 from public.personal_board_tasks t
      where t.id = new.task_id and t.user_id = new.user_id
    ) then
      raise exception 'PERSONAL_TASK_NOT_FOUND';
    end if;

    return new;
  end if;

  return new;
end;
$$;

drop trigger if exists ensure_personal_board_columns_integrity on public.personal_board_columns;
create trigger ensure_personal_board_columns_integrity
before insert or update on public.personal_board_columns
for each row execute function public.ensure_personal_board_integrity();

drop trigger if exists ensure_personal_board_tasks_integrity on public.personal_board_tasks;
create trigger ensure_personal_board_tasks_integrity
before insert or update on public.personal_board_tasks
for each row execute function public.ensure_personal_board_integrity();

drop trigger if exists ensure_personal_board_comments_integrity on public.personal_board_comments;
create trigger ensure_personal_board_comments_integrity
before insert or update on public.personal_board_comments
for each row execute function public.ensure_personal_board_integrity();

drop trigger if exists personal_boards_touch_updated_at on public.personal_boards;
create trigger personal_boards_touch_updated_at
before update on public.personal_boards
for each row execute function public.touch_updated_at();

drop trigger if exists personal_board_tasks_touch_updated_at on public.personal_board_tasks;
create trigger personal_board_tasks_touch_updated_at
before update on public.personal_board_tasks
for each row execute function public.touch_updated_at();

drop trigger if exists personal_board_comments_touch_updated_at on public.personal_board_comments;
create trigger personal_board_comments_touch_updated_at
before update on public.personal_board_comments
for each row execute function public.touch_updated_at();

alter table public.personal_boards enable row level security;
alter table public.personal_board_columns enable row level security;
alter table public.personal_board_tasks enable row level security;
alter table public.personal_board_comments enable row level security;

drop policy if exists "personal_boards_own_rows" on public.personal_boards;
create policy "personal_boards_own_rows"
on public.personal_boards for all
using (user_id = auth.uid())
with check (user_id = auth.uid());

drop policy if exists "personal_board_columns_own_rows" on public.personal_board_columns;
create policy "personal_board_columns_own_rows"
on public.personal_board_columns for all
using (user_id = auth.uid())
with check (user_id = auth.uid());

drop policy if exists "personal_board_tasks_own_rows" on public.personal_board_tasks;
create policy "personal_board_tasks_own_rows"
on public.personal_board_tasks for all
using (user_id = auth.uid())
with check (user_id = auth.uid());

drop policy if exists "personal_board_comments_own_rows" on public.personal_board_comments;
create policy "personal_board_comments_own_rows"
on public.personal_board_comments for all
using (user_id = auth.uid())
with check (user_id = auth.uid());
