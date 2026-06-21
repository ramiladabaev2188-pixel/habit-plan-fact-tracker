import { describe, expect, it } from "vitest";
import { calculateRhythmSnapshot, getRhythmMilestones } from "@/lib/rhythm";

describe("rhythm", () => {
  it("summarizes optional energy check-ins without treating them as medical data", () => {
    const rhythm = calculateRhythmSnapshot({
      today: "2026-06-02",
      dailyStats: [
        { date: "2026-06-01", planScore: 10, factScore: 10, completion: 1 },
        { date: "2026-06-02", planScore: 10, factScore: 8, completion: 0.8 },
        { date: "2026-06-03", planScore: 10, factScore: 0, completion: 0 }
      ],
      dailyNotes: [
        { id: "n1", user_id: "u", month_id: "m", date: "2026-06-01", content: "", mood: null, energy: 4, created_at: "", updated_at: "" },
        { id: "n2", user_id: "u", month_id: "m", date: "2026-06-02", content: "", mood: null, energy: 3, created_at: "", updated_at: "" }
      ]
    });

    expect(rhythm.energyAverage).toBe(3.5);
    expect(rhythm.currentStreak).toBe(2);
    expect(rhythm.label).toBe("Устойчивый ритм");
  });

  it("unlocks milestones from real activity and pace", () => {
    const rhythm = calculateRhythmSnapshot({
      today: "2026-06-03",
      dailyStats: [
        { date: "2026-06-01", planScore: 10, factScore: 10, completion: 1 },
        { date: "2026-06-02", planScore: 10, factScore: 9, completion: 0.9 },
        { date: "2026-06-03", planScore: 10, factScore: 8, completion: 0.8 }
      ],
      dailyNotes: []
    });
    const milestones = getRhythmMilestones({ rhythm, forecastPercent: 0.85 });

    expect(milestones.every((item) => item.unlocked)).toBe(true);
  });
});
