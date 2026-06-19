import type { DailyFact, DailyNote, DailyPlan, Month, Task } from "@/types/domain";

export type QualityIssue = {
  id: string;
  title: string;
  description: string;
  href?: string;
  fixAction?: "lock_plans";
};

export type QualityCheck = {
  id: string;
  title: string;
  status: "clean" | "warning" | "critical";
  summary: string;
  issues: QualityIssue[];
};

export function findMissingFacts(month: Month, plans: DailyPlan[], facts: DailyFact[]) {
  const factKeys = new Set(facts.map((fact) => `${fact.task_id}:${fact.date}`));
  return plans
    .filter((plan) => plan.planned_score > 0 && !factKeys.has(`${plan.task_id}:${plan.date}`))
    .map((plan) => ({
      id: `missing-${plan.task_id}-${plan.date}`,
      title: `Нет факта за ${plan.date}`,
      description: "Есть план, но факт не внесен.",
      href: `/daily?month=${month.id}&date=${plan.date}`
    }));
}

export function findZeroFactPlannedDays(month: Month, plans: DailyPlan[], facts: DailyFact[]) {
  const plannedDates = new Map<string, number>();
  const factDates = new Map<string, number>();

  for (const plan of plans) {
    plannedDates.set(plan.date, (plannedDates.get(plan.date) ?? 0) + plan.planned_score);
  }

  for (const fact of facts) {
    factDates.set(fact.date, (factDates.get(fact.date) ?? 0) + fact.actual_score);
  }

  return Array.from(plannedDates.entries())
    .filter(([date, planScore]) => planScore > 0 && (factDates.get(date) ?? 0) === 0)
    .map(([date]) => ({
      id: `zero-${date}`,
      title: `Нулевой факт за ${date}`,
      description: "В этот день был план, но суммарный факт равен 0.",
      href: `/daily?month=${month.id}&date=${date}`
    }));
}

export function findTasksWithoutWeight(tasks: Task[]) {
  return tasks
    .filter((task) => !Number.isFinite(task.weight) || task.weight <= 0)
    .map((task) => ({
      id: `weight-${task.id}`,
      title: task.title,
      description: "У задачи нет корректного веса.",
      href: "/planner"
    }));
}

export function findTasksWithoutCategory(tasks: Task[]) {
  return tasks
    .filter((task) => task.is_active && !task.category_id)
    .map((task) => ({
      id: `category-${task.id}`,
      title: task.title,
      description: "Активная задача не привязана к категории.",
      href: "/planner"
    }));
}

export function findActiveTasksWithoutPlan(month: Month, tasks: Task[], plans: DailyPlan[]) {
  const plannedTaskIds = new Set(plans.filter((plan) => plan.planned_score > 0).map((plan) => plan.task_id));
  return tasks
    .filter((task) => task.is_active && !plannedTaskIds.has(task.id))
    .map((task) => ({
      id: `no-plan-${task.id}`,
      title: task.title,
      description: "Активная задача не имеет плана в текущем месяце.",
      href: `/planner?month=${month.id}`
    }));
}

export function findFactsWithoutPlans(month: Month, plans: DailyPlan[], facts: DailyFact[]) {
  const planKeys = new Set(plans.map((plan) => `${plan.task_id}:${plan.date}`));
  return facts
    .filter((fact) => fact.actual_score > 0 && !planKeys.has(`${fact.task_id}:${fact.date}`))
    .map((fact) => ({
      id: `fact-no-plan-${fact.task_id}-${fact.date}`,
      title: `Факт без плана за ${fact.date}`,
      description: "Есть факт, но нет соответствующего daily_plan.",
      href: `/daily?month=${month.id}&date=${fact.date}`
    }));
}

export function findUnlockedApprovedPlans(month: Month, plans: DailyPlan[]) {
  if (month.status !== "approved") {
    return [];
  }

  return plans
    .filter((plan) => !plan.locked)
    .map((plan) => ({
      id: `unlocked-${plan.task_id}-${plan.date}`,
      title: `План не заблокирован за ${plan.date}`,
      description: "Утвержденный месяц содержит unlocked daily_plan.",
      href: `/planner?month=${month.id}`,
      fixAction: "lock_plans" as const
    }));
}

export function findDuplicatePlans(plans: DailyPlan[]) {
  return findDuplicates(
    plans.map((plan) => ({
      key: `${plan.month_id}:${plan.task_id}:${plan.date}`,
      date: plan.date,
      taskId: plan.task_id
    })),
    "Дубликат плана"
  );
}

export function findDuplicateFacts(facts: DailyFact[]) {
  return findDuplicates(
    facts.map((fact) => ({
      key: `${fact.month_id}:${fact.task_id}:${fact.date}`,
      date: fact.date,
      taskId: fact.task_id
    })),
    "Дубликат факта"
  );
}

export function findClosedMonthEditableFacts(month: Month, facts: DailyFact[], dailyNotes: DailyNote[]) {
  if (month.status !== "closed") {
    return [];
  }

  return facts.length || dailyNotes.length
    ? []
    : [];
}

export function runDataQualityChecks({
  month,
  tasks,
  plans,
  facts,
  dailyNotes
}: {
  month: Month;
  tasks: Task[];
  plans: DailyPlan[];
  facts: DailyFact[];
  dailyNotes: DailyNote[];
}) {
  const checks: QualityCheck[] = [
    toCheck("missing-facts", "Дни с планом и отсутствующим фактом", findMissingFacts(month, plans, facts), "critical"),
    toCheck("zero-facts", "Дни с планом и нулевым фактом", findZeroFactPlannedDays(month, plans, facts), "warning"),
    toCheck("tasks-without-weight", "Задачи без веса", findTasksWithoutWeight(tasks), "critical"),
    toCheck("tasks-without-category", "Задачи без категории", findTasksWithoutCategory(tasks), "warning"),
    toCheck("active-without-plan", "Активные задачи без плана", findActiveTasksWithoutPlan(month, tasks, plans), "warning"),
    toCheck("facts-without-plans", "Факты без плана", findFactsWithoutPlans(month, plans, facts), "critical"),
    toCheck("duplicate-plans", "Дубли планов", findDuplicatePlans(plans), "critical"),
    toCheck("duplicate-facts", "Дубли фактов", findDuplicateFacts(facts), "critical"),
    toCheck("unlocked-approved", "Утвержденный месяц с незаблокированными планами", findUnlockedApprovedPlans(month, plans), "warning"),
    toCheck("closed-editable", "Закрытый месяц с редактируемыми фактами", findClosedMonthEditableFacts(month, facts, dailyNotes), "critical")
  ];

  return checks;
}

function toCheck(id: string, title: string, issues: QualityIssue[], nonCleanStatus: "warning" | "critical"): QualityCheck {
  return {
    id,
    title,
    status: issues.length ? nonCleanStatus : "clean",
    summary: issues.length ? `${issues.length} проблем` : "чисто",
    issues
  };
}

function findDuplicates(items: { key: string; date: string; taskId: string }[], title: string) {
  const counts = new Map<string, number>();
  for (const item of items) {
    counts.set(item.key, (counts.get(item.key) ?? 0) + 1);
  }

  return items
    .filter((item) => (counts.get(item.key) ?? 0) > 1)
    .map((item) => ({
      id: `${title}-${item.key}`,
      title: `${title}: ${item.date}`,
      description: `Задача ${item.taskId} встречается больше одного раза.`,
      href: "/checks"
    }));
}
