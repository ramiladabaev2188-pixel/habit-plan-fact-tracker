import { describe, expect, it } from "vitest";
import {
  calculateCompletion,
  calculateForecast,
  calculateRequiredPerDay,
  calculateScore,
  calculateStreaks,
  calculateWeeklyReport,
  getCompletionStatus,
  getForecastStatus
} from "@/lib/metrics";
import { generateMonthlyInsights } from "@/lib/recommendations";

describe("metrics", () => {
  it("calculates weighted score", () => {
    expect(calculateScore(1.25, 3)).toBe(3.75);
    expect(calculateScore(0.5, 2)).toBe(1);
  });

  it("calculates completion from fact and plan scores", () => {
    expect(calculateCompletion(80, 100)).toBe(0.8);
    expect(calculateCompletion(120, 100)).toBe(1.2);
    expect(calculateCompletion(0, 0)).toBe(0);
    expect(calculateCompletion(3, 0)).toBe(1);
  });

  it("calculates forecast score and percent", () => {
    expect(calculateForecast(40, 10, 30, 120)).toEqual({
      forecastScore: 120,
      forecastPercent: 1
    });

    expect(calculateForecast(20, 10, 30, 120)).toEqual({
      forecastScore: 60,
      forecastPercent: 0.5
    });
  });

  it("calculates required score per remaining day", () => {
    expect(calculateRequiredPerDay(100, 40, 10)).toBe(6);
    expect(calculateRequiredPerDay(100, 130, 10)).toBe(0);
    expect(calculateRequiredPerDay(100, 70, 0)).toBe(30);
  });

  it("returns completion statuses", () => {
    expect(getCompletionStatus(1).label).toBe("🔥 Перевыполнение");
    expect(getCompletionStatus(0.8).label).toBe("✅ В норме");
    expect(getCompletionStatus(0.6).label).toBe("🟡 Нужно ускориться");
    expect(getCompletionStatus(0.59).label).toBe("🔴 Критично");
  });

  it("returns forecast statuses", () => {
    expect(getForecastStatus(1).label).toBe("🔥 Темп выше плана");
    expect(getForecastStatus(0.8).label).toBe("✅ Темп достаточный");
    expect(getForecastStatus(0.79).label).toBe("⚠️ Риск");
  });

  it("calculates current and best streaks", () => {
    const result = calculateStreaks([
      { date: "2026-06-01", planScore: 10, factScore: 9, completion: 0.9 },
      { date: "2026-06-02", planScore: 10, factScore: 8, completion: 0.8 },
      { date: "2026-06-03", planScore: 10, factScore: 5, completion: 0.5 },
      { date: "2026-06-04", planScore: 10, factScore: 10, completion: 1 },
      { date: "2026-06-05", planScore: 10, factScore: 9, completion: 0.9 }
    ]);

    expect(result).toEqual({
      current80: 2,
      current90: 2,
      best80: 2,
      best90: 2
    });
  });

  it("calculates weekly report by fixed day ranges", () => {
    const result = calculateWeeklyReport(
      { year: 2026, month: 6 },
      [
        { task_id: "task-1", date: "2026-06-01", planned_value: 1 },
        { task_id: "task-1", date: "2026-06-08", planned_value: 1 }
      ],
      [
        { task_id: "task-1", date: "2026-06-01", actual_value: 1 },
        { task_id: "task-1", date: "2026-06-08", actual_value: 0.5 }
      ],
      [{ id: "task-1", title: "Прогулка", weight: 2 }]
    );

    expect(result[0]).toMatchObject({
      weekNumber: 1,
      startDate: "2026-06-01",
      endDate: "2026-06-07",
      planScore: 2,
      factScore: 2,
      completion: 1,
      status: "🔥 отлично"
    });
    expect(result[1].completion).toBe(0.5);
  });

  it("generates monthly insights without external APIs", () => {
    const insights = generateMonthlyInsights({
      monthCompletion: 0.7,
      forecastPercent: 0.6,
      zeroFactDays: [{ date: "2026-06-01", planScore: 10, factScore: 0, completion: 0 }],
      taskStats: [
        {
          taskId: "task-1",
          categoryId: "cat-1",
          title: "Спина",
          weight: 3,
          planScore: 30,
          factScore: 10,
          completion: 0.33,
          gapScore: 20,
          requiredPerDay: 5,
          forecastScore: 15,
          forecastPercent: 0.5
        }
      ],
      categoryStats: [
        {
          categoryId: "cat-1",
          categoryName: "Тело",
          completion: 0.5,
          planScore: 30,
          factScore: 15
        }
      ]
    });

    expect(insights).toContain("Текущий факт ниже правила 80% — фокус на закрытии плановых дней.");
    expect(insights).toContain("Прогноз ниже цели — нужно усилить задачи с большим весом.");
    expect(insights).toContain("Категория Тело проседает сильнее всего.");
  });
});
