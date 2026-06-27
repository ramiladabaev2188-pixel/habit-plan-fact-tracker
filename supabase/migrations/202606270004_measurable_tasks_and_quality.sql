alter table public.tasks
  add column if not exists input_mode text not null default 'ratio',
  add column if not exists unit text;

alter table public.tasks
  drop constraint if exists tasks_input_mode_check;

alter table public.tasks
  add constraint tasks_input_mode_check
  check (input_mode in ('ratio', 'measured'));

alter table public.daily_plans
  drop constraint if exists daily_plans_planned_value_check;

alter table public.daily_plans
  add constraint daily_plans_planned_value_check
  check (planned_value >= 0 and planned_value <= 1000000);

alter table public.daily_facts
  drop constraint if exists daily_facts_actual_value_check;

alter table public.daily_facts
  add constraint daily_facts_actual_value_check
  check (actual_value >= 0 and actual_value <= 1000000);

alter table public.task_planning_rules
  drop constraint if exists task_planning_rules_default_planned_value_check;

alter table public.task_planning_rules
  add constraint task_planning_rules_default_planned_value_check
  check (default_planned_value >= 0 and default_planned_value <= 1000000);

create index if not exists tasks_user_input_mode_idx on public.tasks(user_id, input_mode);
