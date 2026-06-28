import type {
  AppNotification,
  Category,
  DailyFact,
  DailyPlan,
  Goal,
  GoalTask,
  LifeArea,
  NotificationSetting,
  NotificationType,
  Task,
  WeeklyReview
} from "@/types/domain";
import { calculateCategoryStats, calculateTaskStats } from "@/lib/metrics";
import { formatPercent, formatScore } from "@/lib/utils";

export type NotificationCandidate = Pick<
  AppNotification,
  "type" | "title" | "body" | "entity_type" | "entity_id" | "action_url" | "scheduled_for" | "dedupe_key"
>;

type GenerateNotificationInput = {
  today: string;
  selectedMonthId?: string | null;
  plans: DailyPlan[];
  facts: DailyFact[];
  tasks: Task[];
  categories: Category[];
  lifeAreas: LifeArea[];
  goals: Goal[];
  goalTasks: GoalTask[];
  weeklyReviews: WeeklyReview[];
  settings?: NotificationSetting | null;
};

export function getDefaultNotificationSettings(userId: string): NotificationSetting {
  const now = new Date().toISOString();

  return {
    id: "",
    user_id: userId,
    enabled: true,
    evening_reminder_time: "21:00",
    remind_deadline_1d: true,
    remind_deadline_3d: true,
    remind_overdue: true,
    remind_weekly_review: true,
    quiet_mode: false,
    reminder_weekdays: [1, 2, 3, 4, 5, 6, 0],
    created_at: now,
    updated_at: now
  };
}

export function generateDueNotifications({
  today,
  selectedMonthId,
  plans,
  facts,
  tasks,
  categories,
  lifeAreas,
  goals,
  goalTasks,
  weeklyReviews,
  settings
}: GenerateNotificationInput): NotificationCandidate[] {
  if (settings && (!settings.enabled || settings.quiet_mode)) {
    return [];
  }

  const weekday = new Date(`${today}T00:00:00`).getDay();
  if (settings?.reminder_weekdays?.length && !settings.reminder_weekdays.includes(weekday)) {
    return [];
  }

  const candidates: NotificationCandidate[] = [];
  const taskById = new Map(tasks.map((task) => [task.id, task]));
  const todayPlans = plans.filter((plan) => plan.date === today && plan.planned_value > 0);
  const todayFactKeys = new Set(facts.filter((fact) => fact.date === today).map((fact) => fact.task_id));
  const yesterday = shiftDate(today, -1);
  const yesterdayPlans = plans.filter((plan) => plan.date === yesterday && plan.planned_value > 0);
  const yesterdayFactKeys = new Set(facts.filter((fact) => fact.date === yesterday).map((fact) => fact.task_id));

  if (todayPlans.some((plan) => !todayFactKeys.has(plan.task_id))) {
    candidates.push({
      type: "today_fact_missing",
      title: "Факт за сегодня еще не закрыт",
      body: `Осталось заполнить ${todayPlans.filter((plan) => !todayFactKeys.has(plan.task_id)).length} плановых задач.`,
      entity_type: "day",
      entity_id: null,
      action_url: `/daily?date=${today}${selectedMonthId ? `&month=${selectedMonthId}` : ""}`,
      scheduled_for: today,
      dedupe_key: `today_fact_missing:${today}`
    });
  }

  if (yesterdayPlans.some((plan) => !yesterdayFactKeys.has(plan.task_id))) {
    candidates.push({
      type: "yesterday_not_closed",
      title: "Вчерашний день не закрыт",
      body: "Есть плановые задачи без факта. Лучше закрыть их, пока контекст свежий.",
      entity_type: "day",
      entity_id: null,
      action_url: `/daily?date=${yesterday}${selectedMonthId ? `&month=${selectedMonthId}` : ""}`,
      scheduled_for: today,
      dedupe_key: `yesterday_not_closed:${yesterday}`
    });
  }

  for (const goal of goals.filter((item) => item.status === "active" && item.due_date)) {
    const days = daysBetween(today, goal.due_date!);
    const candidate = buildDeadlineGoalNotification(goal, days, settings);

    if (candidate) {
      candidates.push(candidate);
    }
  }

  const staleGoals = goals
    .filter((goal) => goal.status === "active")
    .filter((goal) => {
      if (goal.progress_mode === "manual_value") {
        return Number(goal.current_value ?? 0) <= 0;
      }

      const linkedTaskIds = new Set(goalTasks.filter((item) => item.goal_id === goal.id).map((item) => item.task_id));
      if (!linkedTaskIds.size) return false;

      const linkedStats = calculateTaskStats(
        plans.filter((plan) => linkedTaskIds.has(plan.task_id)),
        facts.filter((fact) => linkedTaskIds.has(fact.task_id)),
        tasks.filter((task) => linkedTaskIds.has(task.id)),
        today
      );

      return linkedStats.some((stat) => stat.hasElapsedPlan && stat.pacePercent < 0.4);
    })
    .slice(0, 2);

  for (const goal of staleGoals) {
    candidates.push({
      type: "stale_goal_progress",
      title: `Цель требует внимания: ${goal.title}`,
      body: goal.progress_mode === "manual_value" ? "По цели давно не видно ручного прогресса." : "Связанные задачи идут ниже рабочего темпа.",
      entity_type: "goal",
      entity_id: goal.id,
      action_url: `/goals?status=active`,
      scheduled_for: today,
      dedupe_key: `stale_goal_progress:${goal.id}:${today}`
    });
  }

  const categoryStats = calculateCategoryStats(plans, facts, tasks, today);
  const categoryById = new Map(categories.map((category) => [category.id, category]));
  const areaById = new Map(lifeAreas.map((area) => [area.id, area]));
  const weakArea = categoryStats
    .map((stat) => {
      const category = categoryById.get(String(stat.categoryId));
      const area = category?.life_area_id ? areaById.get(category.life_area_id) : null;
      return area && stat.planScoreToDate > 0 ? { area, stat } : null;
    })
    .filter((item): item is NonNullable<typeof item> => Boolean(item))
    .sort((a, b) => a.stat.pacePercent - b.stat.pacePercent)[0];

  if (weakArea && weakArea.stat.pacePercent < 0.6) {
    candidates.push({
      type: "weak_life_area",
      title: `Проседает сфера: ${weakArea.area.name}`,
      body: `Темп по сфере ${formatPercent(weakArea.stat.pacePercent)}. Проверьте задачи с большим весом.`,
      entity_type: "life_area",
      entity_id: weakArea.area.id,
      action_url: "/growth",
      scheduled_for: today,
      dedupe_key: `weak_life_area:${weakArea.area.id}:${today}`
    });
  }

  if (settings?.remind_weekly_review !== false && shouldSuggestWeeklyReview(today, weeklyReviews)) {
    candidates.push({
      type: "weekly_review_due",
      title: "Пора сделать недельный разбор",
      body: "Коротко зафиксируйте, что сработало, что мешало и что улучшить дальше.",
      entity_type: "weekly_review",
      entity_id: null,
      action_url: selectedMonthId ? `/weekly?month=${selectedMonthId}` : "/weekly",
      scheduled_for: today,
      dedupe_key: `weekly_review_due:${today}`
    });
  }

  const overdueTask = calculateTaskStats(plans, facts, tasks, today)
    .filter((task) => task.hasElapsedPlan && task.pacePercent < 0.6)
    .sort((a, b) => b.pressureRatio - a.pressureRatio)[0];

  if (overdueTask) {
    candidates.push({
      type: "overdue",
      title: `Фокус риска: ${overdueTask.title}`,
      body: `Нужно около ${formatScore(overdueTask.requiredPerDay)} балла в день, чтобы вернуться к плану.`,
      entity_type: "task",
      entity_id: overdueTask.taskId,
      action_url: selectedMonthId ? `/daily?month=${selectedMonthId}&date=${today}` : `/daily?date=${today}`,
      scheduled_for: today,
      dedupe_key: `task_overdue:${overdueTask.taskId}:${today}`
    });
  }

  return dedupeCandidates(candidates);
}

function buildDeadlineGoalNotification(goal: Goal, days: number, settings?: NotificationSetting | null): NotificationCandidate | null {
  const base = {
    entity_type: "goal",
    entity_id: goal.id,
    action_url: "/goals",
    scheduled_for: goal.due_date,
    dedupe_key: `goal_due:${goal.id}:${goal.due_date}`
  };

  if (days === 0) {
    return {
      ...base,
      type: "due_today",
      title: `Дедлайн сегодня: ${goal.title}`,
      body: "Проверьте следующий шаг по цели."
    };
  }

  if (days === 1 && settings?.remind_deadline_1d !== false) {
    return {
      ...base,
      type: "due_tomorrow",
      title: `Дедлайн завтра: ${goal.title}`,
      body: "Есть один день, чтобы сделать минимальный полезный шаг."
    };
  }

  if (days === 3 && settings?.remind_deadline_3d !== false) {
    return {
      ...base,
      type: "due_3_days",
      title: `До цели 3 дня: ${goal.title}`,
      body: "Лучше заранее выбрать простой следующий шаг."
    };
  }

  if (days < 0 && settings?.remind_overdue !== false) {
    return {
      ...base,
      type: "overdue",
      title: `Просрочена цель: ${goal.title}`,
      body: "Можно перенести срок, упростить план или закрыть цель честным выводом.",
      dedupe_key: `goal_overdue:${goal.id}:${new Date().toISOString().slice(0, 10)}`
    };
  }

  return null;
}

function dedupeCandidates(candidates: NotificationCandidate[]) {
  return [...new Map(candidates.map((candidate) => [candidate.dedupe_key, candidate])).values()];
}

function shiftDate(dateKey: string, shift: number) {
  const [year, month, day] = dateKey.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day + shift));
  return date.toISOString().slice(0, 10);
}

function daysBetween(from: string, to: string) {
  const fromTime = new Date(`${from}T00:00:00Z`).getTime();
  const toTime = new Date(`${to}T00:00:00Z`).getTime();
  return Math.round((toTime - fromTime) / 86_400_000);
}

function shouldSuggestWeeklyReview(today: string, reviews: WeeklyReview[]) {
  const date = new Date(`${today}T00:00:00`);
  const day = date.getDay();
  if (day !== 0 && day !== 1) {
    return false;
  }

  return !reviews.some((review) => review.start_date <= today && review.end_date >= shiftDate(today, -1));
}
