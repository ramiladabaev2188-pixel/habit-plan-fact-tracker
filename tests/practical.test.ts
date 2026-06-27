import { describe, expect, it } from "vitest";
import {
  calculateFinanceGoalProgress,
  calculateHealthSummary,
  getCarServiceState
} from "@/lib/practical";
import type { Car, CarServiceItem, FinanceGoal, HealthLog } from "@/types/domain";

describe("practical contours", () => {
  it("calculates required monthly saving for a finance goal", () => {
    const goal = {
      target_amount: 120_000,
      current_amount: 30_000,
      due_date: "2026-12-01"
    } as FinanceGoal;

    const progress = calculateFinanceGoalProgress(goal, 20_000, new Date("2026-06-15"));

    expect(progress.remaining).toBe(90_000);
    expect(progress.percent).toBe(0.25);
    expect(progress.requiredPerMonth).toBe(15_000);
    expect(progress.estimatedMonths).toBe(5);
  });

  it("switches health into gentle mode on low energy or high pain", () => {
    const logs = [
      { energy: 2, pain_level: 3, workout_done: false },
      { energy: 4, pain_level: 1, workout_done: true }
    ] as HealthLog[];

    const summary = calculateHealthSummary(logs);

    expect(summary.gentleMode).toBe(true);
    expect(summary.workouts).toBe(1);
    expect(summary.averageEnergy).toBe(3);
  });

  it("marks car service as overdue by mileage", () => {
    const car = { current_mileage: 55_000 } as Car;
    const item = {
      last_service_date: "2026-01-01",
      last_service_mileage: 40_000,
      interval_months: 12,
      interval_km: 10_000
    } as CarServiceItem;

    const state = getCarServiceState(item, car, new Date("2026-06-01"));

    expect(state.status).toBe("overdue");
    expect(state.kmLeft).toBe(-5_000);
  });
});
