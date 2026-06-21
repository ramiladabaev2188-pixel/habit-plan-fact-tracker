export type MonthStatus = "draft" | "approved" | "closed";
export type GoalType = "long_term" | "monthly" | "weekly";
export type GoalStatus = "active" | "completed" | "paused" | "archived";
export type GoalPriority = "low" | "medium" | "high";
export type ThemePreference = "light" | "dark" | "system";
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
  name: string;
  color: string;
  sort_order: number | null;
  created_at: string;
};

export type Task = {
  id: string;
  user_id: string;
  category_id: string | null;
  title: string;
  description: string | null;
  weight: number;
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
  created_at: string;
  updated_at: string;
};

export type Goal = {
  id: string;
  user_id: string;
  title: string;
  description: string | null;
  type: GoalType;
  status: GoalStatus;
  priority: GoalPriority;
  start_date: string | null;
  due_date: string | null;
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

export type TrackerData = {
  profile: Profile | null;
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
  preferences: UserPreference | null;
};
