import { describe, expect, it } from "vitest";
import {
  dateKeySchema,
  factValueSchema,
  planGenerationSchema,
  preferencesSchema,
  ratioFactValueSchema,
  settingsSchema,
  signInSchema,
  signUpSchema,
  teamBoardTaskSchema
} from "@/lib/validators/tracker";
import { personalBoardTaskSchema } from "@/lib/validators/personal-board";

describe("validators", () => {
  it("accepts measured fact values and keeps a strict ratio schema", () => {
    expect(factValueSchema.safeParse(5000).success).toBe(true);
    expect(factValueSchema.safeParse(1.25).success).toBe(true);
    expect(ratioFactValueSchema.safeParse(1.25).success).toBe(true);
    expect(ratioFactValueSchema.safeParse(1.3).success).toBe(false);
    expect(ratioFactValueSchema.safeParse(3).success).toBe(false);
  });

  it("validates extended plan generation modes", () => {
    const parsed = planGenerationSchema.parse({
      monthId: "00000000-0000-0000-0000-000000000001",
      taskId: "00000000-0000-0000-0000-000000000002",
      mode: "n_times_per_month",
      plannedValue: "1",
      weekdays: ["1", "3"],
      timesPerMonth: "8",
      specificDates: []
    });

    expect(parsed.timesPerMonth).toBe(8);
    expect(parsed.weekdays).toEqual([1, 3]);
  });

  it("validates notification preferences", () => {
    const parsed = preferencesSchema.parse({
      dailyReminderEnabled: "true",
      dailyReminderTime: "21:30",
      riskAlertsEnabled: "false",
      theme: "system",
      defaultMonthTarget: "0.8"
    });

    expect(parsed.dailyReminderEnabled).toBe(true);
    expect(parsed.defaultMonthTarget).toBe(0.8);
  });

  it("validates profile settings", () => {
    expect(settingsSchema.safeParse({ name: "Рамиль", timezone: "Asia/Yekaterinburg", targetPercent: "0.8" }).success).toBe(true);
    expect(settingsSchema.safeParse({ name: "", timezone: "Asia/Yekaterinburg", targetPercent: "0.8" }).success).toBe(false);
  });

  it("accepts only real calendar dates", () => {
    expect(dateKeySchema.safeParse("2026-06-30").success).toBe(true);
    expect(dateKeySchema.safeParse("2026-02-29").success).toBe(false);
    expect(dateKeySchema.safeParse("2026-6-1").success).toBe(false);
  });

  it("requires a stronger password for new accounts without blocking existing sign-ins", () => {
    expect(signInSchema.safeParse({ email: "ramil@example.com", password: "123456" }).success).toBe(true);
    expect(signUpSchema.safeParse({ name: "Рамиль", email: "ramil@example.com", password: "12345678901" }).success).toBe(false);
    expect(signUpSchema.safeParse({ name: "Рамиль", email: "ramil@example.com", password: "long-enough-12" }).success).toBe(true);
  });

  it("validates a team board task before it reaches the database", () => {
    const baseTask = {
      teamId: "00000000-0000-0000-0000-000000000001",
      boardId: "00000000-0000-0000-0000-000000000002",
      columnId: "00000000-0000-0000-0000-000000000003",
      title: "Подготовить общий созвон",
      priority: "high",
      assigneeId: "",
      dueDate: "2026-06-30"
    };

    expect(teamBoardTaskSchema.safeParse(baseTask).success).toBe(true);
    expect(teamBoardTaskSchema.safeParse({ ...baseTask, priority: "critical" }).success).toBe(false);
    expect(teamBoardTaskSchema.safeParse({ ...baseTask, title: " " }).success).toBe(false);
  });

  it("validates a personal board task before it reaches the database", () => {
    const baseTask = {
      boardId: "00000000-0000-0000-0000-000000000001",
      columnId: "00000000-0000-0000-0000-000000000002",
      title: "Разобрать личные задачи",
      priority: "urgent",
      dueDate: "2026-06-30",
      goalId: "",
      habitTaskId: "",
      monthId: ""
    };

    expect(personalBoardTaskSchema.safeParse(baseTask).success).toBe(true);
    expect(personalBoardTaskSchema.safeParse({ ...baseTask, priority: "critical" }).success).toBe(false);
    expect(personalBoardTaskSchema.safeParse({ ...baseTask, title: " " }).success).toBe(false);
  });
});
