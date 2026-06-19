import { describe, expect, it } from "vitest";
import {
  factValueSchema,
  planGenerationSchema,
  preferencesSchema,
  settingsSchema
} from "@/lib/validators/tracker";

describe("validators", () => {
  it("accepts fact values in quarter steps only", () => {
    expect(factValueSchema.safeParse(1.25).success).toBe(true);
    expect(factValueSchema.safeParse(1.3).success).toBe(false);
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
});
