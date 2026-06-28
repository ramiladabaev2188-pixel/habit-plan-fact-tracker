import type { DailyFact, DailyPlan, DaySummary, FocusSession, Month, Task, WeeklyReview } from "@/types/domain";
import { calculateDailyStats, calculateWeeklyReport, type WeeklyReport } from "@/lib/metrics";
import { formatPercent, formatScore } from "@/lib/utils";

export type DaySummaryInput = {
  userId: string;
  monthId: string;
  date: string;
  plans: DailyPlan[];
  facts: DailyFact[];
  tasks: Task[];
  note?: string | null;
};

export type DaySummaryDraft = Omit<DaySummary, "id" | "created_at" | "updated_at">;

export function calculateDaySummaryDraft({
  userId,
  monthId,
  date,
  plans,
  facts,
  tasks,
  note
}: DaySummaryInput): DaySummaryDraft {
  const dayPlans = plans.filter((plan) => plan.date === date && plan.planned_value > 0);
  const dayFacts = facts.filter((fact) => fact.date === date);
  const factByTask = new Map(dayFacts.map((fact) => [fact.task_id, fact]));
  const stats = calculateDailyStats(dayPlans, dayFacts, date, tasks);
  const reasonCounts = new Map<string, number>();

  let doneCount = 0;
  let partialCount = 0;
  let overdoneCount = 0;
  let missedCount = 0;
  let missingFactCount = 0;

  for (const plan of dayPlans) {
    const fact = factByTask.get(plan.task_id);

    if (!fact) {
      missingFactCount += 1;
      continue;
    }

    if (fact.actual_value >= plan.planned_value && fact.actual_value <= plan.planned_value) {
      doneCount += 1;
    } else if (fact.actual_value > plan.planned_value) {
      overdoneCount += 1;
    } else if (fact.actual_value > 0) {
      partialCount += 1;
    } else {
      missedCount += 1;
    }

    if (fact.miss_reason) {
      reasonCounts.set(fact.miss_reason, (reasonCounts.get(fact.miss_reason) ?? 0) + 1);
    }
  }

  const mainMissReason = [...reasonCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;

  return {
    user_id: userId,
    month_id: monthId,
    date,
    planned_count: dayPlans.length,
    done_count: doneCount,
    partial_count: partialCount,
    overdone_count: overdoneCount,
    missed_count: missedCount,
    missing_fact_count: missingFactCount,
    plan_score: stats.planScore,
    fact_score: stats.factScore,
    completion: stats.completion,
    main_miss_reason: mainMissReason,
    note: note?.trim() || null,
    metadata: {
      taskCount: dayPlans.length,
      factCount: dayFacts.length
    }
  };
}

export function buildDayClosedEventTitle(summary: Pick<DaySummaryDraft, "completion" | "planned_count" | "missing_fact_count">) {
  if (summary.planned_count === 0) {
    return "День закрыт без плановых задач";
  }

  if (summary.missing_fact_count > 0) {
    return `День закрыт частично: ${formatPercent(summary.completion)}`;
  }

  return `День закрыт: ${formatPercent(summary.completion)}`;
}

export function getFocusSessionDurationMinutes(startedAt: string, endedAt?: string | null, fallback?: number | null) {
  if (typeof fallback === "number" && Number.isFinite(fallback)) {
    return Math.max(0, Math.round(fallback));
  }

  if (!endedAt) {
    return null;
  }

  const start = new Date(startedAt).getTime();
  const end = new Date(endedAt).getTime();

  if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) {
    return null;
  }

  return Math.round((end - start) / 60000);
}

export function summarizeFocusSessions(sessions: FocusSession[]) {
  const totalMinutes = sessions.reduce((sum, session) => sum + (session.duration_minutes ?? 0), 0);
  const finished = sessions.filter((session) => session.ended_at || session.duration_minutes !== null).length;

  return {
    totalMinutes,
    finished,
    averageMinutes: finished > 0 ? Math.round(totalMinutes / finished) : 0
  };
}

export function buildWeeklyMarkdown(month: Month, report: WeeklyReport[], reviews: WeeklyReview[]) {
  const reviewByWeek = new Map(reviews.map((review) => [review.week_number, review]));
  const lines = [`# Недельный отчет: ${month.title}`, ""];

  for (const week of report) {
    const review = reviewByWeek.get(week.weekNumber);
    lines.push(`## Неделя ${week.weekNumber}: ${week.startDate} - ${week.endDate}`);
    lines.push(`- Выполнение: ${week.timeState === "future" ? "еще не началась" : formatPercent(week.pacePercent)}`);
    lines.push(`- Факт / план: ${formatScore(week.factScore)} / ${formatScore(week.planScore)}`);
    lines.push(`- Статус: ${week.status}`);
    lines.push(`- Комментарий: ${week.comment}`);

    if (week.weakTasks.length) {
      lines.push(`- Просели: ${week.weakTasks.map((task) => `${task.title} (${formatPercent(task.forecastPercent)})`).join(", ")}`);
    }

    if (week.strongTasks.length) {
      lines.push(`- Вытянули: ${week.strongTasks.map((task) => `${task.title} (${formatPercent(task.forecastPercent)})`).join(", ")}`);
    }

    if (review) {
      lines.push("");
      lines.push("Ручной разбор:");
      if (review.worked_well) lines.push(`- Что получилось: ${review.worked_well}`);
      if (review.didnt_work) lines.push(`- Что не получилось: ${review.didnt_work}`);
      if (review.blockers) lines.push(`- Что мешало: ${review.blockers}`);
      if (review.lesson) lines.push(`- Урок: ${review.lesson}`);
      if (review.next_week_focus) lines.push(`- Фокус дальше: ${review.next_week_focus}`);
    }

    lines.push("");
  }

  return lines.join("\n");
}

export function buildWeeklyOverview(month: Month, plans: DailyPlan[], facts: DailyFact[], tasks: Task[], reviews: WeeklyReview[]) {
  const report = calculateWeeklyReport(month, plans, facts, tasks);
  const pastWeeks = report.filter((week) => week.timeState === "past");
  const current = report.find((week) => week.timeState === "current") ?? pastWeeks[pastWeeks.length - 1] ?? report[0];
  const review = current ? reviews.find((item) => item.week_number === current.weekNumber) : null;

  return {
    report,
    currentWeek: current ?? null,
    currentReview: review ?? null,
    markdown: buildWeeklyMarkdown(month, report, reviews)
  };
}
