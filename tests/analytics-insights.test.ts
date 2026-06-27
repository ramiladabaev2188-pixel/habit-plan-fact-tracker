import { describe, expect, it } from "vitest";
import {
  calculateEnergyCompletionInsight,
  findStaleLifeEvents,
  summarizeExperimentOutcomes
} from "@/lib/analytics-insights";
import type { DailyStat } from "@/lib/metrics";
import type { DailyNote, Experiment, ExperimentCheckin, HealthLog, LifeEvent } from "@/types/domain";

describe("analytics insights", () => {
  it("connects low and high energy with daily completion", () => {
    const dailyStats = [
      { date: "2026-06-01", planScore: 10, factScore: 4, completion: 0.4 },
      { date: "2026-06-02", planScore: 10, factScore: 9, completion: 0.9 }
    ] satisfies DailyStat[];
    const notes = [
      { date: "2026-06-01", energy: 2 },
      { date: "2026-06-02", energy: 5 }
    ] as DailyNote[];

    const insight = calculateEnergyCompletionInsight(dailyStats, notes, []);

    expect(insight.lowEnergyCompletion).toBe(0.4);
    expect(insight.highEnergyCompletion).toBe(0.9);
    expect(insight.message).toContain("ресурс");
  });

  it("uses health logs as a fallback source of energy", () => {
    const dailyStats = [
      { date: "2026-06-01", planScore: 10, factScore: 5, completion: 0.5 },
      { date: "2026-06-02", planScore: 10, factScore: 10, completion: 1 }
    ] satisfies DailyStat[];
    const healthLogs = [
      { date: "2026-06-01", energy: 1 },
      { date: "2026-06-02", energy: 4 }
    ] as HealthLog[];

    const insight = calculateEnergyCompletionInsight(dailyStats, [], healthLogs);

    expect(insight.lowEnergyDays).toBe(1);
    expect(insight.highEnergyDays).toBe(1);
  });

  it("summarizes experiment outcomes with rule-based verdicts", () => {
    const experiment = {
      id: "experiment-1",
      user_id: "user-1",
      title: "7 дней прогулок",
      hypothesis: "Энергия станет выше",
      life_area_id: null,
      start_date: "2026-06-01",
      end_date: "2026-06-07",
      status: "active",
      success_metric: "5 успешных дней",
      result_summary: null,
      conclusion: null,
      created_at: "2026-06-01",
      updated_at: "2026-06-01"
    } satisfies Experiment;
    const checkins = [1, 2, 3, 4, 5, 6].map((day) => ({
      id: `check-${day}`,
      experiment_id: experiment.id,
      date: `2026-06-0${day}`,
      value: 1,
      note: null,
      created_at: `2026-06-0${day}`
    })) satisfies ExperimentCheckin[];

    const [outcome] = summarizeExperimentOutcomes([experiment], checkins, "2026-06-07");

    expect(outcome.stats.percent).toBeGreaterThan(0.8);
    expect(outcome.conclusion).toContain("подтвержден");
  });

  it("marks timeline as stale when no recent life events exist", () => {
    const events = [
      {
        id: "event-1",
        user_id: "user-1",
        life_area_id: null,
        goal_id: null,
        title: "Старое событие",
        description: null,
        event_date: "2026-05-01",
        type: "milestone",
        importance: 3,
        created_at: "2026-05-01",
        updated_at: "2026-05-01"
      }
    ] satisfies LifeEvent[];

    expect(findStaleLifeEvents(events, "2026-06-15")).toEqual({
      latest: "2026-05-01",
      isStale: true
    });
  });
});
