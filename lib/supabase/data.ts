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

export async function loadTrackerData(monthId?: string): Promise<TrackerLoadResult> {
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

  const [
    profileResult,
    categoriesResult,
    tasksResult,
    monthsResult,
    goalsResult,
    goalTasksResult,
    notesResult,
    planningRulesResult,
    dailyNotesResult,
    preferencesResult
  ] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", user.id).maybeSingle(),
    supabase.from("categories").select("*").eq("user_id", user.id).order("sort_order").order("name"),
    supabase.from("tasks").select("*").eq("user_id", user.id).order("created_at"),
    supabase
      .from("months")
      .select("*")
      .eq("user_id", user.id)
      .order("year", { ascending: false })
      .order("month", { ascending: false }),
    supabase.from("goals").select("*").eq("user_id", user.id).order("created_at", { ascending: false }),
    supabase.from("goal_tasks").select("*"),
    supabase.from("notes").select("*").eq("user_id", user.id).order("created_at", { ascending: false }),
    supabase.from("task_planning_rules").select("*").eq("user_id", user.id),
    supabase.from("daily_notes").select("*").eq("user_id", user.id).order("date", { ascending: false }),
    supabase.from("user_preferences").select("*").eq("user_id", user.id).maybeSingle()
  ]);

  const error =
    profileResult.error?.message ??
    categoriesResult.error?.message ??
    tasksResult.error?.message ??
    monthsResult.error?.message ??
    goalsResult.error?.message ??
    goalTasksResult.error?.message ??
    notesResult.error?.message ??
    planningRulesResult.error?.message ??
    dailyNotesResult.error?.message ??
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

  const [plansResult, factsResult] = selectedMonth
    ? await Promise.all([
        supabase
          .from("daily_plans")
          .select("*")
          .eq("month_id", selectedMonth.id)
          .order("date"),
        supabase
          .from("daily_facts")
          .select("*")
          .eq("month_id", selectedMonth.id)
          .order("date")
      ])
    : [
        { data: [], error: null },
        { data: [], error: null }
      ];

  const monthDataError = plansResult.error?.message ?? factsResult.error?.message ?? null;

  if (monthDataError) {
    return { configured: true, user, data: null, error: monthDataError };
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
      goals: (goalsResult.data ?? []).map(normalizeGoal),
      goalTasks: (goalTasksResult.data ?? []).map(normalizeGoalTask),
      notes: (notesResult.data ?? []).map(normalizeNote),
      planningRules: (planningRulesResult.data ?? []).map(normalizePlanningRule),
      dailyNotes: (dailyNotesResult.data ?? []).map(normalizeDailyNote),
      preferences: preferencesResult.data ? normalizeUserPreference(preferencesResult.data) : null
    },
    error: null
  };
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
