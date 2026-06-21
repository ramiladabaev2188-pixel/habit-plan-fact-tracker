export type MetricTask = {
  id: string;
  category_id?: string | null;
  categoryId?: string | null;
  title?: string;
  weight: number;
};

export type MetricPlan = {
  task_id?: string;
  taskId?: string;
  date: string;
  planned_value?: number;
  plannedValue?: number;
  planned_score?: number;
  plannedScore?: number;
};

export type MetricFact = {
  task_id?: string;
  taskId?: string;
  date: string;
  actual_value?: number;
  actualValue?: number;
  actual_score?: number;
  actualScore?: number;
};

export type MetricMonth = {
  year: number;
  month: number;
};

import { getTodayKey } from "@/lib/dates/month";

export type DailyStat = {
  date: string;
  planScore: number;
  factScore: number;
  completion: number;
};

export type TaskStat = ReturnType<typeof calculateTaskStats>[number];

export type WeeklyReport = {
  weekNumber: number;
  startDate: string;
  endDate: string;
  days: string[];
  planScore: number;
  factScore: number;
  completion: number;
  pacePercent: number;
  planScoreToDate: number;
  timeState: "past" | "current" | "future";
  status: string;
  comment: string;
  weakTasks: TaskStat[];
  strongTasks: TaskStat[];
};

export type StatusLevel = "over" | "success" | "warning" | "danger" | "info";

export type CompletionStatus = {
  label: string;
  level: StatusLevel;
};

export function calculateScore(value: number, weight: number) {
  return roundMetric(value * weight);
}

export function calculateCompletion(factScore: number, planScore: number) {
  if (planScore <= 0) {
    return factScore > 0 ? 1 : 0;
  }

  return roundMetric(factScore / planScore, 6);
}

export function calculateForecast(
  currentFactScore: number,
  elapsedDays: number,
  totalPlannedDays: number,
  totalPlanScore: number
)
{
  if (elapsedDays <= 0 || totalPlannedDays <= 0 || currentFactScore <= 0) {
    return {
      forecastScore: 0,
      forecastPercent: 0
    };
  }

  const forecastScore = roundMetric((currentFactScore / elapsedDays) * totalPlannedDays);

  return {
    forecastScore,
    forecastPercent: calculateCompletion(forecastScore, totalPlanScore)
  };
}

/**
 * Forecast based on the amount of work that was actually planned up to today.
 * Unlike a calendar-day average, this stays fair when different days have
 * different workloads.
 */
export function calculatePaceForecast(
  currentFactScore: number,
  planScoreToDate: number,
  totalPlanScore: number
) {
  if (planScoreToDate <= 0 || totalPlanScore <= 0) {
    return {
      forecastScore: 0,
      forecastPercent: 0
    };
  }

  const pacePercent = calculateCompletion(currentFactScore, planScoreToDate);

  return {
    forecastScore: roundMetric(pacePercent * totalPlanScore),
    forecastPercent: pacePercent
  };
}

export function calculateRequiredPerDay(
  totalPlanScore: number,
  currentFactScore: number,
  remainingDays: number
) {
  if (remainingDays <= 0) {
    return Math.max(0, roundMetric(totalPlanScore - currentFactScore));
  }

  return roundMetric(Math.max(0, (totalPlanScore - currentFactScore) / remainingDays));
}

export function calculateDailyStats(
  plans: MetricPlan[],
  facts: MetricFact[],
  date: string,
  tasks: MetricTask[] = []
): DailyStat {
  const taskMap = createTaskMap(tasks);
  const planScore = sumScores(
    plans.filter((plan) => plan.date === date),
    (plan) => getPlanScore(plan, taskMap)
  );
  const factScore = sumScores(
    facts.filter((fact) => fact.date === date),
    (fact) => getFactScore(fact, taskMap)
  );

  return {
    date,
    planScore,
    factScore,
    completion: calculateCompletion(factScore, planScore)
  };
}

export function calculateMonthStats(
  plans: MetricPlan[],
  facts: MetricFact[],
  tasks: MetricTask[],
  today = getTodayKey()
) {
  const taskMap = createTaskMap(tasks);
  const totalPlanScore = sumScores(plans, (plan) => getPlanScore(plan, taskMap));
  const totalFactScore = sumScores(facts, (fact) => getFactScore(fact, taskMap));
  const plannedDates = getUniquePlanDates(plans, taskMap);
  const elapsedDays = plannedDates.filter((date) => date <= today).length;
  const remainingDays = plannedDates.filter((date) => date > today).length;
  const currentFactScore = sumScores(
    facts.filter((fact) => fact.date <= today),
    (fact) => getFactScore(fact, taskMap)
  );
  const planScoreToDate = sumScores(
    plans.filter((plan) => plan.date <= today),
    (plan) => getPlanScore(plan, taskMap)
  );
  const forecast = calculatePaceForecast(
    currentFactScore,
    planScoreToDate,
    totalPlanScore
  );

  return {
    totalPlanScore,
    totalFactScore,
    currentFactScore,
    planScoreToDate,
    pacePercent: forecast.forecastPercent,
    monthCompletion: calculateCompletion(currentFactScore, totalPlanScore),
    elapsedDaysWithPlan: elapsedDays,
    remainingDays,
    totalPlannedDays: plannedDates.length,
    requiredPerDay: calculateRequiredPerDay(
      totalPlanScore,
      currentFactScore,
      remainingDays
    ),
    ...forecast
  };
}

export function calculateCategoryStats(
  plans: MetricPlan[],
  facts: MetricFact[],
  tasks: MetricTask[],
  today = getTodayKey()
) {
  const taskMap = createTaskMap(tasks);
  const categoryIds = Array.from(
    new Set(tasks.map((task) => task.category_id ?? task.categoryId ?? "Без категории"))
  );

  return categoryIds.map((categoryId) => {
    const taskIds = new Set(
      tasks
        .filter((task) => (task.category_id ?? task.categoryId ?? "Без категории") === categoryId)
        .map((task) => task.id)
    );
    const categoryPlans = plans.filter((plan) => taskIds.has(getPlanTaskId(plan)));
    const categoryFacts = facts.filter((fact) => taskIds.has(getFactTaskId(fact)));
    const planScore = sumScores(categoryPlans, (plan) => getPlanScore(plan, taskMap));
    const factScore = sumScores(categoryFacts, (fact) => getFactScore(fact, taskMap));
    const planScoreToDate = sumScores(
      categoryPlans.filter((plan) => plan.date <= today),
      (plan) => getPlanScore(plan, taskMap)
    );
    const factScoreToDate = sumScores(
      categoryFacts.filter((fact) => fact.date <= today),
      (fact) => getFactScore(fact, taskMap)
    );
    const forecast = calculatePaceForecast(factScoreToDate, planScoreToDate, planScore);

    return {
      categoryId,
      planScore,
      factScore,
      completion: calculateCompletion(factScore, planScore),
      planScoreToDate,
      factScoreToDate,
      pacePercent: forecast.forecastPercent,
      ...forecast
    };
  });
}

export function calculateTaskStats(
  plans: MetricPlan[],
  facts: MetricFact[],
  tasks: MetricTask[],
  today = getTodayKey()
) {
  const taskMap = createTaskMap(tasks);

  return tasks.map((task) => {
    const taskPlans = plans.filter((plan) => getPlanTaskId(plan) === task.id);
    const taskFacts = facts.filter((fact) => getFactTaskId(fact) === task.id);
    const planScore = sumScores(taskPlans, (plan) => getPlanScore(plan, taskMap));
    const factScore = sumScores(taskFacts, (fact) => getFactScore(fact, taskMap));
    const plannedDates = getUniquePlanDates(taskPlans, taskMap);
    const remainingDays = plannedDates.filter((date) => date > today).length;
    const currentFactScore = sumScores(
      taskFacts.filter((fact) => fact.date <= today),
      (fact) => getFactScore(fact, taskMap)
    );
    const planScoreToDate = sumScores(
      taskPlans.filter((plan) => plan.date <= today),
      (plan) => getPlanScore(plan, taskMap)
    );
    const futurePlanScore = sumScores(
      taskPlans.filter((plan) => plan.date > today),
      (plan) => getPlanScore(plan, taskMap)
    );
    const forecast = calculatePaceForecast(
      currentFactScore,
      planScoreToDate,
      planScore
    );
    const requiredPerDay = calculateRequiredPerDay(planScore, currentFactScore, remainingDays);
    const baselinePerDay = remainingDays > 0 ? roundMetric(futurePlanScore / remainingDays) : 0;
    const pressureRatio =
      baselinePerDay > 0
        ? roundMetric(requiredPerDay / baselinePerDay)
        : requiredPerDay > 0
          ? 99
          : 0;

    return {
      taskId: task.id,
      categoryId: task.category_id ?? task.categoryId ?? null,
      title: task.title ?? "",
      weight: task.weight,
      planScore,
      factScore,
      completion: calculateCompletion(factScore, planScore),
      gapScore: roundMetric(Math.max(0, planScore - factScore)),
      factScoreToDate: currentFactScore,
      planScoreToDate,
      futurePlanScore,
      hasElapsedPlan: planScoreToDate > 0,
      pacePercent: forecast.forecastPercent,
      baselinePerDay,
      pressureRatio,
      requiredPerDay,
      ...forecast
    };
  });
}

export function calculateWeeklyReport(
  month: MetricMonth,
  plans: MetricPlan[],
  facts: MetricFact[],
  tasks: MetricTask[],
  today = getTodayKey()
): WeeklyReport[] {
  const weeks = getMonthWeekRanges(month.year, month.month);
  const taskMap = createTaskMap(tasks);

  return weeks.map((week, index) => {
    const dateSet = new Set(week);
    const weekPlans = plans.filter((plan) => dateSet.has(plan.date));
    const weekFacts = facts.filter((fact) => dateSet.has(fact.date));
    const planScore = sumScores(weekPlans, (plan) => getPlanScore(plan, taskMap));
    const factScore = sumScores(weekFacts, (fact) => getFactScore(fact, taskMap));
    const completion = calculateCompletion(factScore, planScore);
    const planScoreToDate = sumScores(
      weekPlans.filter((plan) => plan.date <= today),
      (plan) => getPlanScore(plan, taskMap)
    );
    const factScoreToDate = sumScores(
      weekFacts.filter((fact) => fact.date <= today),
      (fact) => getFactScore(fact, taskMap)
    );
    const timeState = week[week.length - 1] < today ? "past" : week[0] > today ? "future" : "current";
    const pacePercent = calculateCompletion(factScoreToDate, planScoreToDate);
    const taskStats =
      timeState === "future"
        ? []
        : calculateTaskStats(
            weekPlans,
            weekFacts,
            tasks,
            timeState === "past" ? week[week.length - 1] : today
          ).filter((task) => task.planScore > 0);

    return {
      weekNumber: index + 1,
      startDate: week[0],
      endDate: week[week.length - 1],
      days: week,
      planScore,
      factScore,
      completion,
      pacePercent,
      planScoreToDate,
      timeState,
      status: getWeeklyStatus(timeState === "future" ? 0 : pacePercent, planScoreToDate, timeState),
      comment: getWeeklyComment(timeState === "future" ? 0 : pacePercent, planScoreToDate, timeState),
      weakTasks: [...taskStats]
        .filter((task) => task.hasElapsedPlan && task.forecastPercent < 0.8)
        .sort((a, b) => b.pressureRatio - a.pressureRatio || a.forecastPercent - b.forecastPercent)
        .slice(0, 3),
      strongTasks: [...taskStats]
        .filter((task) => task.hasElapsedPlan && task.forecastPercent >= 0.8)
        .sort((a, b) => b.forecastPercent - a.forecastPercent)
        .slice(0, 3)
    };
  });
}

export function getCompletionStatus(percent: number): CompletionStatus {
  if (percent >= 1) {
    return { label: "🔥 Перевыполнение", level: "over" };
  }

  if (percent >= 0.8) {
    return { label: "✅ В норме", level: "success" };
  }

  if (percent >= 0.6) {
    return { label: "🟡 Нужно ускориться", level: "warning" };
  }

  return { label: "🔴 Критично", level: "danger" };
}

export function getForecastStatus(percent: number): CompletionStatus {
  if (percent >= 1) {
    return { label: "🔥 Темп выше плана", level: "over" };
  }

  if (percent >= 0.8) {
    return { label: "✅ Темп достаточный", level: "success" };
  }

  return { label: "⚠️ Риск", level: "warning" };
}

export function calculateStreaks(dailyStats: DailyStat[], today = getTodayKey()) {
  const sorted = [...dailyStats]
    .filter((stat) => stat.planScore > 0 && stat.date <= today)
    .sort((a, b) => a.date.localeCompare(b.date));

  return {
    current80: calculateCurrentStreak(sorted, 0.8),
    current90: calculateCurrentStreak(sorted, 0.9),
    best80: calculateBestStreak(sorted, 0.8),
    best90: calculateBestStreak(sorted, 0.9)
  };
}

function calculateCurrentStreak(stats: DailyStat[], threshold: number) {
  let streak = 0;

  for (let index = stats.length - 1; index >= 0; index -= 1) {
    if (stats[index].completion >= threshold) {
      streak += 1;
    } else {
      break;
    }
  }

  return streak;
}

function calculateBestStreak(stats: DailyStat[], threshold: number) {
  let current = 0;
  let best = 0;

  for (const stat of stats) {
    if (stat.completion >= threshold) {
      current += 1;
      best = Math.max(best, current);
    } else {
      current = 0;
    }
  }

  return best;
}

function createTaskMap(tasks: MetricTask[]) {
  return new Map(tasks.map((task) => [task.id, task]));
}

function getPlanTaskId(plan: MetricPlan) {
  return plan.task_id ?? plan.taskId ?? "";
}

function getFactTaskId(fact: MetricFact) {
  return fact.task_id ?? fact.taskId ?? "";
}

function getPlanValue(plan: MetricPlan) {
  return plan.planned_value ?? plan.plannedValue ?? 0;
}

function getFactValue(fact: MetricFact) {
  return fact.actual_value ?? fact.actualValue ?? 0;
}

function getPlanScore(plan: MetricPlan, taskMap: Map<string, MetricTask>) {
  return (
    plan.planned_score ??
    plan.plannedScore ??
    calculateScore(getPlanValue(plan), taskMap.get(getPlanTaskId(plan))?.weight ?? 0)
  );
}

function getFactScore(fact: MetricFact, taskMap: Map<string, MetricTask>) {
  return (
    fact.actual_score ??
    fact.actualScore ??
    calculateScore(getFactValue(fact), taskMap.get(getFactTaskId(fact))?.weight ?? 0)
  );
}

function getUniquePlanDates(plans: MetricPlan[], taskMap: Map<string, MetricTask>) {
  return Array.from(
    new Set(
      plans
        .filter((plan) => getPlanScore(plan, taskMap) > 0)
        .map((plan) => plan.date)
    )
  ).sort();
}

function sumScores<T>(items: T[], getter: (item: T) => number) {
  return roundMetric(items.reduce((sum, item) => sum + getter(item), 0));
}

function getMonthWeekRanges(year: number, month: number) {
  const daysInMonth = new Date(year, month, 0).getDate();
  const ranges: string[][] = [];

  for (let startDay = 1; startDay <= daysInMonth; startDay += 7) {
    const endDay = Math.min(startDay + 6, daysInMonth);
    const days: string[] = [];

    for (let day = startDay; day <= endDay; day += 1) {
      days.push(toMetricDateKey(year, month, day));
    }

    ranges.push(days);
  }

  return ranges;
}

function toMetricDateKey(year: number, month: number, day: number) {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function getWeeklyStatus(
  completion: number,
  planScore: number,
  timeState: WeeklyReport["timeState"]
) {
  if (timeState === "future") {
    return "◌ впереди";
  }

  if (planScore <= 0) {
    return "— нет плана";
  }

  if (completion >= 1) {
    return "🔥 отлично";
  }

  if (completion >= 0.8) {
    return "✅ нормально";
  }

  if (completion >= 0.6) {
    return "🟡 просадка";
  }

  return "🔴 провал";
}

function getWeeklyComment(
  completion: number,
  planScore: number,
  timeState: WeeklyReport["timeState"]
) {
  if (timeState === "future") {
    return "Неделя еще не началась: план уже есть, а результат появится по мере выполнения.";
  }

  if (planScore <= 0) {
    return "На этой неделе не было запланированных задач.";
  }

  if (completion >= 1) {
    return "Неделя закрыта выше плана, темп можно закрепить.";
  }

  if (completion >= 0.8) {
    return "Неделя держится в рабочем диапазоне 80%+.";
  }

  if (completion >= 0.6) {
    return "Есть заметная просадка, стоит вернуть фокус на задачи с большим весом.";
  }

  return "Неделя сильно ниже плана, нужен упрощенный план восстановления.";
}

function roundMetric(value: number, digits = 6) {
  if (!Number.isFinite(value)) {
    return 0;
  }

  const factor = 10 ** digits;
  return Math.round((value + Number.EPSILON) * factor) / factor;
}
