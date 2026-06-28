export type MonthStatus = "draft" | "approved" | "closed";
export type GoalType = "long_term" | "monthly" | "weekly";
export type GoalStatus = "active" | "completed" | "paused" | "archived";
export type GoalPriority = "low" | "medium" | "high";
export type GoalProgressMode = "linked_tasks" | "manual_value" | "mixed";
export type ThemePreference = "light" | "dark" | "system";
export type OnboardingMode = "recovery" | "normal" | "push";
export type MissReason =
  | "no_time"
  | "low_energy"
  | "forgot"
  | "not_important"
  | "overloaded_plan"
  | "health"
  | "other_priorities"
  | "no_conditions"
  | "other";
export type ExperimentStatus = "draft" | "active" | "completed" | "archived";
export type LifeEventType =
  | "achievement"
  | "milestone"
  | "decision"
  | "failure"
  | "recovery"
  | "purchase"
  | "health"
  | "finance"
  | "work"
  | "family"
  | "faith"
  | "custom";
export type LifeEventImportance = 1 | 2 | 3 | 4 | 5;
export type CarSystem =
  | "engine"
  | "transmission"
  | "transfer_case"
  | "front_diff"
  | "rear_diff"
  | "brakes"
  | "spark_plugs"
  | "filters"
  | "antifreeze"
  | "power_steering"
  | "battery"
  | "tires"
  | "other";
export type CarServiceStatus = "ok" | "soon" | "overdue" | "unknown";
export type WorkProjectStatus = "active" | "paused" | "completed" | "archived";
export type TeamRole = "owner" | "admin" | "member";
export type TeamMemberStatus = "active" | "left";
export type TeamInitiativeStatus = "active" | "completed" | "archived";
export type TeamChallengeStatus = "draft" | "active" | "completed" | "archived";
export type PlanningRuleMode =
  | "daily"
  | "weekdays"
  | "weekends"
  | "specific_weekdays"
  | "specific_dates"
  | "n_times_per_month"
  | "manual";

export type Profile = {
  id: string;
  email: string | null;
  name: string | null;
  timezone: string | null;
  created_at: string;
};

export type Category = {
  id: string;
  user_id: string;
  life_area_id: string | null;
  name: string;
  color: string;
  sort_order: number | null;
  created_at: string;
};

export type LifeArea = {
  id: string;
  user_id: string;
  name: string;
  color: string;
  icon: string | null;
  description: string | null;
  is_active: boolean;
  sort_order: number | null;
  created_at: string;
  updated_at: string;
};

export type Task = {
  id: string;
  user_id: string;
  category_id: string | null;
  title: string;
  description: string | null;
  weight: number;
  input_mode?: "ratio" | "measured";
  unit?: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type Month = {
  id: string;
  user_id: string;
  year: number;
  month: number;
  title: string;
  status: MonthStatus;
  target_percent: number;
  approved_at: string | null;
  closed_at: string | null;
  created_at: string;
};

export type DailyPlan = {
  id: string;
  month_id: string;
  task_id: string;
  date: string;
  planned_value: number;
  planned_score: number;
  locked: boolean;
  created_at: string;
};

export type DailyFact = {
  id: string;
  month_id: string;
  task_id: string;
  date: string;
  actual_value: number;
  actual_score: number;
  note: string | null;
  miss_reason?: MissReason | null;
  miss_comment?: string | null;
  created_at: string;
  updated_at: string;
};

export type WeeklyReview = {
  id: string;
  user_id: string;
  month_id: string;
  week_number: number;
  start_date: string;
  end_date: string;
  worked_well: string | null;
  didnt_work: string | null;
  blockers: string | null;
  repeat_next: string | null;
  remove_next: string | null;
  lesson: string | null;
  next_week_focus: string | null;
  created_at: string;
  updated_at: string;
};

export type Goal = {
  id: string;
  user_id: string;
  life_area_id: string | null;
  title: string;
  description: string | null;
  type: GoalType;
  status: GoalStatus;
  priority: GoalPriority;
  why_text: string | null;
  target_value: number | null;
  current_value: number | null;
  unit: string | null;
  desired_identity: string | null;
  progress_mode: GoalProgressMode;
  start_date: string | null;
  due_date: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
};

export type GoalTask = {
  id: string;
  goal_id: string;
  task_id: string;
  created_at: string;
};

export type Note = {
  id: string;
  user_id: string;
  month_id: string | null;
  task_id: string | null;
  goal_id: string | null;
  date: string | null;
  title: string | null;
  content: string;
  tags: string[];
  created_at: string;
  updated_at: string;
};

export type TaskPlanningRule = {
  id: string;
  user_id: string;
  task_id: string;
  mode: PlanningRuleMode;
  weekdays: number[] | null;
  specific_dates: string[] | null;
  times_per_month: number | null;
  default_planned_value: number;
  created_at: string;
  updated_at: string;
};

export type DailyNote = {
  id: string;
  user_id: string;
  month_id: string;
  date: string;
  content: string;
  mood: string | null;
  energy: number | null;
  created_at: string;
  updated_at: string;
};

export type UserPreference = {
  id: string;
  user_id: string;
  daily_reminder_enabled: boolean;
  daily_reminder_time: string;
  risk_alerts_enabled: boolean;
  theme: ThemePreference;
  default_month_target: number;
  onboarding_completed_at: string | null;
  onboarding_mode: OnboardingMode;
  onboarding_blockers: string[];
  desired_identity: string | null;
  created_at: string;
  updated_at: string;
};

export type Experiment = {
  id: string;
  user_id: string;
  title: string;
  hypothesis: string | null;
  life_area_id: string | null;
  start_date: string;
  end_date: string;
  status: ExperimentStatus;
  success_metric: string | null;
  result_summary: string | null;
  conclusion: string | null;
  created_at: string;
  updated_at: string;
};

export type ExperimentCheckin = {
  id: string;
  experiment_id: string;
  date: string;
  value: number;
  note: string | null;
  created_at: string;
};

export type LifeEvent = {
  id: string;
  user_id: string;
  life_area_id: string | null;
  goal_id: string | null;
  title: string;
  description: string | null;
  event_date: string;
  type: LifeEventType;
  importance: LifeEventImportance;
  created_at: string;
  updated_at: string;
};

export type FinanceSnapshot = {
  id: string;
  user_id: string;
  date: string;
  income: number;
  required_expenses: number;
  optional_expenses: number;
  savings: number;
  debt_total: number;
  investments: number;
  comment: string | null;
  created_at: string;
  updated_at: string;
};

export type FinanceGoal = {
  id: string;
  user_id: string;
  title: string;
  target_amount: number;
  current_amount: number;
  due_date: string | null;
  life_area_id: string | null;
  goal_id: string | null;
  created_at: string;
  updated_at: string;
};

export type HealthLog = {
  id: string;
  user_id: string;
  date: string;
  weight: number | null;
  sleep_hours: number | null;
  energy: number | null;
  mood: string | null;
  pain_level: number | null;
  workout_done: boolean;
  steps: number | null;
  comment: string | null;
  created_at: string;
  updated_at: string;
};

export type Car = {
  id: string;
  user_id: string;
  name: string;
  brand: string | null;
  model: string | null;
  year: number | null;
  current_mileage: number;
  created_at: string;
  updated_at: string;
};

export type CarServiceItem = {
  id: string;
  user_id: string;
  car_id: string;
  name: string;
  system: CarSystem;
  last_service_date: string | null;
  last_service_mileage: number | null;
  interval_months: number | null;
  interval_km: number | null;
  comment: string | null;
  created_at: string;
  updated_at: string;
};

export type CarServiceLog = {
  id: string;
  user_id: string;
  car_id: string;
  service_item_id: string | null;
  service_date: string;
  mileage: number;
  cost: number;
  comment: string | null;
  created_at: string;
};

export type WorkProject = {
  id: string;
  user_id: string;
  title: string;
  description: string | null;
  status: WorkProjectStatus;
  start_date: string | null;
  due_date: string | null;
  created_at: string;
  updated_at: string;
};

export type WorkCase = {
  id: string;
  user_id: string;
  title: string;
  problem: string | null;
  actions: string | null;
  result: string | null;
  metrics_before: string | null;
  metrics_after: string | null;
  conclusion: string | null;
  skills: string[];
  created_at: string;
  updated_at: string;
};

export type WorkSkill = {
  id: string;
  user_id: string;
  name: string;
  level: number;
  target_level: number;
  comment: string | null;
  created_at: string;
  updated_at: string;
};

export type Team = {
  id: string;
  owner_id: string;
  name: string;
  description: string | null;
  created_at: string;
  updated_at: string;
};

export type TeamMember = {
  id: string;
  team_id: string;
  user_id: string;
  role: TeamRole;
  status: TeamMemberStatus;
  joined_at: string | null;
  created_at: string;
};

export type TeamInvite = {
  id: string;
  team_id: string;
  created_by: string;
  token: string;
  email: string | null;
  role: Exclude<TeamRole, "owner">;
  expires_at: string;
  accepted_at: string | null;
  accepted_by: string | null;
  created_at: string;
};

export type TeamGoal = {
  id: string;
  team_id: string;
  created_by: string;
  title: string;
  description: string | null;
  unit: string;
  target_value: number;
  status: TeamInitiativeStatus;
  start_date: string | null;
  due_date: string | null;
  created_at: string;
  updated_at: string;
};

export type TeamGoalContribution = {
  id: string;
  goal_id: string;
  user_id: string;
  value: number;
  note: string | null;
  date: string;
  created_at: string;
};

export type TeamChallenge = {
  id: string;
  team_id: string;
  created_by: string;
  title: string;
  description: string | null;
  unit: string;
  target_value: number;
  status: TeamChallengeStatus;
  start_date: string | null;
  due_date: string | null;
  created_at: string;
  updated_at: string;
};

export type TeamChallengeCheckin = {
  id: string;
  challenge_id: string;
  user_id: string;
  value: number;
  note: string | null;
  date: string;
  created_at: string;
};

export type TeamBoardPriority = "low" | "medium" | "high" | "urgent";
export type PersonalBoardPriority = "low" | "medium" | "high" | "urgent";
export type NotificationStatus = "unread" | "read" | "dismissed";
export type NotificationType =
  | "due_today"
  | "due_tomorrow"
  | "due_3_days"
  | "overdue"
  | "today_fact_missing"
  | "yesterday_not_closed"
  | "stale_goal_progress"
  | "weak_life_area"
  | "weekly_review_due"
  | "monthly_plan_update_due"
  | "team_challenge_ending"
  | "system";
export type ActivityVisibility = "private" | "team";

export type TeamBoard = {
  id: string;
  team_id: string;
  created_by: string;
  title: string;
  description: string | null;
  is_archived: boolean;
  created_at: string;
  updated_at: string;
};

export type TeamBoardColumn = {
  id: string;
  board_id: string;
  title: string;
  color: string;
  sort_order: number;
  created_at: string;
};

export type TeamBoardTask = {
  id: string;
  board_id: string;
  column_id: string;
  created_by: string;
  assignee_id: string | null;
  title: string;
  description: string | null;
  priority: TeamBoardPriority;
  due_date: string | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
};

export type TeamBoardComment = {
  id: string;
  task_id: string;
  author_id: string;
  content: string;
  created_at: string;
  updated_at: string;
};

export type PersonalBoard = {
  id: string;
  user_id: string;
  title: string;
  description: string | null;
  is_default: boolean;
  is_archived: boolean;
  created_at: string;
  updated_at: string;
};

export type PersonalBoardColumn = {
  id: string;
  user_id: string;
  board_id: string;
  title: string;
  color: string;
  sort_order: number;
  created_at: string;
};

export type PersonalBoardTask = {
  id: string;
  user_id: string;
  board_id: string;
  column_id: string;
  title: string;
  description: string | null;
  priority: PersonalBoardPriority;
  due_date: string | null;
  goal_id: string | null;
  habit_task_id: string | null;
  month_id: string | null;
  sort_order: number;
  is_archived: boolean;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
};

export type PersonalBoardComment = {
  id: string;
  user_id: string;
  task_id: string;
  content: string;
  created_at: string;
  updated_at: string;
};

export type NotificationSetting = {
  id: string;
  user_id: string;
  enabled: boolean;
  evening_reminder_time: string;
  remind_deadline_1d: boolean;
  remind_deadline_3d: boolean;
  remind_overdue: boolean;
  remind_weekly_review: boolean;
  quiet_mode: boolean;
  reminder_weekdays: number[];
  created_at: string;
  updated_at: string;
};

export type AppNotification = {
  id: string;
  user_id: string;
  type: NotificationType;
  title: string;
  body: string | null;
  entity_type: string | null;
  entity_id: string | null;
  action_url: string | null;
  status: NotificationStatus;
  scheduled_for: string | null;
  dedupe_key: string;
  created_at: string;
  read_at: string | null;
  dismissed_at: string | null;
};

export type ActivityEvent = {
  id: string;
  user_id: string;
  entity_type: string;
  entity_id: string | null;
  action: string;
  title: string;
  description: string | null;
  occurred_at: string;
  metadata: Record<string, unknown>;
  visibility: ActivityVisibility;
};

export type DaySummary = {
  id: string;
  user_id: string;
  month_id: string;
  date: string;
  planned_count: number;
  done_count: number;
  partial_count: number;
  overdone_count: number;
  missed_count: number;
  missing_fact_count: number;
  plan_score: number;
  fact_score: number;
  completion: number;
  main_miss_reason: MissReason | string | null;
  note: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

export type FocusSession = {
  id: string;
  user_id: string;
  task_id: string | null;
  started_at: string;
  ended_at: string | null;
  duration_minutes: number | null;
  note: string | null;
  outcome: string | null;
  created_at: string;
};

export type TrackerData = {
  profile: Profile | null;
  lifeAreas: LifeArea[];
  categories: Category[];
  tasks: Task[];
  months: Month[];
  selectedMonth: Month | null;
  plans: DailyPlan[];
  facts: DailyFact[];
  goals: Goal[];
  goalTasks: GoalTask[];
  notes: Note[];
  planningRules: TaskPlanningRule[];
  dailyNotes: DailyNote[];
  weeklyReviews: WeeklyReview[];
  experiments: Experiment[];
  experimentCheckins: ExperimentCheckin[];
  lifeEvents: LifeEvent[];
  preferences: UserPreference | null;
};
