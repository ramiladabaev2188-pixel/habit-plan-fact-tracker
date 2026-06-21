import type { DailyStat, TaskStat, WeeklyReport } from "@/lib/metrics";

export type CategoryRisk = {
  categoryId: string;
  categoryName: string;
  completion: number;
  planScore: number;
  factScore: number;
  requiredPerDay?: number;
  forecastPercent?: number;
};

export type MonthlyInsightInput = {
  monthCompletion: number;
  forecastPercent: number;
  targetPercent?: number;
  taskStats: TaskStat[];
  categoryStats: CategoryRisk[];
  zeroFactDays: DailyStat[];
};

export function getMainFocusTask(taskStats: TaskStat[], targetPercent = 0.8) {
  const risks = getRiskTasks(taskStats, Number.POSITIVE_INFINITY, targetPercent);

  return [...risks]
    .sort((a, b) => {
      if (b.pressureRatio !== a.pressureRatio) {
        return b.pressureRatio - a.pressureRatio;
      }

      if (a.forecastPercent !== b.forecastPercent) {
        return a.forecastPercent - b.forecastPercent;
      }

      return b.planScore - a.planScore;
    })[0] ?? null;
}

export function getRiskTasks(taskStats: TaskStat[], limit = 5, targetPercent = 0.8) {
  return [...taskStats]
    .filter(
      (task) =>
        task.planScore > 0 &&
        task.hasElapsedPlan &&
        task.forecastPercent < targetPercent
    )
    .sort((a, b) => {
      if (a.pressureRatio !== b.pressureRatio) {
        return b.pressureRatio - a.pressureRatio;
      }

      if (a.forecastPercent !== b.forecastPercent) {
        return a.forecastPercent - b.forecastPercent;
      }

      return b.planScore - a.planScore;
    })
    .slice(0, limit);
}

export function getStrongTasks(taskStats: TaskStat[], limit = 5, targetPercent = 0.8) {
  return [...taskStats]
    .filter(
      (task) =>
        task.planScore > 0 &&
        task.hasElapsedPlan &&
        task.forecastPercent >= targetPercent
    )
    .sort((a, b) => b.forecastPercent - a.forecastPercent || b.planScore - a.planScore)
    .slice(0, limit);
}

export function getCategoryRisks(categoryStats: CategoryRisk[], limit = 3, targetPercent = 0.8) {
  return [...categoryStats]
    .filter(
      (category) =>
        category.planScore > 0 &&
        (category.forecastPercent ?? category.completion) < targetPercent
    )
    .sort(
      (a, b) =>
        (a.forecastPercent ?? a.completion) - (b.forecastPercent ?? b.completion)
    )
    .slice(0, limit);
}

export function generateDailyRecommendations({
  dailyStat,
  taskStats
}: {
  dailyStat: DailyStat;
  taskStats: TaskStat[];
}) {
  const recommendations: string[] = [];
  const focus = getMainFocusTask(taskStats);

  if (dailyStat.planScore <= 0) {
    recommendations.push("На сегодня нет плана — можно закрыть легкую поддерживающую задачу.");
  } else if (dailyStat.completion < 0.6) {
    recommendations.push("День сильно ниже плана — начните с одной задачи с самым большим весом.");
  } else if (dailyStat.completion < 0.8) {
    recommendations.push("До правила 80% осталось немного — доберите факт по коротким задачам.");
  } else {
    recommendations.push("День держится в норме — закрепите результат без перегруза.");
  }

  if (focus) {
    recommendations.push(`Главный фокус: ${focus.title} (${focus.requiredPerDay} балла/день).`);
  }

  return recommendations;
}

export function generateWeeklyRecommendations(week: WeeklyReport) {
  const recommendations: string[] = [];
  const pacePercent = week.pacePercent ?? week.completion;

  if (week.timeState === "future") {
    return ["Неделя впереди: не оценивайте ее как просадку до первого планового дня."];
  }

  if (week.planScore <= 0) {
    return ["В неделе нет плана — используйте ее для восстановления или подготовки."];
  }

  if (pacePercent < 0.8) {
    recommendations.push("Неделя ниже 80% — сократите лишнее и верните регулярность по базовым задачам.");
  } else {
    recommendations.push("Недельный темп рабочий — повторите текущий ритм на следующей неделе.");
  }

  if (week.weakTasks[0]) {
    recommendations.push(`Главная просадка недели: ${week.weakTasks[0].title}.`);
  }

  if (week.strongTasks[0]) {
    recommendations.push(`Сильная опора недели: ${week.strongTasks[0].title}.`);
  }

  return recommendations;
}

export function generateMonthlyInsights(stats: MonthlyInsightInput) {
  const insights: string[] = [];
  const targetPercent = stats.targetPercent ?? 0.8;
  const focus = getMainFocusTask(stats.taskStats, targetPercent);
  const categoryRisk = getCategoryRisks(stats.categoryStats, 1, targetPercent)[0];

  if (stats.forecastPercent < targetPercent) {
    insights.push("Прогноз ниже цели — нужно усилить задачи с большим весом.");
  } else {
    insights.push("Текущий темп соответствует цели: ориентируйтесь на прогноз, а не на неполный факт месяца.");
  }

  if (focus) {
    insights.push(`Главная задача на сегодня: ${focus.title} (${focus.requiredPerDay} балла/день).`);
  }

  if (categoryRisk && (categoryRisk.forecastPercent ?? categoryRisk.completion) < 0.6) {
    insights.push(`Категория ${categoryRisk.categoryName} проседает сильнее всего.`);
  }

  if (stats.zeroFactDays.length > 0) {
    insights.push(`Есть ${stats.zeroFactDays.length} дней с планом и нулевым фактом.`);
  }

  return insights;
}

export function getNextActions(stats: MonthlyInsightInput) {
  const actions: string[] = [];
  const targetPercent = stats.targetPercent ?? 0.8;
  const riskTasks = getRiskTasks(stats.taskStats, 3, targetPercent);
  const focus = getMainFocusTask(stats.taskStats, targetPercent);
  const categoryRisks = getCategoryRisks(stats.categoryStats, 2, targetPercent);

  if (focus) {
    actions.push(`Поставить первым делом задачу “${focus.title}”.`);
  }

  if (riskTasks.length > 0) {
    actions.push(`Пересобрать план по задачам риска: ${riskTasks.map((task) => task.title).join(", ")}.`);
  }

  if (categoryRisks.length > 0) {
    actions.push(`Выделить отдельный слот на категории: ${categoryRisks.map((item) => item.categoryName).join(", ")}.`);
  }

  if (stats.zeroFactDays.length > 0) {
    actions.push("Разобрать дни с нулевым фактом и записать причину в заметках.");
  }

  if (actions.length === 0) {
    actions.push("Сохранить текущий ритм и не повышать план резко.");
  }

  return actions;
}
