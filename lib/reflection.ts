import { getTodayKey } from "@/lib/dates/month";
import type { DailyFact, DailyPlan, Experiment, ExperimentCheckin, MissReason, Task } from "@/types/domain";

export const missReasonLabels: Record<MissReason, string> = {
  no_time: "Не хватило времени",
  low_energy: "Не хватило энергии",
  forgot: "Забыл",
  not_important: "Задача была неважной",
  overloaded_plan: "План был перегружен",
  health: "Здоровье",
  other_priorities: "Помешали другие дела",
  no_conditions: "Не было условий",
  other: "Другое"
};

const weekdayLabels = ["Воскресенье", "Понедельник", "Вторник", "Среда", "Четверг", "Пятница", "Суббота"];

export type FailureInsights = {
  totalMisses: number;
  topReasons: Array<{ reason: MissReason; label: string; count: number }>;
  missedTasks: Array<{ taskId: string; title: string; count: number }>;
  missedWeekdays: Array<{ weekday: number; label: string; count: number }>;
};

export function calculateFailureInsights(
  plans: DailyPlan[],
  facts: DailyFact[],
  tasks: Task[],
  today: string = getTodayKey()
): FailureInsights {
  const factsByTaskDate = new Map(facts.map((fact) => [`${fact.task_id}:${fact.date}`, fact]));
  const taskTitles = new Map(tasks.map((task) => [task.id, task.title]));
  const reasonCounts = new Map<MissReason, number>();
  const taskCounts = new Map<string, number>();
  const weekdayCounts = new Map<number, number>();
  let totalMisses = 0;

  plans
    .filter((plan) => plan.planned_value > 0 && plan.date <= today)
    .forEach((plan) => {
      const fact = factsByTaskDate.get(`${plan.task_id}:${plan.date}`);
      const actualValue = fact?.actual_value ?? 0;

      if (actualValue >= plan.planned_value) {
        return;
      }

      totalMisses += 1;
      taskCounts.set(plan.task_id, (taskCounts.get(plan.task_id) ?? 0) + 1);

      const weekday = new Date(`${plan.date}T00:00:00`).getDay();
      weekdayCounts.set(weekday, (weekdayCounts.get(weekday) ?? 0) + 1);

      if (fact?.miss_reason) {
        reasonCounts.set(fact.miss_reason, (reasonCounts.get(fact.miss_reason) ?? 0) + 1);
      }
    });

  return {
    totalMisses,
    topReasons: Array.from(reasonCounts.entries())
      .map(([reason, count]) => ({ reason, label: missReasonLabels[reason], count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5),
    missedTasks: Array.from(taskCounts.entries())
      .map(([taskId, count]) => ({ taskId, title: taskTitles.get(taskId) ?? "Задача", count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5),
    missedWeekdays: Array.from(weekdayCounts.entries())
      .map(([weekday, count]) => ({ weekday, label: weekdayLabels[weekday] ?? "День", count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5)
  };
}

export type ExperimentStats = {
  totalDays: number;
  elapsedDays: number;
  doneDays: number;
  percent: number;
  daysLeft: number;
  isFinished: boolean;
  summary: string;
};

export function calculateExperimentStats(
  experiment: Experiment,
  checkins: ExperimentCheckin[],
  today: string = getTodayKey()
): ExperimentStats {
  const start = new Date(`${experiment.start_date}T00:00:00`);
  const end = new Date(`${experiment.end_date}T00:00:00`);
  const todayDate = new Date(`${today}T00:00:00`);
  const totalDays = Math.max(1, Math.floor((end.getTime() - start.getTime()) / 86_400_000) + 1);
  const elapsedDays = Math.max(0, Math.min(totalDays, Math.floor((todayDate.getTime() - start.getTime()) / 86_400_000) + 1));
  const doneDays = checkins.filter((checkin) => checkin.value > 0).length;
  const percent = totalDays > 0 ? doneDays / totalDays : 0;
  const daysLeft = Math.max(0, totalDays - elapsedDays);
  const isFinished = todayDate > end || experiment.status === "completed";

  return {
    totalDays,
    elapsedDays,
    doneDays,
    percent,
    daysLeft,
    isFinished,
    summary: isFinished
      ? percent >= 0.8
        ? "Эксперимент дал устойчивый результат. Можно закреплять в системе."
        : "Эксперимент завершен, но ритм был нестабильным. Стоит упростить условия."
      : daysLeft > 0
        ? `Осталось ${daysLeft} дн. Сейчас важно удержать простой повторяемый ритм.`
        : "Эксперимент подошел к концу. Зафиксируйте вывод и решите, что оставить."
  };
}
