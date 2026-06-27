import { getTodayKey } from "@/lib/dates/month";
import { calculateGrowthStats, type GrowthStats } from "@/lib/growth";
import { calculateDailyStats, calculateMonthStats, calculateTaskStats } from "@/lib/metrics";
import { getMainFocusTask, getRiskTasks } from "@/lib/recommendations";
import { calculateFailureInsights } from "@/lib/reflection";
import { calculateFinanceSummary, calculateHealthSummary, carStatusLabels, getCarServiceState } from "@/lib/practical";
import type {
  Car,
  CarServiceItem,
  Category,
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
  LifeArea,
  LifeEvent,
  Month,
  PersonalBoardTask,
  Task,
  WeeklyReview,
  WorkCase,
  WorkProject,
  WorkSkill
} from "@/types/domain";

export type LifeCenterRiskLevel = "info" | "warning" | "danger" | "success";

export type LifeCenterSignal = {
  id: string;
  title: string;
  detail: string;
  level: LifeCenterRiskLevel;
  href?: string;
};

export type LifeCenterGoalProgress = {
  goal: Goal;
  percent: number;
  label: string;
  source: "manual" | "tasks" | "mixed";
};

export type LifeCenterSnapshot = {
  today: string;
  developmentIndex: number;
  lifeAreaBalance: number;
  growth: GrowthStats;
  todayContribution: {
    factScore: number;
    planScore: number;
    completion: number;
  };
  nextBestStep: LifeCenterSignal;
  risks: LifeCenterSignal[];
  staleData: LifeCenterSignal[];
  disconnectedData: LifeCenterSignal[];
  goalProgress: LifeCenterGoalProgress[];
  latestEvents: LifeEvent[];
  weekFocus: string | null;
};

export type LifeCenterInput = {
  selectedMonth: Month | null;
  lifeAreas: LifeArea[];
  categories: Category[];
  tasks: Task[];
  plans: DailyPlan[];
  facts: DailyFact[];
  goals: Goal[];
  goalTasks: GoalTask[];
  weeklyReviews: WeeklyReview[];
  dailyNotes: DailyNote[];
  experiments?: Experiment[];
  experimentCheckins?: ExperimentCheckin[];
  lifeEvents?: LifeEvent[];
  financeSnapshots?: FinanceSnapshot[];
  financeGoals?: FinanceGoal[];
  healthLogs?: HealthLog[];
  cars?: Car[];
  carServiceItems?: CarServiceItem[];
  workProjects?: WorkProject[];
  workCases?: WorkCase[];
  workSkills?: WorkSkill[];
  personalBoardTasks?: PersonalBoardTask[];
  today?: string;
};

export function calculateLifeCenterSnapshot(input: LifeCenterInput): LifeCenterSnapshot {
  const today = input.today ?? getTodayKey();
  const selectedMonth = input.selectedMonth;
  const targetPercent = selectedMonth?.target_percent ?? 0.8;
  const monthStats = calculateMonthStats(input.plans, input.facts, input.tasks, today);
  const taskStats = calculateTaskStats(input.plans, input.facts, input.tasks, today).filter((task) => task.planScore > 0);
  const focusTask = getMainFocusTask(taskStats, targetPercent);
  const riskTasks = getRiskTasks(taskStats, 4, targetPercent);
  const growth = calculateGrowthStats({
    lifeAreas: input.lifeAreas,
    categories: input.categories,
    tasks: input.tasks,
    plans: input.plans,
    facts: input.facts,
    today: new Date(`${today}T00:00:00`)
  });
  const todayStats = calculateDailyStats(input.plans, input.facts, today, input.tasks);
  const latestWeeklyReview = [...input.weeklyReviews]
    .filter((review) => review.next_week_focus || review.lesson)
    .sort((a, b) => b.week_number - a.week_number)[0] ?? null;
  const failureInsights = calculateFailureInsights(input.plans, input.facts, input.tasks, today);
  const financeSummary = calculateFinanceSummary(input.financeSnapshots ?? [], input.financeGoals ?? []);
  const healthSummary = calculateHealthSummary(input.healthLogs ?? []);
  const disconnectedData = findDisconnectedData(input);
  const staleData = findStaleData(input, today);
  const goalProgress = calculateLifeCenterGoalProgress(input);

  const risks: LifeCenterSignal[] = [];
  if (selectedMonth && monthStats.forecastPercent < targetPercent) {
    risks.push({
      id: "month-forecast",
      title: "Темп ниже цели месяца",
      detail: `Прогноз ${formatPercentPlain(monthStats.forecastPercent)}, цель ${formatPercentPlain(targetPercent)}.`,
      level: monthStats.forecastPercent < 0.6 ? "danger" : "warning",
      href: "/dashboard"
    });
  }

  for (const task of riskTasks) {
    risks.push({
      id: `risk-task-${task.taskId}`,
      title: task.title,
      detail: `Темп ${formatPercentPlain(task.forecastPercent)}, нужно ${formatNumber(task.requiredPerDay)} балла в день.`,
      level: task.forecastPercent < 0.6 ? "danger" : "warning",
      href: "/daily"
    });
  }

  if (failureInsights.topReasons[0]) {
    risks.push({
      id: "top-miss-reason",
      title: "Повторяется причина срыва",
      detail: `${failureInsights.topReasons[0].label}: ${failureInsights.topReasons[0].count} раз.`,
      level: "warning",
      href: "/analytics"
    });
  }

  if (financeSummary.latest && financeSummary.monthlyFreeCash < 0) {
    risks.push({
      id: "finance-negative-cashflow",
      title: "Финансовый поток отрицательный",
      detail: "Расходы выше дохода. Это влияет на финансовые цели.",
      level: "danger",
      href: "/finance"
    });
  }

  if (healthSummary.gentleMode) {
    risks.push({
      id: "health-gentle-mode",
      title: "Нужен бережный режим",
      detail: "Энергия низкая или боль высокая. План лучше упростить, а не давить.",
      level: "warning",
      href: "/health"
    });
  }

  for (const item of findCarRisks(input.cars ?? [], input.carServiceItems ?? [])) {
    risks.push(item);
  }

  const nextBestStep =
    getPersonalBoardNextStep(input.personalBoardTasks ?? []) ??
    (focusTask
      ? {
          id: "focus-task",
          title: focusTask.title,
          detail: `Главный фокус дня: нужно ${formatNumber(focusTask.requiredPerDay)} балла в день.`,
          level: "warning" as const,
          href: "/daily"
        }
      : latestWeeklyReview?.next_week_focus
        ? {
            id: "weekly-focus",
            title: latestWeeklyReview.next_week_focus,
            detail: "Фокус взят из последнего недельного разбора.",
            level: "info" as const,
            href: "/weekly"
          }
        : {
            id: "daily-fact",
            title: "Внести факт за сегодня",
            detail: "Ежедневный ввод держит систему развития актуальной.",
            level: "success" as const,
            href: "/daily"
          });

  return {
    today,
    developmentIndex: growth.overallIndex,
    lifeAreaBalance: calculateLifeAreaBalance(growth),
    growth,
    todayContribution: {
      factScore: todayStats.factScore,
      planScore: todayStats.planScore,
      completion: todayStats.completion
    },
    nextBestStep,
    risks: uniqueSignals(risks).slice(0, 8),
    staleData,
    disconnectedData,
    goalProgress,
    latestEvents: [...(input.lifeEvents ?? [])].sort((a, b) => b.event_date.localeCompare(a.event_date)).slice(0, 5),
    weekFocus: latestWeeklyReview?.next_week_focus ?? null
  };
}

export function calculateLifeCenterGoalProgress(
  input: Pick<LifeCenterInput, "goals" | "goalTasks" | "tasks" | "plans" | "facts"> & { today?: string }
): LifeCenterGoalProgress[] {
  const taskStats = calculateTaskStats(input.plans, input.facts, input.tasks, input.today);
  const taskStatsById = new Map(taskStats.map((task) => [task.taskId, task]));
  const linkedTaskIdsByGoal = new Map<string, string[]>();

  for (const relation of input.goalTasks) {
    const ids = linkedTaskIdsByGoal.get(relation.goal_id) ?? [];
    ids.push(relation.task_id);
    linkedTaskIdsByGoal.set(relation.goal_id, ids);
  }

  return input.goals
    .filter((goal) => goal.status !== "archived")
    .map((goal) => {
      const manualPercent = goal.target_value && goal.target_value > 0
        ? Math.max(0, (goal.current_value ?? 0) / goal.target_value)
        : null;
      const linkedTaskIds = linkedTaskIdsByGoal.get(goal.id) ?? [];
      const linkedStats = linkedTaskIds.map((id) => taskStatsById.get(id)).filter(Boolean);
      const linkedPlan = linkedStats.reduce((sum, stat) => sum + (stat?.planScore ?? 0), 0);
      const linkedFact = linkedStats.reduce((sum, stat) => sum + (stat?.factScore ?? 0), 0);
      const linkedPercent = linkedPlan > 0 ? linkedFact / linkedPlan : null;
      const source: LifeCenterGoalProgress["source"] =
        goal.progress_mode === "manual_value" ? "manual" : goal.progress_mode === "mixed" ? "mixed" : "tasks";
      const percent =
        source === "manual"
          ? manualPercent ?? 0
          : source === "mixed"
            ? averageDefined([manualPercent, linkedPercent])
            : linkedPercent ?? manualPercent ?? 0;

      return {
        goal,
        percent,
        source,
        label:
          source === "manual"
            ? manualPercent === null
              ? "Добавьте числовую цель"
              : `${formatPercentPlain(manualPercent)} · ${goal.current_value ?? 0} / ${goal.target_value}${goal.unit ? ` ${goal.unit}` : ""}`
            : linkedPercent === null
              ? "Свяжите действия с целью"
              : `${formatPercentPlain(linkedPercent)} по связанным действиям`
      };
    })
    .sort((a, b) => priorityRank(b.goal.priority) - priorityRank(a.goal.priority) || a.percent - b.percent);
}

function findDisconnectedData(input: LifeCenterInput): LifeCenterSignal[] {
  const categoryById = new Map(input.categories.map((category) => [category.id, category]));
  const activeLifeAreas = new Set(input.lifeAreas.filter((area) => area.is_active).map((area) => area.id));
  const signals: LifeCenterSignal[] = [];
  const tasksWithoutCategory = input.tasks.filter((task) => task.is_active && !task.category_id).length;
  const categoriesWithoutArea = input.categories.filter((category) => !category.life_area_id || !activeLifeAreas.has(category.life_area_id)).length;
  const tasksWithoutArea = input.tasks.filter((task) => {
    const category = task.category_id ? categoryById.get(task.category_id) : null;
    return task.is_active && (!category || !category.life_area_id || !activeLifeAreas.has(category.life_area_id));
  }).length;
  const goalsWithoutArea = input.goals.filter((goal) => goal.status === "active" && !goal.life_area_id).length;
  const boardTasksWithoutLinks = (input.personalBoardTasks ?? []).filter((task) => !task.is_archived && !task.goal_id && !task.habit_task_id && !task.month_id).length;

  if (tasksWithoutCategory) {
    signals.push({
      id: "tasks-without-category",
      title: "Есть действия без категории",
      detail: `${tasksWithoutCategory} активных действий не участвуют в карте сфер.`,
      level: "warning",
      href: "/planner"
    });
  }
  if (categoriesWithoutArea) {
    signals.push({
      id: "categories-without-area",
      title: "Категории не связаны со сферами",
      detail: `${categoriesWithoutArea} категорий не влияют на индекс развития.`,
      level: "warning",
      href: "/growth"
    });
  }
  if (tasksWithoutArea && !categoriesWithoutArea) {
    signals.push({
      id: "tasks-without-area",
      title: "Действия не попадают в сферы",
      detail: `${tasksWithoutArea} активных действий требуют связи со сферой.`,
      level: "warning",
      href: "/growth"
    });
  }
  if (goalsWithoutArea) {
    signals.push({
      id: "goals-without-area",
      title: "Цели без сферы жизни",
      detail: `${goalsWithoutArea} активных целей сложнее связать с развитием.`,
      level: "info",
      href: "/goals"
    });
  }
  if (boardTasksWithoutLinks) {
    signals.push({
      id: "board-tasks-without-links",
      title: "Задачи доски живут отдельно",
      detail: `${boardTasksWithoutLinks} задач не связаны с целью, привычкой или месяцем.`,
      level: "info",
      href: "/tasks"
    });
  }

  return signals;
}

function findStaleData(input: LifeCenterInput, today: string): LifeCenterSignal[] {
  const signals: LifeCenterSignal[] = [];
  const latestHealthDate = latestDate((input.healthLogs ?? []).map((log) => log.date));
  const latestFinanceDate = latestDate((input.financeSnapshots ?? []).map((snapshot) => snapshot.date));
  const latestWorkDate = latestDate([
    ...(input.workProjects ?? []).map((item) => item.updated_at.slice(0, 10)),
    ...(input.workCases ?? []).map((item) => item.updated_at.slice(0, 10)),
    ...(input.workSkills ?? []).map((item) => item.updated_at.slice(0, 10))
  ]);

  if (!latestFinanceDate || daysBetween(latestFinanceDate, today) > 31) {
    signals.push({
      id: "stale-finance",
      title: "Финансы давно не обновлялись",
      detail: latestFinanceDate ? `Последний снимок: ${latestFinanceDate}.` : "Нет финансового снимка.",
      level: "info",
      href: "/finance"
    });
  }
  if (!latestHealthDate || daysBetween(latestHealthDate, today) > 7) {
    signals.push({
      id: "stale-health",
      title: "Здоровье давно не обновлялось",
      detail: latestHealthDate ? `Последняя запись: ${latestHealthDate}.` : "Нет записей по здоровью.",
      level: "info",
      href: "/health"
    });
  }
  if (!latestWorkDate || daysBetween(latestWorkDate, today) > 30) {
    signals.push({
      id: "stale-work",
      title: "Рабочий рост без свежих данных",
      detail: latestWorkDate ? `Последнее обновление: ${latestWorkDate}.` : "Нет проектов, кейсов или навыков.",
      level: "info",
      href: "/work"
    });
  }

  return signals;
}

function findCarRisks(cars: Car[], items: CarServiceItem[]): LifeCenterSignal[] {
  const carsById = new Map(cars.map((car) => [car.id, car]));
  const signals: LifeCenterSignal[] = [];

  for (const item of items) {
    const car = carsById.get(item.car_id);
    if (!car) {
      continue;
    }

    const state = getCarServiceState(item, car);
    if (state.status !== "overdue" && state.status !== "soon") {
      continue;
    }

    signals.push({
      id: `car-${item.id}`,
      title: item.name,
      detail: `${car.name}: ${carStatusLabels[state.status]}.`,
      level: state.status === "overdue" ? "danger" : "warning",
      href: "/car"
    });
  }

  return signals.slice(0, 3);
}

function getPersonalBoardNextStep(tasks: PersonalBoardTask[]): LifeCenterSignal | null {
  const activeTasks = tasks
    .filter((task) => !task.is_archived && !task.completed_at)
    .sort((a, b) => priorityRank(b.priority) - priorityRank(a.priority) || dueDateRank(a.due_date) - dueDateRank(b.due_date));
  const task = activeTasks[0];

  if (!task) {
    return null;
  }

  return {
    id: `board-task-${task.id}`,
    title: task.title,
    detail: task.due_date ? `Важная задача до ${task.due_date}.` : "Важная задача из личной доски.",
    level: task.priority === "urgent" || task.priority === "high" ? "warning" : "info",
    href: "/tasks"
  };
}

function calculateLifeAreaBalance(growth: GrowthStats) {
  const active = growth.areas.filter((area) => area.planScore > 0);
  if (active.length <= 1) {
    return active.length;
  }

  const values = active.map((area) => Math.min(area.completion, 1));
  const average = values.reduce((sum, value) => sum + value, 0) / values.length;
  const variance = values.reduce((sum, value) => sum + (value - average) ** 2, 0) / values.length;
  const spreadPenalty = Math.sqrt(variance);

  return Math.max(0, Math.min(1, average - spreadPenalty));
}

function latestDate(values: string[]) {
  return values.filter(Boolean).sort((a, b) => b.localeCompare(a))[0] ?? null;
}

function daysBetween(from: string, to: string) {
  const start = new Date(`${from}T00:00:00`).getTime();
  const end = new Date(`${to}T00:00:00`).getTime();
  return Math.floor((end - start) / 86_400_000);
}

function averageDefined(values: Array<number | null>) {
  const defined = values.filter((value): value is number => typeof value === "number" && Number.isFinite(value));
  if (!defined.length) {
    return 0;
  }

  return defined.reduce((sum, value) => sum + value, 0) / defined.length;
}

function priorityRank(priority: string | null) {
  switch (priority) {
    case "urgent":
      return 4;
    case "high":
      return 3;
    case "medium":
      return 2;
    case "low":
      return 1;
    default:
      return 0;
  }
}

function dueDateRank(date: string | null) {
  return date ? new Date(`${date}T00:00:00`).getTime() : Number.MAX_SAFE_INTEGER;
}

function uniqueSignals(signals: LifeCenterSignal[]) {
  const seen = new Set<string>();
  return signals.filter((signal) => {
    if (seen.has(signal.id)) {
      return false;
    }

    seen.add(signal.id);
    return true;
  });
}

function formatPercentPlain(value: number) {
  return `${Math.round(Math.max(0, value) * 100)}%`;
}

function formatNumber(value: number) {
  if (!Number.isFinite(value)) {
    return "0";
  }

  return new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 1 }).format(value);
}
