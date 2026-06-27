import { describe, expect, it } from "vitest";
import { calculateExperimentStats, calculateFailureInsights } from "@/lib/reflection";
import type { DailyFact, DailyPlan, Experiment, ExperimentCheckin, Task } from "@/types/domain";

const tasks = [
  {
    id: "task-1",
    user_id: "user-1",
    category_id: "cat-1",
    title: "Прогулка",
    description: null,
    weight: 2,
    is_active: true,
    created_at: "2026-06-01",
    updated_at: "2026-06-01"
  },
  {
    id: "task-2",
    user_id: "user-1",
    category_id: "cat-1",
    title: "Чтение",
    description: null,
    weight: 1,
    is_active: true,
    created_at: "2026-06-01",
    updated_at: "2026-06-01"
  }
] satisfies Task[];

const plans = [
  {
    id: "plan-1",
    month_id: "month-1",
    task_id: "task-1",
    date: "2026-06-01",
    planned_value: 1,
    planned_score: 2,
    locked: false,
    created_at: "2026-06-01"
  },
  {
    id: "plan-2",
    month_id: "month-1",
    task_id: "task-2",
    date: "2026-06-02",
    planned_value: 1,
    planned_score: 1,
    locked: false,
    created_at: "2026-06-01"
  }
] satisfies DailyPlan[];

const facts = [
  {
    id: "fact-1",
    month_id: "month-1",
    task_id: "task-1",
    date: "2026-06-01",
    actual_value: 0.5,
    actual_score: 1,
    note: null,
    miss_reason: "low_energy",
    miss_comment: "После тяжелого дня",
    created_at: "2026-06-01",
    updated_at: "2026-06-01"
  }
] satisfies DailyFact[];

describe("reflection", () => {
  it("counts failure reasons, tasks and weekdays", () => {
    const insights = calculateFailureInsights(plans, facts, tasks, "2026-06-03");

    expect(insights.totalMisses).toBe(2);
    expect(insights.topReasons[0]).toMatchObject({ reason: "low_energy", count: 1 });
    expect(insights.missedTasks[0].title).toBe("Прогулка");
    expect(insights.missedWeekdays.length).toBeGreaterThan(0);
  });

  it("calculates experiment progress without external APIs", () => {
    const experiment = {
      id: "experiment-1",
      user_id: "user-1",
      title: "7 дней чтения",
      hypothesis: null,
      life_area_id: null,
      start_date: "2026-06-01",
      end_date: "2026-06-07",
      status: "active",
      success_metric: null,
      result_summary: null,
      conclusion: null,
      created_at: "2026-06-01",
      updated_at: "2026-06-01"
    } satisfies Experiment;
    const checkins = [
      { id: "check-1", experiment_id: experiment.id, date: "2026-06-01", value: 1, note: null, created_at: "2026-06-01" },
      { id: "check-2", experiment_id: experiment.id, date: "2026-06-02", value: 0, note: null, created_at: "2026-06-02" },
      { id: "check-3", experiment_id: experiment.id, date: "2026-06-03", value: 1, note: null, created_at: "2026-06-03" }
    ] satisfies ExperimentCheckin[];

    const stats = calculateExperimentStats(experiment, checkins, "2026-06-04");

    expect(stats.totalDays).toBe(7);
    expect(stats.doneDays).toBe(2);
    expect(stats.daysLeft).toBe(3);
    expect(stats.percent).toBeCloseTo(2 / 7);
  });
});
