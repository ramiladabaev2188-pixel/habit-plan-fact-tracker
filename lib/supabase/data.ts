import type { User } from "@supabase/supabase-js";
import { unstable_noStore as noStore } from "next/cache";
import type {
  Category,
  Car,
  CarServiceItem,
  CarServiceLog,
  DailyFact,
  DailyNote,
  DailyPlan,
  Experiment,
  ExperimentCheckin,
  FinanceGoal,
  FinanceSnapshot,
  Goal,
  GoalTask,
  HealthLog,
  LifeEvent,
  LifeArea,
  Month,
  Note,
  Profile,
  Task,
  TaskPlanningRule,
  TrackerData,
  UserPreference,
  WeeklyReview,
  WorkCase,
  WorkProject,
  WorkSkill
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
  includeWeeklyReviews?: boolean;
  includeExperiments?: boolean;
  includeExperimentCheckins?: boolean;
  includeLifeEvents?: boolean;
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
  lifeAreaId?: string;
};

export type ExperimentPageFilters = {
  page?: number;
  pageSize?: number;
  status?: string;
  lifeAreaId?: string;
};

export type TimelinePageFilters = {
  page?: number;
  pageSize?: number;
  lifeAreaId?: string;
};

const defaultLifeAreas = [
  { name: "Здоровье", color: "#16a34a", icon: "heart-pulse", description: "Тело, сон, питание, движение и базовая энергия.", sort_order: 10 },
  { name: "Дисциплина", color: "#2563eb", icon: "shield-check", description: "Режим, регулярность, фокус и выполнение обещаний себе.", sort_order: 20 },
  { name: "Финансы", color: "#f97316", icon: "wallet", description: "Доход, навыки монетизации, учет и финансовая устойчивость.", sort_order: 30 },
  { name: "Работа/карьера", color: "#0f766e", icon: "briefcase-business", description: "Профессиональный рост, проекты и карьерная траектория.", sort_order: 40 },
  { name: "Обучение", color: "#7c3aed", icon: "book-open-check", description: "Книги, курсы, практика и развитие мышления.", sort_order: 50 },
  { name: "Семья/отношения", color: "#db2777", icon: "users-round", description: "Близость, коммуникация, вклад в семью и окружение.", sort_order: 60 },
  { name: "Вера/духовность", color: "#0891b2", icon: "sparkles", description: "Внутренний стержень, поклонение, смыслы и духовная практика.", sort_order: 70 },
  { name: "Отдых/энергия", color: "#65a30d", icon: "battery-charging", description: "Восстановление, паузы, настроение и ресурс.", sort_order: 80 }
] as const;

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

export type FinanceLoadResult = {
  snapshots: FinanceSnapshot[];
  goals: FinanceGoal[];
  error: string | null;
};

export type HealthLoadResult = {
  logs: HealthLog[];
  error: string | null;
};

export type CarLoadResult = {
  cars: Car[];
  serviceItems: CarServiceItem[];
  serviceLogs: CarServiceLog[];
  error: string | null;
};

export type WorkLoadResult = {
  projects: WorkProject[];
  cases: WorkCase[];
  skills: WorkSkill[];
  error: string | null;
};

export async function loadTrackerData(
  monthId?: string,
  options: TrackerLoadOptions = {}
): Promise<TrackerLoadResult> {
  noStore();

  const includeGoals = options.includeGoals ?? false;
  const includeNotes = options.includeNotes ?? false;
  const includeWeeklyReviews = options.includeWeeklyReviews ?? false;
  const includeExperiments = options.includeExperiments ?? false;
  const includeExperimentCheckins = options.includeExperimentCheckins ?? false;
  const includeLifeEvents = options.includeLifeEvents ?? false;
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

  await ensureDefaultLifeAreas(supabase, user.id);

  const [
    profileResult,
    lifeAreasResult,
    categoriesResult,
    tasksResult,
    monthsResult,
    planningRulesResult,
    preferencesResult
  ] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", user.id).maybeSingle(),
    supabase
      .from("life_areas")
      .select("*")
      .eq("user_id", user.id)
      .eq("is_active", true)
      .order("sort_order")
      .order("name"),
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
    lifeAreasResult.error?.message ??
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

  const [plansResult, factsResult, dailyNotesResult, goalsResult, notesResult, weeklyReviewsResult] = await Promise.all([
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
      : Promise.resolve({ data: [], error: null }),
    includeWeeklyReviews && selectedMonth
      ? supabase.from("weekly_reviews").select("*").eq("user_id", user.id).eq("month_id", selectedMonth.id)
      : Promise.resolve({ data: [], error: null })
  ]);

  const monthDataError =
    plansResult.error?.message ??
    factsResult.error?.message ??
    dailyNotesResult.error?.message ??
    goalsResult.error?.message ??
    notesResult.error?.message ??
    weeklyReviewsResult.error?.message ??
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

  const [experimentsResult, lifeEventsResult] = await Promise.all([
    includeExperiments || includeExperimentCheckins
      ? supabase
          .from("experiments")
          .select("*")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false })
          .limit(100)
      : Promise.resolve({ data: [], error: null }),
    includeLifeEvents
      ? supabase
          .from("life_events")
          .select("*")
          .eq("user_id", user.id)
          .order("event_date", { ascending: false })
          .order("created_at", { ascending: false })
          .limit(100)
      : Promise.resolve({ data: [], error: null })
  ]);

  const lifeCenterDataError = experimentsResult.error?.message ?? lifeEventsResult.error?.message ?? null;
  if (lifeCenterDataError) {
    return { configured: true, user, data: null, error: lifeCenterDataError };
  }

  const experiments = (experimentsResult.data ?? []).map(normalizeExperiment);
  const experimentIds = experiments.map((experiment) => experiment.id);
  const experimentCheckinsResult =
    includeExperimentCheckins && experimentIds.length
      ? await supabase.from("experiment_checkins").select("*").in("experiment_id", experimentIds).order("date")
      : { data: [], error: null };

  if (experimentCheckinsResult.error) {
    return { configured: true, user, data: null, error: experimentCheckinsResult.error.message };
  }

  return {
    configured: true,
    user,
    data: {
      profile: profileResult.data ? normalizeProfile(profileResult.data) : null,
      lifeAreas: (lifeAreasResult.data ?? []).map(normalizeLifeArea),
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
      weeklyReviews: (weeklyReviewsResult.data ?? []).map(normalizeWeeklyReview),
      experiments,
      experimentCheckins: (experimentCheckinsResult.data ?? []).map(normalizeExperimentCheckin),
      lifeEvents: (lifeEventsResult.data ?? []).map(normalizeLifeEvent),
      preferences: preferencesResult.data ? normalizeUserPreference(preferencesResult.data) : null
    },
    error: null
  };
}

export async function loadExperimentsPage(filters: ExperimentPageFilters) {
  noStore();
  const supabase = await createClient();
  const {
    data: { user },
    error: userError
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return {
      experiments: [] as Experiment[],
      checkins: [] as ExperimentCheckin[],
      total: 0,
      error: userError?.message ?? "Нужна авторизация"
    };
  }

  const pageSize = Math.min(Math.max(filters.pageSize ?? 12, 1), 50);
  const page = Math.max(filters.page ?? 1, 1);
  let query = supabase
    .from("experiments")
    .select("*", { count: "exact" })
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  if (["draft", "active", "completed", "archived"].includes(filters.status ?? "")) {
    query = query.eq("status", filters.status as "draft" | "active" | "completed" | "archived");
  }
  if (filters.lifeAreaId && filters.lifeAreaId !== "all") {
    query = query.eq("life_area_id", filters.lifeAreaId);
  }

  const { data, count, error } = await query.range((page - 1) * pageSize, page * pageSize - 1);
  if (error) {
    return { experiments: [] as Experiment[], checkins: [] as ExperimentCheckin[], total: 0, error: error.message };
  }

  const experiments = (data ?? []).map(normalizeExperiment);
  const ids = experiments.map((experiment) => experiment.id);
  const { data: checkins, error: checkinsError } = ids.length
    ? await supabase.from("experiment_checkins").select("*").in("experiment_id", ids).order("date")
    : { data: [], error: null };

  return {
    experiments,
    checkins: (checkins ?? []).map(normalizeExperimentCheckin),
    total: count ?? 0,
    error: checkinsError?.message ?? null
  };
}

export async function loadTimelinePage(filters: TimelinePageFilters) {
  noStore();
  const supabase = await createClient();
  const {
    data: { user },
    error: userError
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return { events: [] as LifeEvent[], total: 0, error: userError?.message ?? "Нужна авторизация" };
  }

  const pageSize = Math.min(Math.max(filters.pageSize ?? 20, 1), 80);
  const page = Math.max(filters.page ?? 1, 1);
  let query = supabase
    .from("life_events")
    .select("*", { count: "exact" })
    .eq("user_id", user.id)
    .order("event_date", { ascending: false })
    .order("created_at", { ascending: false });

  if (filters.lifeAreaId && filters.lifeAreaId !== "all") {
    query = query.eq("life_area_id", filters.lifeAreaId);
  }

  const { data, count, error } = await query.range((page - 1) * pageSize, page * pageSize - 1);
  return {
    events: (data ?? []).map(normalizeLifeEvent),
    total: count ?? 0,
    error: error?.message ?? null
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
  if (filters.lifeAreaId && filters.lifeAreaId !== "all") {
    query = query.eq("life_area_id", filters.lifeAreaId);
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

export async function loadFinancePage(): Promise<FinanceLoadResult> {
  noStore();
  const supabase = await createClient();
  const {
    data: { user },
    error: userError
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return { snapshots: [], goals: [], error: userError?.message ?? "Нужна авторизация" };
  }

  const [snapshotsResult, goalsResult] = await Promise.all([
    supabase
      .from("finance_snapshots")
      .select("*")
      .eq("user_id", user.id)
      .order("date", { ascending: false })
      .limit(12),
    supabase
      .from("finance_goals")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
  ]);

  const error = snapshotsResult.error?.message ?? goalsResult.error?.message ?? null;

  return {
    snapshots: (snapshotsResult.data ?? []).map(normalizeFinanceSnapshot),
    goals: (goalsResult.data ?? []).map(normalizeFinanceGoal),
    error
  };
}

export async function loadHealthPage(): Promise<HealthLoadResult> {
  noStore();
  const supabase = await createClient();
  const {
    data: { user },
    error: userError
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return { logs: [], error: userError?.message ?? "Нужна авторизация" };
  }

  const { data, error } = await supabase
    .from("health_logs")
    .select("*")
    .eq("user_id", user.id)
    .order("date", { ascending: false })
    .limit(60);

  return {
    logs: (data ?? []).map(normalizeHealthLog),
    error: error?.message ?? null
  };
}

export async function loadCarPage(): Promise<CarLoadResult> {
  noStore();
  const supabase = await createClient();
  const {
    data: { user },
    error: userError
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return { cars: [], serviceItems: [], serviceLogs: [], error: userError?.message ?? "Нужна авторизация" };
  }

  const { data: carsData, error: carsError } = await supabase
    .from("cars")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  if (carsError) {
    return { cars: [], serviceItems: [], serviceLogs: [], error: carsError.message };
  }

  const cars = (carsData ?? []).map(normalizeCar);
  const carIds = cars.map((car) => car.id);

  if (!carIds.length) {
    return { cars, serviceItems: [], serviceLogs: [], error: null };
  }

  const [itemsResult, logsResult] = await Promise.all([
    supabase
      .from("car_service_items")
      .select("*")
      .eq("user_id", user.id)
      .in("car_id", carIds)
      .order("created_at", { ascending: false }),
    supabase
      .from("car_service_logs")
      .select("*")
      .eq("user_id", user.id)
      .in("car_id", carIds)
      .order("service_date", { ascending: false })
      .limit(40)
  ]);

  return {
    cars,
    serviceItems: (itemsResult.data ?? []).map(normalizeCarServiceItem),
    serviceLogs: (logsResult.data ?? []).map(normalizeCarServiceLog),
    error: itemsResult.error?.message ?? logsResult.error?.message ?? null
  };
}

export async function loadWorkPage(): Promise<WorkLoadResult> {
  noStore();
  const supabase = await createClient();
  const {
    data: { user },
    error: userError
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return { projects: [], cases: [], skills: [], error: userError?.message ?? "Нужна авторизация" };
  }

  const [projectsResult, casesResult, skillsResult] = await Promise.all([
    supabase
      .from("work_projects")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false }),
    supabase
      .from("work_cases")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(20),
    supabase
      .from("work_skills")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
  ]);

  return {
    projects: (projectsResult.data ?? []).map(normalizeWorkProject),
    cases: (casesResult.data ?? []).map(normalizeWorkCase),
    skills: (skillsResult.data ?? []).map(normalizeWorkSkill),
    error: projectsResult.error?.message ?? casesResult.error?.message ?? skillsResult.error?.message ?? null
  };
}

function sanitizeSearch(value?: string) {
  return (value ?? "").replace(/[,%()]/g, " ").trim().slice(0, 120);
}

async function ensureDefaultLifeAreas(supabase: Awaited<ReturnType<typeof createClient>>, userId: string) {
  await supabase.from("life_areas").upsert(
    defaultLifeAreas.map((area) => ({
      user_id: userId,
      ...area
    })),
    { onConflict: "user_id,name" }
  );
}

export function normalizeProfile(row: Profile): Profile {
  return row;
}

export function normalizeLifeArea(row: LifeArea): LifeArea {
  return row;
}

export function normalizeCategory(row: Category): Category {
  return row;
}

export function normalizeTask(row: Task): Task {
  return {
    ...row,
    weight: Number(row.weight),
    input_mode: row.input_mode ?? "ratio",
    unit: row.unit ?? null
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
    actual_score: Number(row.actual_score),
    miss_reason: row.miss_reason ?? null,
    miss_comment: row.miss_comment ?? null
  };
}

export function normalizeWeeklyReview(row: WeeklyReview): WeeklyReview {
  return row;
}

export function normalizeGoal(row: Goal): Goal {
  return {
    ...row,
    target_value: row.target_value === null ? null : Number(row.target_value),
    current_value: row.current_value === null ? null : Number(row.current_value)
  };
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

export function normalizeExperiment(row: Experiment): Experiment {
  return row;
}

export function normalizeExperimentCheckin(row: ExperimentCheckin): ExperimentCheckin {
  return {
    ...row,
    value: Number(row.value)
  };
}

export function normalizeLifeEvent(row: LifeEvent): LifeEvent {
  return row;
}

export function normalizeFinanceSnapshot(row: FinanceSnapshot): FinanceSnapshot {
  return {
    ...row,
    income: Number(row.income),
    required_expenses: Number(row.required_expenses),
    optional_expenses: Number(row.optional_expenses),
    savings: Number(row.savings),
    debt_total: Number(row.debt_total),
    investments: Number(row.investments)
  };
}

export function normalizeFinanceGoal(row: FinanceGoal): FinanceGoal {
  return {
    ...row,
    target_amount: Number(row.target_amount),
    current_amount: Number(row.current_amount)
  };
}

export function normalizeHealthLog(row: HealthLog): HealthLog {
  return {
    ...row,
    weight: row.weight === null ? null : Number(row.weight),
    sleep_hours: row.sleep_hours === null ? null : Number(row.sleep_hours),
    energy: row.energy === null ? null : Number(row.energy),
    pain_level: row.pain_level === null ? null : Number(row.pain_level),
    steps: row.steps === null ? null : Number(row.steps)
  };
}

export function normalizeCar(row: Car): Car {
  return {
    ...row,
    year: row.year === null ? null : Number(row.year),
    current_mileage: Number(row.current_mileage)
  };
}

export function normalizeCarServiceItem(row: CarServiceItem): CarServiceItem {
  return {
    ...row,
    last_service_mileage: row.last_service_mileage === null ? null : Number(row.last_service_mileage),
    interval_months: row.interval_months === null ? null : Number(row.interval_months),
    interval_km: row.interval_km === null ? null : Number(row.interval_km)
  };
}

export function normalizeCarServiceLog(row: CarServiceLog): CarServiceLog {
  return {
    ...row,
    mileage: Number(row.mileage),
    cost: Number(row.cost)
  };
}

export function normalizeWorkProject(row: WorkProject): WorkProject {
  return row;
}

export function normalizeWorkCase(row: WorkCase): WorkCase {
  return {
    ...row,
    skills: row.skills ?? []
  };
}

export function normalizeWorkSkill(row: WorkSkill): WorkSkill {
  return {
    ...row,
    level: Number(row.level),
    target_level: Number(row.target_level)
  };
}

export function normalizeUserPreference(row: UserPreference): UserPreference {
  return {
    ...row,
    default_month_target: Number(row.default_month_target),
    onboarding_completed_at: row.onboarding_completed_at ?? null,
    onboarding_mode: row.onboarding_mode ?? "normal",
    onboarding_blockers: row.onboarding_blockers ?? [],
    desired_identity: row.desired_identity ?? null
  };
}
