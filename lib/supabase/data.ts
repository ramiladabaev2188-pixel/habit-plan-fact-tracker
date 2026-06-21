import type { User } from "@supabase/supabase-js";
import { unstable_noStore as noStore } from "next/cache";
import type {
  Category,
  DailyFact,
  DailyNote,
  DailyPlan,
  Goal,
  GoalTask,
  Month,
  Note,
  Profile,
  Task,
  TaskPlanningRule,
  TrackerData,
  UserPreference
} from "@/types/domain";
import { isSupabaseConfigured } from "./env";
import { createClient } from "./server";

export type TrackerLoadResult =
  | {
      configured: false;
      user: null;
      data: null;
      error: null;
    }
  | {
      configured: true;
      user: User | null;
      data: TrackerData | null;
      error: string | null;
    };

export type TrackerLoadOptions = {
  includeGoals?: boolean;
  includeNotes?: boolean;
  dailyNotesScope?: "none" | "selected-month" | "all";
};

export type NotePageFilters = {
  page?: number;
  pageSize?: number;
  query?: string;
  date?: string;
  monthId?: string;
  taskId?: string;
  goalId?: string;
  tag?: string;
};

export type GoalPageFilters = {
  page?: number;
  pageSize?: number;
  status?: string;
  type?: string;
  priority?: string;
};

export type HistoryPageOptions = {
  page?: number;
  pageSize?: number;
  chartMonthsLimit?: number;
};

export type HistoryLoadResult =
  | { configured: false; user: null; data: null; error: null }
  | {
      configured: true;
      user: User | null;
      data: {
        months: Month[];
        chartMonths: Month[];
        tasks: Task[];
        plans: DailyPlan[];
        facts: DailyFact[];
        total: number;
      } | null;
      error: string | null;
    };

export async function loadTrackerData(
  monthId?: string,
  options: TrackerLoadOptions = {}
): Promise<TrackerLoadResult> {
  noStore();

  const includeGoals = options.includeGoals ?? false;
  const includeNotes = options.includeNotes ?? false;
  const dailyNotesScope = options.dailyNotesScope ?? "selected-month";

  if (!isSupabaseConfigured()) {
    return { configured: false, user: null, data: null, error: null };
  }

  const supabase = await createClient();
  const {
    data: { user },
    error: userError
  } = await supabase.auth.getUser();

  if (userError) {
    return { configured: true, user: null, data: null, error: userError.message };
  }

  if (!user) {
    return { configured: true, user: null, data: null, error: null };
  }

  await supabase.from("profiles").upsert({
    id: user.id,
    email: user.email ?? null,
    name: user.user_metadata?.name ?? user.email?.split("@")[0] ?? "Пользователь",
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone
  });

  await supabase.from("user_preferences").upsert(
    {
      user_id: user.id
    },
    { onConflict: "user_id" }
  );

  const [profileResult, categoriesResult, tasksResult, monthsResult, planningRulesResult, preferencesResult] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", user.id).maybeSingle(),
    supabase.from("categories").select("*").eq("user_id", user.id).order("sort_order").order("name"),
    supabase.from("tasks").select("*").eq("user_id", user.id).order("created_at"),
    supabase
      .from("months")
      .select("*")
      .eq("user_id", user.id)
      .order("year", { ascending: false })
      .order("month", { ascending: false }),
    supabase.from("task_planning_rules").select("*").eq("user_id", user.id),
    supabase.from("user_preferences").select("*").eq("user_id", user.id).maybeSingle()
  ]);

  const error =
    profileResult.error?.message ??
    categoriesResult.error?.message ??
    tasksResult.error?.message ??
    monthsResult.error?.message ??
    planningRulesResult.error?.message ??
    preferencesResult.error?.message ??
    null;

  if (error) {
    return { configured: true, user, data: null, error };
  }

  const months = (monthsResult.data ?? []).map(normalizeMonth);
  const selectedMonth =
    months.find((month) => month.id === monthId) ??
    months.find((month) => {
      const now = new Date();
      return month.year === now.getFullYear() && month.month === now.getMonth() + 1;
    }) ??
    months[0] ??
    null;

  const [plansResult, factsResult, dailyNotesResult, goalsResult, notesResult] = await Promise.all([
    selectedMonth
      ? supabase
          .from("daily_plans")
          .select("*")
          .eq("month_id", selectedMonth.id)
          .order("date")
      : Promise.resolve({ data: [], error: null }),
    selectedMonth
      ? supabase
          .from("daily_facts")
          .select("*")
          .eq("month_id", selectedMonth.id)
          .order("date")
      : Promise.resolve({ data: [], error: null }),
    dailyNotesScope === "all"
      ? supabase.from("daily_notes").select("*").eq("user_id", user.id).order("date", { ascending: false })
      : dailyNotesScope === "selected-month" && selectedMonth
        ? supabase
            .from("daily_notes")
            .select("*")
            .eq("user_id", user.id)
            .eq("month_id", selectedMonth.id)
            .order("date", { ascending: false })
        : Promise.resolve({ data: [], error: null }),
    includeGoals
      ? supabase.from("goals").select("*").eq("user_id", user.id).order("created_at", { ascending: false })
      : Promise.resolve({ data: [], error: null }),
    includeNotes
      ? supabase.from("notes").select("*").eq("user_id", user.id).order("created_at", { ascending: false })
      : Promise.resolve({ data: [], error: null })
  ]);

  const monthDataError =
    plansResult.error?.message ??
    factsResult.error?.message ??
    dailyNotesResult.error?.message ??
    goalsResult.error?.message ??
    notesResult.error?.message ??
    null;

  if (monthDataError) {
    return { configured: true, user, data: null, error: monthDataError };
  }

  const goals = (goalsResult.data ?? []).map(normalizeGoal);
  const goalIds = goals.map((goal) => goal.id);
  const goalTasksResult = includeGoals && goalIds.length
    ? await supabase.from("goal_tasks").select("*").in("goal_id", goalIds)
    : { data: [], error: null };

  if (goalTasksResult.error) {
    return { configured: true, user, data: null, error: goalTasksResult.error.message };
  }

  return {
    configured: true,
    user,
    data: {
      profile: profileResult.data ? normalizeProfile(profileResult.data) : null,
      categories: (categoriesResult.data ?? []).map(normalizeCategory),
      tasks: (tasksResult.data ?? []).map(normalizeTask),
      months,
      selectedMonth,
      plans: (plansResult.data ?? []).map(normalizeDailyPlan),
      facts: (factsResult.data ?? []).map(normalizeDailyFact),
      goals,
      goalTasks: (goalTasksResult.data ?? []).map(normalizeGoalTask),
      notes: (notesResult.data ?? []).map(normalizeNote),
      planningRules: (planningRulesResult.data ?? []).map(normalizePlanningRule),
      dailyNotes: (dailyNotesResult.data ?? []).map(normalizeDailyNote),
      preferences: preferencesResult.data ? normalizeUserPreference(preferencesResult.data) : null
    },
    error: null
  };
}

export async function loadNotesPage(filters: NotePageFilters) {
  noStore();
  const supabase = await createClient();
  const {
    data: { user },
    error: userError
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return { notes: [] as Note[], total: 0, error: userError?.message ?? "Нужна авторизация" };
  }

  const pageSize = Math.min(Math.max(filters.pageSize ?? 10, 1), 50);
  const page = Math.max(filters.page ?? 1, 1);
  let query = supabase
    .from("notes")
    .select("*", { count: "exact" })
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  const search = sanitizeSearch(filters.query);
  if (search) {
    query = query.or(`title.ilike.%${search}%,content.ilike.%${search}%`);
  }
  if (filters.date) query = query.eq("date", filters.date);
  if (filters.monthId) query = query.eq("month_id", filters.monthId);
  if (filters.taskId) query = query.eq("task_id", filters.taskId);
  if (filters.goalId) query = query.eq("goal_id", filters.goalId);
  if (filters.tag) query = query.contains("tags", [filters.tag]);

  const { data, count, error } = await query.range((page - 1) * pageSize, page * pageSize - 1);
  return {
    notes: (data ?? []).map(normalizeNote),
    total: count ?? 0,
    error: error?.message ?? null
  };
}

export async function loadGoalsPage(filters: GoalPageFilters) {
  noStore();
  const supabase = await createClient();
  const {
    data: { user },
    error: userError
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return { goals: [] as Goal[], goalTasks: [] as GoalTask[], total: 0, error: userError?.message ?? "Нужна авторизация" };
  }

  const pageSize = Math.min(Math.max(filters.pageSize ?? 10, 1), 50);
  const page = Math.max(filters.page ?? 1, 1);
  let query = supabase
    .from("goals")
    .select("*", { count: "exact" })
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  if (["active", "completed", "paused", "archived"].includes(filters.status ?? "")) {
    query = query.eq("status", filters.status as "active" | "completed" | "paused" | "archived");
  }
  if (["long_term", "monthly", "weekly"].includes(filters.type ?? "")) {
    query = query.eq("type", filters.type as "long_term" | "monthly" | "weekly");
  }
  if (["low", "medium", "high"].includes(filters.priority ?? "")) {
    query = query.eq("priority", filters.priority as "low" | "medium" | "high");
  }

  const { data, count, error } = await query.range((page - 1) * pageSize, page * pageSize - 1);
  if (error) {
    return { goals: [] as Goal[], goalTasks: [] as GoalTask[], total: 0, error: error.message };
  }

  const goals = (data ?? []).map(normalizeGoal);
  const goalIds = goals.map((goal) => goal.id);
  const { data: goalTasks, error: goalTasksError } = goalIds.length
    ? await supabase.from("goal_tasks").select("*").in("goal_id", goalIds)
    : { data: [], error: null };

  return {
    goals,
    goalTasks: (goalTasks ?? []).map(normalizeGoalTask),
    total: count ?? 0,
    error: goalTasksError?.message ?? null
  };
}

export async function loadHistoryPage(options: HistoryPageOptions = {}): Promise<HistoryLoadResult> {
  noStore();

  if (!isSupabaseConfigured()) {
    return { configured: false, user: null, data: null, error: null };
  }

  const supabase = await createClient();
  const {
    data: { user },
    error: userError
  } = await supabase.auth.getUser();

  if (userError) {
    return { configured: true, user: null, data: null, error: userError.message };
  }
  if (!user) {
    return { configured: true, user: null, data: null, error: null };
  }

  const pageSize = Math.min(Math.max(options.pageSize ?? 8, 1), 24);
  const page = Math.max(options.page ?? 1, 1);
  const chartMonthsLimit = Math.min(Math.max(options.chartMonthsLimit ?? 12, 1), 24);
  const [monthsResult, chartMonthsResult, tasksResult] = await Promise.all([
    supabase
      .from("months")
      .select("*", { count: "exact" })
      .eq("user_id", user.id)
      .order("year", { ascending: false })
      .order("month", { ascending: false })
      .range((page - 1) * pageSize, page * pageSize - 1),
    supabase
      .from("months")
      .select("*")
      .eq("user_id", user.id)
      .order("year", { ascending: false })
      .order("month", { ascending: false })
      .limit(chartMonthsLimit),
    supabase.from("tasks").select("*").eq("user_id", user.id).order("created_at")
  ]);

  const baseError = monthsResult.error?.message ?? chartMonthsResult.error?.message ?? tasksResult.error?.message ?? null;
  if (baseError) {
    return { configured: true, user, data: null, error: baseError };
  }

  const months = (monthsResult.data ?? []).map(normalizeMonth);
  const chartMonths = (chartMonthsResult.data ?? []).map(normalizeMonth);
  const monthIds = Array.from(new Set([...months, ...chartMonths].map((month) => month.id)));
  const [plansResult, factsResult] = monthIds.length
    ? await Promise.all([
        supabase.from("daily_plans").select("*").in("month_id", monthIds).order("date"),
        supabase.from("daily_facts").select("*").in("month_id", monthIds).order("date")
      ])
    : [{ data: [], error: null }, { data: [], error: null }];

  const dataError = plansResult.error?.message ?? factsResult.error?.message ?? null;
  if (dataError) {
    return { configured: true, user, data: null, error: dataError };
  }

  return {
    configured: true,
    user,
    data: {
      months,
      chartMonths,
      tasks: (tasksResult.data ?? []).map(normalizeTask),
      plans: (plansResult.data ?? []).map(normalizeDailyPlan),
      facts: (factsResult.data ?? []).map(normalizeDailyFact),
      total: monthsResult.count ?? 0
    },
    error: null
  };
}

function sanitizeSearch(value?: string) {
  return (value ?? "").replace(/[,%()]/g, " ").trim().slice(0, 120);
}

export function normalizeProfile(row: Profile): Profile {
  return row;
}

export function normalizeCategory(row: Category): Category {
  return row;
}

export function normalizeTask(row: Task): Task {
  return {
    ...row,
    weight: Number(row.weight)
  };
}

export function normalizeMonth(row: Month): Month {
  return {
    ...row,
    target_percent: Number(row.target_percent)
  };
}

export function normalizeDailyPlan(row: DailyPlan): DailyPlan {
  return {
    ...row,
    planned_value: Number(row.planned_value),
    planned_score: Number(row.planned_score)
  };
}

export function normalizeDailyFact(row: DailyFact): DailyFact {
  return {
    ...row,
    actual_value: Number(row.actual_value),
    actual_score: Number(row.actual_score)
  };
}

export function normalizeGoal(row: Goal): Goal {
  return row;
}

export function normalizeGoalTask(row: GoalTask): GoalTask {
  return row;
}

export function normalizeNote(row: Note): Note {
  return {
    ...row,
    tags: row.tags ?? []
  };
}

export function normalizePlanningRule(row: TaskPlanningRule): TaskPlanningRule {
  return {
    ...row,
    default_planned_value: Number(row.default_planned_value),
    times_per_month: row.times_per_month === null ? null : Number(row.times_per_month)
  };
}

export function normalizeDailyNote(row: DailyNote): DailyNote {
  return row;
}

export function normalizeUserPreference(row: UserPreference): UserPreference {
  return {
    ...row,
    default_month_target: Number(row.default_month_target)
  };
}
