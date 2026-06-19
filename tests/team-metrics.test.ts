import { describe, expect, it } from "vitest";
import { calculateTeamStats } from "@/lib/team-metrics";

describe("team metrics", () => {
  it("aggregates plan and fact scores across members", () => {
    const stats = calculateTeamStats([
      {
        userId: "u1",
        profile: { id: "u1", email: "a@example.com", name: "Али", timezone: null, created_at: "" },
        month: null,
        tasks: [{ id: "t1", user_id: "u1", category_id: null, title: "Спорт", description: null, weight: 2, is_active: true, created_at: "", updated_at: "" }],
        plans: [{ id: "p1", month_id: "m1", task_id: "t1", date: "2026-06-01", planned_value: 1, planned_score: 2, locked: false, created_at: "" }],
        facts: [{ id: "f1", month_id: "m1", task_id: "t1", date: "2026-06-01", actual_value: 1, actual_score: 2, note: null, created_at: "", updated_at: "" }]
      },
      {
        userId: "u2",
        profile: { id: "u2", email: "b@example.com", name: "Борис", timezone: null, created_at: "" },
        month: null,
        tasks: [{ id: "t2", user_id: "u2", category_id: null, title: "Чтение", description: null, weight: 1, is_active: true, created_at: "", updated_at: "" }],
        plans: [{ id: "p2", month_id: "m2", task_id: "t2", date: "2026-06-01", planned_value: 1, planned_score: 1, locked: false, created_at: "" }],
        facts: [{ id: "f2", month_id: "m2", task_id: "t2", date: "2026-06-01", actual_value: 0, actual_score: 0, note: null, created_at: "", updated_at: "" }]
      }
    ]);

    expect(stats.planScore).toBe(3);
    expect(stats.factScore).toBe(2);
    expect(stats.completion).toBeCloseTo(2 / 3);
    expect(stats.membersWithPlan).toBe(2);
  });

  it("selects focus member by required daily score", () => {
    const stats = calculateTeamStats(
      [
        {
          userId: "u1",
          profile: { id: "u1", email: null, name: "Сильный", timezone: null, created_at: "" },
          month: null,
          tasks: [{ id: "t1", user_id: "u1", category_id: null, title: "План", description: null, weight: 1, is_active: true, created_at: "", updated_at: "" }],
          plans: [{ id: "p1", month_id: "m1", task_id: "t1", date: "2026-06-01", planned_value: 1, planned_score: 1, locked: false, created_at: "" }],
          facts: [{ id: "f1", month_id: "m1", task_id: "t1", date: "2026-06-01", actual_value: 1, actual_score: 1, note: null, created_at: "", updated_at: "" }]
        },
        {
          userId: "u2",
          profile: { id: "u2", email: null, name: "Фокус", timezone: null, created_at: "" },
          month: null,
          tasks: [{ id: "t2", user_id: "u2", category_id: null, title: "План", description: null, weight: 4, is_active: true, created_at: "", updated_at: "" }],
          plans: [{ id: "p2", month_id: "m2", task_id: "t2", date: "2026-06-30", planned_value: 1, planned_score: 4, locked: false, created_at: "" }],
          facts: []
        }
      ],
      "2026-06-29"
    );

    expect(stats.focusMember?.name).toBe("Фокус");
  });
});
