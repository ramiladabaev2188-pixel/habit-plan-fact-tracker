import { describe, expect, it } from "vitest";
import {
  generateDailyRecommendations,
  generateMonthlyInsights,
  generateWeeklyRecommendations,
  getCategoryRisks,
  getMainFocusTask,
  getNextActions,
  getRiskTasks,
  getStrongTasks
} from "@/lib/recommendations";
import type { TaskStat, WeeklyReport } from "@/lib/metrics";

const taskStats = [
  {
    taskId: "task-1",
    categoryId: "cat-1",
    title: "Спина",
    weight: 3,
    planScore: 30,
    factScore: 10,
    completion: 0.33,
    gapScore: 20,
    factScoreToDate: 10,
    planScoreToDate: 20,
    futurePlanScore: 10,
    hasElapsedPlan: true,
    pacePercent: 0.5,
    baselinePerDay: 2,
    pressureRatio: 2.5,
    requiredPerDay: 5,
    forecastScore: 15,
    forecastPercent: 0.5
  },
  {
    taskId: "task-2",
    categoryId: "cat-2",
    title: "Прогулка",
    weight: 2,
    planScore: 20,
    factScore: 22,
    completion: 1.1,
    gapScore: 0,
    factScoreToDate: 22,
    planScoreToDate: 20,
    futurePlanScore: 0,
    hasElapsedPlan: true,
    pacePercent: 1.2,
    baselinePerDay: 0,
    pressureRatio: 0,
    requiredPerDay: 0,
    forecastScore: 24,
    forecastPercent: 1.2
  }
] satisfies TaskStat[];

describe("recommendations", () => {
  it("selects main focus and risk tasks by local rules", () => {
    expect(getMainFocusTask(taskStats)?.title).toBe("Спина");
    expect(getRiskTasks(taskStats)).toHaveLength(1);
    expect(getStrongTasks(taskStats)[0].title).toBe("Прогулка");
  });

  it("finds category risks", () => {
    const risks = getCategoryRisks([
      { categoryId: "cat-1", categoryName: "Тело", completion: 0.5, planScore: 30, factScore: 15 },
      { categoryId: "cat-2", categoryName: "Дух", completion: 0.9, planScore: 20, factScore: 18 }
    ]);

    expect(risks[0].categoryName).toBe("Тело");
  });

  it("generates daily and weekly recommendations", () => {
    expect(generateDailyRecommendations({
      dailyStat: { date: "2026-06-17", planScore: 10, factScore: 5, completion: 0.5 },
      taskStats
    })[0]).toContain("ниже плана");

    const weekly = {
      planScore: 10,
      factScore: 6,
      completion: 0.6,
      weakTasks: [taskStats[0]],
      strongTasks: [taskStats[1]]
    } as WeeklyReport;

    expect(generateWeeklyRecommendations(weekly)).toContain("Неделя ниже 80% — сократите лишнее и верните регулярность по базовым задачам.");
  });

  it("generates monthly insights and next actions without APIs", () => {
    const stats = {
      monthCompletion: 0.7,
      forecastPercent: 0.6,
      taskStats,
      categoryStats: [{ categoryId: "cat-1", categoryName: "Тело", completion: 0.5, planScore: 30, factScore: 15 }],
      zeroFactDays: [{ date: "2026-06-01", planScore: 10, factScore: 0, completion: 0 }]
    };

    expect(generateMonthlyInsights(stats)).toContain("Прогноз ниже цели — нужно усилить задачи с большим весом.");
    expect(getNextActions(stats)[0]).toContain("Спина");
  });
});
