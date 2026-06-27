import { describe, expect, it } from "vitest";
import { findMissingFacts, findZeroFactPlannedDays } from "@/lib/checks";
import { toDateKey } from "@/lib/dates/month";
import type { DailyFact, DailyPlan, Month } from "@/types/domain";

const month = { id: "month-1" } as Month;

function dateFromToday(offset: number) {
  const date = new Date();
  date.setDate(date.getDate() + offset);
  return toDateKey(date);
}

function plan(taskId: string, date: string): DailyPlan {
  return {
    id: `${taskId}-${date}`,
    month_id: month.id,
    task_id: taskId,
    date,
    planned_value: 1,
    planned_score: 1,
    locked: false,
    created_at: ""
  };
}

function fact(taskId: string, date: string, actualScore = 1): DailyFact {
  return {
    id: `${taskId}-${date}`,
    month_id: month.id,
    task_id: taskId,
    date,
    actual_value: actualScore,
    actual_score: actualScore,
    note: null,
    miss_reason: null,
    miss_comment: null,
    created_at: "",
    updated_at: ""
  };
}

describe("data quality checks", () => {
  it("groups missing facts by past date and ignores future plan", () => {
    const past = dateFromToday(-1);
    const future = dateFromToday(3);

    const issues = findMissingFacts(month, [plan("task-1", past), plan("task-2", past), plan("task-3", future)], []);

    expect(issues).toHaveLength(1);
    expect(issues[0].id).toBe(`missing-${past}`);
    expect(issues[0].description).toContain("2");
  });

  it("does not mark future planned dates as zero-fact failures", () => {
    const past = dateFromToday(-1);
    const future = dateFromToday(3);

    const issues = findZeroFactPlannedDays(month, [plan("task-1", past), plan("task-2", future)], [fact("task-1", past, 0)]);

    expect(issues.map((issue) => issue.href)).toEqual([`/daily?month=${month.id}&date=${past}`]);
  });
});
