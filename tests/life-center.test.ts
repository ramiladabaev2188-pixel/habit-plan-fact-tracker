import { describe, expect, it } from "vitest";
import { calculateLifeCenterGoalProgress, calculateLifeCenterSnapshot } from "@/lib/life-center";
import type {
  Car,
  CarServiceItem,
  Category,
  DailyFact,
  DailyPlan,
  FinanceSnapshot,
  Goal,
  GoalTask,
  HealthLog,
  LifeArea,
  Month,
  PersonalBoardTask,
  Task
} from "@/types/domain";

const now = "2026-06-10";
const userId = "user-1";

const month = {
  id: "month-1",
  user_id: userId,
  year: 2026,
  month: 6,
  title: "Июнь 2026",
  status: "approved",
  target_percent: 0.8,
  approved_at: "2026-06-01",
  closed_at: null,
  created_at: "2026-06-01"
} satisfies Month;

const healthArea = {
  id: "area-health",
  user_id: userId,
  name: "Здоровье",
  color: "#16a34a",
  icon: "heart-pulse",
  description: null,
  is_active: true,
  sort_order: 1,
  created_at: "2026-06-01",
  updated_at: "2026-06-01"
} satisfies LifeArea;

const financeArea = {
  ...healthArea,
  id: "area-finance",
  name: "Финансы",
  color: "#f97316",
  sort_order: 2
} satisfies LifeArea;

const category = {
  id: "category-health",
  user_id: userId,
  life_area_id: healthArea.id,
  name: "Тело",
  color: "#16a34a",
  sort_order: 1,
  created_at: "2026-06-01"
} satisfies Category;

const task = {
  id: "task-health",
  user_id: userId,
  category_id: category.id,
  title: "Прогулка",
  description: null,
  weight: 3,
  is_active: true,
  created_at: "2026-06-01",
  updated_at: "2026-06-01"
} satisfies Task;

const unlinkedTask = {
  ...task,
  id: "task-unlinked",
  category_id: null,
  title: "Задача без сферы",
  weight: 1
} satisfies Task;

const plans = [
  {
    id: "plan-1",
    month_id: month.id,
    task_id: task.id,
    date: "2026-06-01",
    planned_value: 1,
    planned_score: 3,
    locked: true,
    created_at: "2026-06-01"
  },
  {
    id: "plan-2",
    month_id: month.id,
    task_id: task.id,
    date: now,
    planned_value: 1,
    planned_score: 3,
    locked: true,
    created_at: "2026-06-01"
  },
  {
    id: "plan-3",
    month_id: month.id,
    task_id: unlinkedTask.id,
    date: now,
    planned_value: 1,
    planned_score: 1,
    locked: true,
    created_at: "2026-06-01"
  }
] satisfies DailyPlan[];

const facts = [
  {
    id: "fact-1",
    month_id: month.id,
    task_id: task.id,
    date: "2026-06-01",
    actual_value: 1,
    actual_score: 3,
    note: null,
    created_at: "2026-06-01",
    updated_at: "2026-06-01"
  },
  {
    id: "fact-2",
    month_id: month.id,
    task_id: unlinkedTask.id,
    date: now,
    actual_value: 0,
    actual_score: 0,
    note: null,
    miss_reason: "low_energy",
    created_at: now,
    updated_at: now
  }
] satisfies DailyFact[];

describe("life center", () => {
  it("connects habits, practical contours and personal board into one dashboard snapshot", () => {
    const financeSnapshot = {
      id: "finance-1",
      user_id: userId,
      date: now,
      income: 1000,
      required_expenses: 1500,
      optional_expenses: 100,
      savings: 200,
      debt_total: 50,
      investments: 0,
      comment: null,
      created_at: now,
      updated_at: now
    } satisfies FinanceSnapshot;
    const healthLog = {
      id: "health-1",
      user_id: userId,
      date: now,
      weight: null,
      sleep_hours: 5,
      energy: 2,
      mood: "устал",
      pain_level: null,
      workout_done: false,
      steps: 3000,
      comment: null,
      created_at: now,
      updated_at: now
    } satisfies HealthLog;
    const car = {
      id: "car-1",
      user_id: userId,
      name: "Машина",
      brand: null,
      model: null,
      year: null,
      current_mileage: 5000,
      created_at: now,
      updated_at: now
    } satisfies Car;
    const carItem = {
      id: "service-1",
      user_id: userId,
      car_id: car.id,
      name: "Масло двигателя",
      system: "engine",
      last_service_date: null,
      last_service_mileage: 0,
      interval_months: null,
      interval_km: 1000,
      comment: null,
      created_at: now,
      updated_at: now
    } satisfies CarServiceItem;
    const boardTask = {
      id: "board-task-1",
      user_id: userId,
      board_id: "board-1",
      column_id: "column-1",
      title: "Позвонить врачу",
      description: null,
      priority: "urgent",
      due_date: now,
      goal_id: null,
      habit_task_id: null,
      month_id: null,
      sort_order: 1,
      is_archived: false,
      completed_at: null,
      created_at: now,
      updated_at: now
    } satisfies PersonalBoardTask;

    const snapshot = calculateLifeCenterSnapshot({
      selectedMonth: month,
      lifeAreas: [healthArea, financeArea],
      categories: [category],
      tasks: [task, unlinkedTask],
      plans,
      facts,
      goals: [],
      goalTasks: [],
      weeklyReviews: [],
      dailyNotes: [],
      financeSnapshots: [financeSnapshot],
      healthLogs: [healthLog],
      cars: [car],
      carServiceItems: [carItem],
      personalBoardTasks: [boardTask],
      today: now
    });

    expect(snapshot.developmentIndex).toBe(0.5);
    expect(snapshot.nextBestStep.title).toBe("Позвонить врачу");
    expect(snapshot.risks.map((risk) => risk.id)).toEqual(
      expect.arrayContaining(["month-forecast", "finance-negative-cashflow", "health-gentle-mode", "car-service-1"])
    );
    expect(snapshot.disconnectedData.map((signal) => signal.id)).toContain("tasks-without-category");
    expect(snapshot.staleData.map((signal) => signal.id)).toContain("stale-work");
  });

  it("calculates manual and linked goal progress without mixing progress modes", () => {
    const manualGoal = makeGoal("goal-manual", "Финансовая подушка", "manual_value", 100, 25);
    const linkedGoal = makeGoal("goal-linked", "Ходить каждый день", "linked_tasks", null, null);
    const relation = {
      id: "goal-task-1",
      goal_id: linkedGoal.id,
      task_id: task.id,
      created_at: now
    } satisfies GoalTask;

    const progress = calculateLifeCenterGoalProgress({
      goals: [manualGoal, linkedGoal],
      goalTasks: [relation],
      tasks: [task],
      plans: plans.filter((plan) => plan.task_id === task.id),
      facts: facts.filter((fact) => fact.task_id === task.id),
      today: now
    });

    const manual = progress.find((item) => item.goal.id === manualGoal.id);
    const linked = progress.find((item) => item.goal.id === linkedGoal.id);

    expect(manual?.source).toBe("manual");
    expect(manual?.percent).toBe(0.25);
    expect(manual?.label).toContain("25%");
    expect(linked?.source).toBe("tasks");
    expect(linked?.percent).toBe(0.5);
    expect(linked?.label).toContain("50%");
  });
});

function makeGoal(
  id: string,
  title: string,
  progressMode: Goal["progress_mode"],
  targetValue: number | null,
  currentValue: number | null
) {
  return {
    id,
    user_id: userId,
    life_area_id: healthArea.id,
    title,
    description: null,
    type: "monthly",
    status: "active",
    priority: "high",
    why_text: null,
    target_value: targetValue,
    current_value: currentValue,
    unit: "баллов",
    desired_identity: null,
    progress_mode: progressMode,
    start_date: "2026-06-01",
    due_date: "2026-06-30",
    completed_at: null,
    created_at: "2026-06-01",
    updated_at: "2026-06-01"
  } satisfies Goal;
}
