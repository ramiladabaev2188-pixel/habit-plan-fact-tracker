import type { Category, DailyFact, DailyPlan, LifeArea, Task } from "@/types/domain";

export type LifeAreaTaskContribution = {
  taskId: string;
  taskTitle: string;
  categoryName: string | null;
  areaId: string;
  factScore: number;
  planScore: number;
  completion: number;
};

export type LifeAreaStat = {
  area: LifeArea;
  factScore: number;
  planScore: number;
  completion: number;
  last7Completion: number;
  last30Completion: number;
  taskCount: number;
  contributions: LifeAreaTaskContribution[];
};

export type GrowthStats = {
  overallIndex: number;
  totalFactScore: number;
  totalPlanScore: number;
  last7Index: number;
  last30Index: number;
  areas: LifeAreaStat[];
  strongAreas: LifeAreaStat[];
  weakAreas: LifeAreaStat[];
};

type GrowthInput = {
  lifeAreas: LifeArea[];
  categories: Category[];
  tasks: Task[];
  plans: DailyPlan[];
  facts: DailyFact[];
  today?: Date;
};

export function calculateGrowthStats({
  lifeAreas,
  categories,
  tasks,
  plans,
  facts,
  today = new Date()
}: GrowthInput): GrowthStats {
  const categoryMap = new Map(categories.map((category) => [category.id, category]));
  const taskMap = new Map(tasks.map((task) => [task.id, task]));
  const factMap = new Map(facts.map((fact) => [`${fact.task_id}:${fact.date}`, fact]));
  const activeAreaIds = new Set(lifeAreas.map((area) => area.id));

  const tasksByArea = new Map<string, Task[]>();
  for (const task of tasks) {
    const areaId = task.category_id ? categoryMap.get(task.category_id)?.life_area_id ?? null : null;

    if (areaId && activeAreaIds.has(areaId)) {
      const areaTasks = tasksByArea.get(areaId) ?? [];
      areaTasks.push(task);
      tasksByArea.set(areaId, areaTasks);
    }
  }

  const areaStats = lifeAreas.map((area) => {
    const areaTasks = tasksByArea.get(area.id) ?? [];
    const areaTaskIds = new Set(areaTasks.map((task) => task.id));
    const areaPlans = plans.filter((plan) => areaTaskIds.has(plan.task_id));
    const planScore = sumPlanScore(areaPlans);
    const factScore = areaPlans.reduce((sum, plan) => sum + Number(factMap.get(`${plan.task_id}:${plan.date}`)?.actual_score ?? 0), 0);
    const last7 = calculateWindowCompletion(areaPlans, factMap, today, 7);
    const last30 = calculateWindowCompletion(areaPlans, factMap, today, 30);

    return {
      area,
      factScore,
      planScore,
      completion: safeCompletion(factScore, planScore),
      last7Completion: last7,
      last30Completion: last30,
      taskCount: areaTasks.length,
      contributions: areaTasks
        .map((task) => {
          const taskPlans = areaPlans.filter((plan) => plan.task_id === task.id);
          const taskPlanScore = sumPlanScore(taskPlans);
          const taskFactScore = taskPlans.reduce(
            (sum, plan) => sum + Number(factMap.get(`${plan.task_id}:${plan.date}`)?.actual_score ?? 0),
            0
          );
          const category = task.category_id ? categoryMap.get(task.category_id) ?? null : null;

          return {
            taskId: task.id,
            taskTitle: task.title,
            categoryName: category?.name ?? null,
            areaId: area.id,
            factScore: taskFactScore,
            planScore: taskPlanScore,
            completion: safeCompletion(taskFactScore, taskPlanScore)
          };
        })
        .filter((item) => item.planScore > 0)
        .sort((a, b) => b.planScore - a.planScore)
    } satisfies LifeAreaStat;
  });

  const totalPlanScore = areaStats.reduce((sum, stat) => sum + stat.planScore, 0);
  const totalFactScore = areaStats.reduce((sum, stat) => sum + stat.factScore, 0);
  const activeStats = areaStats.filter((stat) => stat.planScore > 0);
  const strongAreas = [...activeStats].filter((stat) => stat.completion >= 0.8).sort((a, b) => b.completion - a.completion);
  const weakAreas = [...activeStats].filter((stat) => stat.completion < 0.8).sort((a, b) => a.completion - b.completion);

  return {
    overallIndex: safeCompletion(totalFactScore, totalPlanScore),
    totalFactScore,
    totalPlanScore,
    last7Index: calculateWindowCompletion(plans.filter((plan) => {
      const task = taskMap.get(plan.task_id);
      const areaId = task?.category_id ? categoryMap.get(task.category_id)?.life_area_id ?? null : null;
      return Boolean(areaId && activeAreaIds.has(areaId));
    }), factMap, today, 7),
    last30Index: calculateWindowCompletion(plans.filter((plan) => {
      const task = taskMap.get(plan.task_id);
      const areaId = task?.category_id ? categoryMap.get(task.category_id)?.life_area_id ?? null : null;
      return Boolean(areaId && activeAreaIds.has(areaId));
    }), factMap, today, 30),
    areas: areaStats,
    strongAreas,
    weakAreas
  };
}

function sumPlanScore(plans: DailyPlan[]) {
  return plans.reduce((sum, plan) => sum + Number(plan.planned_score), 0);
}

function safeCompletion(factScore: number, planScore: number) {
  return planScore > 0 ? factScore / planScore : 0;
}

function calculateWindowCompletion(
  plans: DailyPlan[],
  factMap: Map<string, DailyFact>,
  today: Date,
  days: number
) {
  const end = toDateKey(today);
  const startDate = new Date(today);
  startDate.setDate(startDate.getDate() - days + 1);
  const start = toDateKey(startDate);
  const windowPlans = plans.filter((plan) => plan.date >= start && plan.date <= end);
  const planScore = sumPlanScore(windowPlans);
  const factScore = windowPlans.reduce(
    (sum, plan) => sum + Number(factMap.get(`${plan.task_id}:${plan.date}`)?.actual_score ?? 0),
    0
  );

  return safeCompletion(factScore, planScore);
}

function toDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}
