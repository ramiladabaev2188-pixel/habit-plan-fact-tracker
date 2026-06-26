import { describe, expect, it } from "vitest";
import { calculateGrowthStats } from "@/lib/growth";
import type { Category, DailyFact, DailyPlan, LifeArea, Task } from "@/types/domain";

const healthArea = {
  id: "area-health",
  user_id: "user-1",
  name: "Здоровье",
  color: "#16a34a",
  icon: "heart-pulse",
  description: null,
  is_active: true,
  sort_order: 10,
  created_at: "2026-06-01",
  updated_at: "2026-06-01"
} satisfies LifeArea;

const financeArea = {
  ...healthArea,
  id: "area-finance",
  name: "Финансы",
  color: "#f97316",
  sort_order: 20
} satisfies LifeArea;

describe("growth stats", () => {
  it("calculates life area completion through category-linked tasks", () => {
    const categories = [
      {
        id: "category-health",
        user_id: "user-1",
        life_area_id: healthArea.id,
        name: "Тело",
        color: "#16a34a",
        sort_order: 1,
        created_at: "2026-06-01"
      },
      {
        id: "category-empty",
        user_id: "user-1",
        life_area_id: null,
        name: "Без сферы",
        color: "#2563eb",
        sort_order: 2,
        created_at: "2026-06-01"
      }
    ] satisfies Category[];
    const tasks = [
      {
        id: "task-health",
        user_id: "user-1",
        category_id: "category-health",
        title: "Прогулка",
        description: null,
        weight: 2,
        is_active: true,
        created_at: "2026-06-01",
        updated_at: "2026-06-01"
      },
      {
        id: "task-without-area",
        user_id: "user-1",
        category_id: "category-empty",
        title: "Вне сфер",
        description: null,
        weight: 1,
        is_active: true,
        created_at: "2026-06-01",
        updated_at: "2026-06-01"
      }
    ] satisfies Task[];
    const plans = [
      {
        id: "plan-1",
        month_id: "month-1",
        task_id: "task-health",
        date: "2026-06-05",
        planned_value: 1,
        planned_score: 10,
        locked: false,
        created_at: "2026-06-01"
      },
      {
        id: "plan-2",
        month_id: "month-1",
        task_id: "task-health",
        date: "2026-06-10",
        planned_value: 1,
        planned_score: 10,
        locked: false,
        created_at: "2026-06-01"
      },
      {
        id: "plan-ignored",
        month_id: "month-1",
        task_id: "task-without-area",
        date: "2026-06-10",
        planned_value: 1,
        planned_score: 100,
        locked: false,
        created_at: "2026-06-01"
      }
    ] satisfies DailyPlan[];
    const facts = [
      {
        id: "fact-1",
        month_id: "month-1",
        task_id: "task-health",
        date: "2026-06-05",
        actual_value: 1,
        actual_score: 10,
        note: null,
        created_at: "2026-06-05",
        updated_at: "2026-06-05"
      }
    ] satisfies DailyFact[];

    const stats = calculateGrowthStats({
      lifeAreas: [healthArea, financeArea],
      categories,
      tasks,
      plans,
      facts,
      today: new Date("2026-06-10T12:00:00")
    });

    expect(stats.totalPlanScore).toBe(20);
    expect(stats.totalFactScore).toBe(10);
    expect(stats.overallIndex).toBe(0.5);
    expect(stats.last7Index).toBe(0.5);
    expect(stats.areas.find((item) => item.area.id === healthArea.id)?.taskCount).toBe(1);
    expect(stats.areas.find((item) => item.area.id === financeArea.id)?.planScore).toBe(0);
    expect(stats.weakAreas.map((item) => item.area.id)).toEqual([healthArea.id]);
  });
});
