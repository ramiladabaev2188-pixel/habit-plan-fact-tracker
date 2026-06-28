import { describe, expect, it } from "vitest";
import {
  buildDayClosedEventTitle,
  buildWeeklyMarkdown,
  calculateDaySummaryDraft,
  getFocusSessionDurationMinutes,
  summarizeFocusSessions
} from "@/lib/activity";
import { generateDueNotifications } from "@/lib/notifications";
import type { DailyFact, DailyPlan, FocusSession, Goal, Task } from "@/types/domain";

const task: Task = {
  id: "task-1",
  user_id: "user-1",
  category_id: "cat-1",
  title: "Прогулка",
  description: null,
  weight: 2,
  is_active: true,
  created_at: "",
  updated_at: ""
};

const plan: DailyPlan = {
  id: "plan-1",
  month_id: "month-1",
  task_id: "task-1",
  date: "2026-06-28",
  planned_value: 1,
  planned_score: 2,
  locked: false,
  created_at: ""
};

const fact: DailyFact = {
  id: "fact-1",
  month_id: "month-1",
  task_id: "task-1",
  date: "2026-06-28",
  actual_value: 0.5,
  actual_score: 1,
  note: null,
  miss_reason: "low_energy",
  miss_comment: null,
  created_at: "",
  updated_at: ""
};

describe("activity and notifications", () => {
  it("calculates day summary from plan and fact", () => {
    const summary = calculateDaySummaryDraft({
      userId: "user-1",
      monthId: "month-1",
      date: "2026-06-28",
      plans: [plan],
      facts: [fact],
      tasks: [task],
      note: "День был спокойный"
    });

    expect(summary.plan_score).toBe(2);
    expect(summary.fact_score).toBe(1);
    expect(summary.completion).toBe(0.5);
    expect(summary.partial_count).toBe(1);
    expect(summary.main_miss_reason).toBe("low_energy");
    expect(buildDayClosedEventTitle(summary)).toContain("50%");
  });

  it("calculates focus duration and summary", () => {
    expect(getFocusSessionDurationMinutes("2026-06-28T10:00:00.000Z", "2026-06-28T10:45:00.000Z")).toBe(45);
    expect(getFocusSessionDurationMinutes("bad", "2026-06-28T10:45:00.000Z")).toBeNull();

    const sessions: FocusSession[] = [
      {
        id: "focus-1",
        user_id: "user-1",
        task_id: "task-1",
        started_at: "2026-06-28T10:00:00.000Z",
        ended_at: "2026-06-28T10:45:00.000Z",
        duration_minutes: 45,
        note: null,
        outcome: null,
        created_at: ""
      }
    ];

    expect(summarizeFocusSessions(sessions)).toEqual({
      totalMinutes: 45,
      finished: 1,
      averageMinutes: 45
    });
  });

  it("generates due and missing fact notifications without duplicates", () => {
    const goal: Goal = {
      id: "goal-1",
      user_id: "user-1",
      life_area_id: null,
      title: "Закрыть цель",
      description: null,
      type: "monthly",
      status: "active",
      priority: "high",
      why_text: null,
      target_value: null,
      current_value: null,
      unit: null,
      desired_identity: null,
      progress_mode: "manual_value",
      start_date: null,
      due_date: "2026-06-29",
      completed_at: null,
      created_at: "",
      updated_at: ""
    };

    const notifications = generateDueNotifications({
      today: "2026-06-28",
      selectedMonthId: "month-1",
      plans: [plan],
      facts: [],
      tasks: [task],
      categories: [{ id: "cat-1", user_id: "user-1", life_area_id: null, name: "Тело", color: "#16a34a", sort_order: 1, created_at: "" }],
      lifeAreas: [],
      goals: [goal],
      goalTasks: [],
      weeklyReviews: [],
      settings: null
    });

    expect(notifications.some((item) => item.type === "today_fact_missing")).toBe(true);
    expect(notifications.some((item) => item.type === "due_tomorrow")).toBe(true);
    expect(new Set(notifications.map((item) => item.dedupe_key)).size).toBe(notifications.length);
  });

  it("builds weekly markdown", () => {
    const markdown = buildWeeklyMarkdown(
      {
        id: "month-1",
        user_id: "user-1",
        year: 2026,
        month: 6,
        title: "Июнь 2026",
        status: "draft",
        target_percent: 0.8,
        approved_at: null,
        closed_at: null,
        created_at: ""
      },
      [
        {
          weekNumber: 1,
          startDate: "2026-06-01",
          endDate: "2026-06-07",
          days: [],
          planScore: 10,
          factScore: 8,
          completion: 0.8,
          pacePercent: 0.8,
          planScoreToDate: 10,
          timeState: "past",
          status: "нормально",
          comment: "Рабочая неделя",
          weakTasks: [],
          strongTasks: []
        }
      ],
      []
    );

    expect(markdown).toContain("# Недельный отчет: Июнь 2026");
    expect(markdown).toContain("Неделя 1");
  });
});
