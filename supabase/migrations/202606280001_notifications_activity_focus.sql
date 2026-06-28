create or replace function public.update_updated_at_column()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists public.notification_settings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  enabled boolean not null default true,
  evening_reminder_time text not null default '21:00',
  remind_deadline_1d boolean not null default true,
  remind_deadline_3d boolean not null default true,
  remind_overdue boolean not null default true,
  remind_weekly_review boolean not null default true,
  quiet_mode boolean not null default false,
  reminder_weekdays int[] not null default '{1,2,3,4,5,6,0}',
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  unique(user_id),
  constraint notification_settings_time_check check (evening_reminder_time ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$')
);

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  type text not null,
  title text not null,
  body text,
  entity_type text,
  entity_id uuid,
  action_url text,
  status text not null default 'unread',
  scheduled_for date,
  dedupe_key text not null,
  created_at timestamp with time zone not null default now(),
  read_at timestamp with time zone,
  dismissed_at timestamp with time zone,
  unique(user_id, dedupe_key),
  constraint notifications_status_check check (status in ('unread', 'read', 'dismissed')),
  constraint notifications_type_check check (
    type in (
      'due_today',
      'due_tomorrow',
      'due_3_days',
      'overdue',
      'today_fact_missing',
      'yesterday_not_closed',
      'stale_goal_progress',
      'weak_life_area',
      'weekly_review_due',
      'monthly_plan_update_due',
      'team_challenge_ending',
      'system'
    )
  )
);

create table if not exists public.activity_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  entity_type text not null,
  entity_id uuid,
  action text not null,
  title text not null,
  description text,
  occurred_at timestamp with time zone not null default now(),
  metadata jsonb not null default '{}'::jsonb,
  visibility text not null default 'private',
  constraint activity_events_visibility_check check (visibility in ('private', 'team'))
);

create table if not exists public.day_summaries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  month_id uuid not null references public.months(id) on delete cascade,
  date date not null,
  planned_count int not null default 0,
  done_count int not null default 0,
  partial_count int not null default 0,
  overdone_count int not null default 0,
  missed_count int not null default 0,
  missing_fact_count int not null default 0,
  plan_score numeric not null default 0,
  fact_score numeric not null default 0,
  completion numeric not null default 0,
  main_miss_reason text,
  note text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  unique(user_id, date)
);

create table if not exists public.focus_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  task_id uuid references public.tasks(id) on delete set null,
  started_at timestamp with time zone not null,
  ended_at timestamp with time zone,
  duration_minutes int,
  note text,
  outcome text,
  created_at timestamp with time zone not null default now(),
  constraint focus_sessions_duration_check check (duration_minutes is null or duration_minutes >= 0)
);

create index if not exists notifications_user_status_idx on public.notifications(user_id, status, created_at desc);
create index if not exists notifications_user_scheduled_idx on public.notifications(user_id, scheduled_for, type);
create index if not exists notification_settings_user_idx on public.notification_settings(user_id);
create index if not exists activity_events_user_occurred_idx on public.activity_events(user_id, occurred_at desc);
create index if not exists activity_events_user_entity_idx on public.activity_events(user_id, entity_type, entity_id);
create index if not exists day_summaries_user_date_idx on public.day_summaries(user_id, date desc);
create index if not exists focus_sessions_user_started_idx on public.focus_sessions(user_id, started_at desc);
create index if not exists focus_sessions_task_started_idx on public.focus_sessions(task_id, started_at desc);

alter table public.notification_settings enable row level security;
alter table public.notifications enable row level security;
alter table public.activity_events enable row level security;
alter table public.day_summaries enable row level security;
alter table public.focus_sessions enable row level security;

drop policy if exists "notification_settings_own_select" on public.notification_settings;
create policy "notification_settings_own_select"
on public.notification_settings for select
using (user_id = auth.uid());

drop policy if exists "notification_settings_own_insert" on public.notification_settings;
create policy "notification_settings_own_insert"
on public.notification_settings for insert
with check (user_id = auth.uid());

drop policy if exists "notification_settings_own_update" on public.notification_settings;
create policy "notification_settings_own_update"
on public.notification_settings for update
using (user_id = auth.uid())
with check (user_id = auth.uid());

drop policy if exists "notifications_own_select" on public.notifications;
create policy "notifications_own_select"
on public.notifications for select
using (user_id = auth.uid());

drop policy if exists "notifications_own_insert" on public.notifications;
create policy "notifications_own_insert"
on public.notifications for insert
with check (user_id = auth.uid());

drop policy if exists "notifications_own_update" on public.notifications;
create policy "notifications_own_update"
on public.notifications for update
using (user_id = auth.uid())
with check (user_id = auth.uid());

drop policy if exists "notifications_own_delete" on public.notifications;
create policy "notifications_own_delete"
on public.notifications for delete
using (user_id = auth.uid());

drop policy if exists "activity_events_own_select" on public.activity_events;
create policy "activity_events_own_select"
on public.activity_events for select
using (user_id = auth.uid());

drop policy if exists "activity_events_own_insert" on public.activity_events;
create policy "activity_events_own_insert"
on public.activity_events for insert
with check (user_id = auth.uid());

drop policy if exists "day_summaries_own_select" on public.day_summaries;
create policy "day_summaries_own_select"
on public.day_summaries for select
using (user_id = auth.uid());

drop policy if exists "day_summaries_own_insert" on public.day_summaries;
create policy "day_summaries_own_insert"
on public.day_summaries for insert
with check (user_id = auth.uid());

drop policy if exists "day_summaries_own_update" on public.day_summaries;
create policy "day_summaries_own_update"
on public.day_summaries for update
using (user_id = auth.uid())
with check (user_id = auth.uid());

drop policy if exists "focus_sessions_own_select" on public.focus_sessions;
create policy "focus_sessions_own_select"
on public.focus_sessions for select
using (user_id = auth.uid());

drop policy if exists "focus_sessions_own_insert" on public.focus_sessions;
create policy "focus_sessions_own_insert"
on public.focus_sessions for insert
with check (user_id = auth.uid());

drop policy if exists "focus_sessions_own_update" on public.focus_sessions;
create policy "focus_sessions_own_update"
on public.focus_sessions for update
using (user_id = auth.uid())
with check (user_id = auth.uid());

drop policy if exists "focus_sessions_own_delete" on public.focus_sessions;
create policy "focus_sessions_own_delete"
on public.focus_sessions for delete
using (user_id = auth.uid());

drop trigger if exists update_notification_settings_updated_at on public.notification_settings;
create trigger update_notification_settings_updated_at
before update on public.notification_settings
for each row execute function public.update_updated_at_column();

drop trigger if exists update_day_summaries_updated_at on public.day_summaries;
create trigger update_day_summaries_updated_at
before update on public.day_summaries
for each row execute function public.update_updated_at_column();
