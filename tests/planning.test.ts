import { describe, expect, it } from "vitest";
import {
  copyMonthTemplate,
  generateDailyPlanForMonth,
  generateNTimesPerMonthPlan,
  generateSpecificWeekdaysPlan,
  generateWeekdaysPlanForMonth,
  generateWeekendsPlanForMonth,
  mergeApprovedPlanRows
} from "@/lib/planning";
import type { Month, Task, TaskPlanningRule } from "@/types/domain";

const month = {
  id: "month-1",
  year: 2026,
  month: 6
} as Month;

const task = {
  id: "task-1",
  weight: 2,
  is_active: true
} as Task;

describe("planning", () => {
  it("generates daily weighted rows for the full month", () => {
    const rows = generateDailyPlanForMonth(month, task, 1);

    expect(rows).toHaveLength(30);
    expect(rows[0]).toMatchObject({
      date: "2026-06-01",
      planned_value: 1,
      planned_score: 2
    });
  });

  it("generates weekdays and weekends separately", () => {
    expect(generateWeekdaysPlanForMonth(month, task, 1)).toHaveLength(22);
    expect(generateWeekendsPlanForMonth(month, task, 1)).toHaveLength(8);
  });

  it("generates specific weekdays", () => {
    const rows = generateSpecificWeekdaysPlan(month, task, [1, 3, 5], 1);

    expect(rows.map((row) => row.date).slice(0, 3)).toEqual([
      "2026-06-01",
      "2026-06-03",
      "2026-06-05"
    ]);
  });

  it("spreads n-times-per-month plan across the month", () => {
    const rows = generateNTimesPerMonthPlan(month, task, 4, 1);

    expect(rows).toHaveLength(4);
    expect(rows.map((row) => row.date)).toEqual([
      "2026-06-01",
      "2026-06-08",
      "2026-06-16",
      "2026-06-23"
    ]);
  });

  it("does not decrease approved plan rows", () => {
    const merged = mergeApprovedPlanRows(
      [{ month_id: "month-1", task_id: "task-1", date: "2026-06-01", planned_value: 0.5, planned_score: 1 }],
      [{ task_id: "task-1", date: "2026-06-01", planned_value: 1, planned_score: 2 }],
      true
    );

    expect(merged[0].planned_value).toBe(1);
    expect(merged[0].planned_score).toBe(2);
  });

  it("copies a month template from planning rules", () => {
    const rules = [
      {
        id: "rule-1",
        user_id: "user-1",
        task_id: "task-1",
        mode: "weekends",
        weekdays: null,
        specific_dates: null,
        times_per_month: null,
        default_planned_value: 1,
        created_at: "",
        updated_at: ""
      }
    ] satisfies TaskPlanningRule[];
    const copied = copyMonthTemplate({
      targetMonth: month,
      sourcePlans: [{ task_id: "task-1", planned_value: 1, planned_score: 2 }],
      tasks: [task],
      rules,
      options: {
        copyAllTasks: false,
        onlyActive: true,
        excludeTasksWithoutPlan: true,
        keepCategories: true,
        keepGoalLinks: true
      }
    });

    expect(copied.tasks).toHaveLength(1);
    expect(copied.rows).toHaveLength(8);
  });

  it("includes inactive tasks when the all-tasks option is selected", () => {
    const inactiveTask = { ...task, id: "task-2", is_active: false };
    const copied = copyMonthTemplate({
      targetMonth: month,
      sourcePlans: [
        { task_id: task.id, planned_value: 1, planned_score: 2 },
        { task_id: inactiveTask.id, planned_value: 1, planned_score: 2 }
      ],
      tasks: [task, inactiveTask],
      rules: [],
      options: {
        copyAllTasks: true,
        onlyActive: true,
        excludeTasksWithoutPlan: true,
        keepCategories: true,
        keepGoalLinks: true
      }
    });

    expect(copied.tasks.map((item) => item.id)).toEqual(["task-1", "task-2"]);
  });
});
