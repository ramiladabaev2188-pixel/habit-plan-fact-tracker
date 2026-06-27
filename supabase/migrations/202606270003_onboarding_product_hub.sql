alter table public.user_preferences
  add column if not exists onboarding_completed_at timestamptz,
  add column if not exists onboarding_mode text not null default 'normal'
    check (onboarding_mode in ('recovery', 'normal', 'push')),
  add column if not exists onboarding_blockers text[] not null default '{}',
  add column if not exists desired_identity text;

create index if not exists user_preferences_onboarding_idx
on public.user_preferences(user_id, onboarding_completed_at);
