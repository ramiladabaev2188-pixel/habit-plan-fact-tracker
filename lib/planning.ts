import { getDay } from "date-fns";
import { getMonthDates, toDateKey } from "@/lib/dates/month";
import { calculateScore } from "@/lib/metrics";
import type { DailyPlan, Month, PlanningRuleMode, Task, TaskPlanningRule } from "@/types/domain";

export type GeneratedPlanRow = {
  month_id: string;
  task_id: string;
  date: string;
  planned_value: number;
  planned_score: number;
};

export type PlanningRuleInput = {
  taskId: string;
  mode: PlanningRuleMode;
  weekdays?: number[] | null;
  specificDates?: string[] | null;
  timesPerMonth?: number | null;
  defaultPlannedValue?: number;
};

export type CopyMonthTemplateOptions = {
  copyAllTasks: boolean;
  onlyActive: boolean;
  excludeTasksWithoutPlan: boolean;
  keepCategories: boolean;
  keepGoalLinks: boolean;
};

export function generateDailyPlanForMonth(month: Pick<Month, "id" | "year" | "month">, task: Pick<Task, "id" | "weight">, plannedValue = 1) {
  return buildRows(month, task, getMonthDates(month.year, month.month), plannedValue);
}

export function generateWeekdaysPlanForMonth(month: Pick<Month, "id" | "year" | "month">, task: Pick<Task, "id" | "weight">, plannedValue = 1) {
  return buildRows(
    month,
    task,
    getMonthDates(month.year, month.month).filter((date) => {
      const day = getDay(date);
      return day >= 1 && day <= 5;
    }),
    plannedValue
  );
}

export function generateWeekendsPlanForMonth(month: Pick<Month, "id" | "year" | "month">, task: Pick<Task, "id" | "weight">, plannedValue = 1) {
  return buildRows(
    month,
    task,
    getMonthDates(month.year, month.month).filter((date) => {
      const day = getDay(date);
      return day === 0 || day === 6;
    }),
    plannedValue
  );
}

export function generateSpecificWeekdaysPlan(
  month: Pick<Month, "id" | "year" | "month">,
  task: Pick<Task, "id" | "weight">,
  weekdays: number[],
  plannedValue = 1
) {
  const selected = new Set(weekdays);
  return buildRows(
    month,
    task,
    getMonthDates(month.year, month.month).filter((date) => selected.has(getDay(date))),
    plannedValue
  );
}

export function generateSpecificDatesPlan(
  month: Pick<Month, "id" | "year" | "month">,
  task: Pick<Task, "id" | "weight">,
  dates: string[],
  plannedValue = 1
) {
  const selected = new Set(dates);
  return buildRows(
    month,
    task,
    getMonthDates(month.year, month.month).filter((date) => selected.has(toDateKey(date))),
    plannedValue
  );
}

export function generateNTimesPerMonthPlan(
  month: Pick<Month, "id" | "year" | "month">,
  task: Pick<Task, "id" | "weight">,
  timesPerMonth: number,
  plannedValue = 1
) {
  const dates = getMonthDates(month.year, month.month);
  const count = Math.max(0, Math.min(timesPerMonth, dates.length));

  if (count === 0) {
    return [];
  }

  const step = dates.length / count;
  const selected = Array.from({ length: count }, (_, index) => dates[Math.floor(index * step)]);
  return buildRows(month, task, selected, plannedValue);
}

export function generateManualPlan() {
  return [] as GeneratedPlanRow[];
}

export function generatePlanFromRule(
  month: Pick<Month, "id" | "year" | "month">,
  task: Pick<Task, "id" | "weight">,
  rule: PlanningRuleInput | TaskPlanningRule
) {
  const mode = rule.mode;
  const plannedValue =
    "default_planned_value" in rule
      ? Number(rule.default_planned_value)
      : rule.defaultPlannedValue ?? 1;
  const weekdays = "weekdays" in rule ? rule.weekdays ?? [] : [];
  const specificDates =
    "specific_dates" in rule
      ? rule.specific_dates ?? []
      : "specificDates" in rule
        ? rule.specificDates ?? []
        : [];
  const timesPerMonth =
    "times_per_month" in rule
      ? rule.times_per_month ?? 0
      : "timesPerMonth" in rule
        ? rule.timesPerMonth ?? 0
        : 0;

  if (mode === "daily") {
    return generateDailyPlanForMonth(month, task, plannedValue);
  }

  if (mode === "weekdays") {
    return generateWeekdaysPlanForMonth(month, task, plannedValue);
  }

  if (mode === "weekends") {
    return generateWeekendsPlanForMonth(month, task, plannedValue);
  }

  if (mode === "specific_weekdays") {
    return generateSpecificWeekdaysPlan(month, task, weekdays, plannedValue);
  }

  if (mode === "specific_dates") {
    return generateSpecificDatesPlan(month, task, specificDates, plannedValue);
  }

  if (mode === "n_times_per_month") {
    return generateNTimesPerMonthPlan(month, task, timesPerMonth, plannedValue);
  }

  return generateManualPlan();
}

export function mergeApprovedPlanRows(
  rows: GeneratedPlanRow[],
  existingPlans: Pick<DailyPlan, "task_id" | "date" | "planned_value" | "planned_score">[],
  isApprovedOrClosed: boolean
) {
  if (!isApprovedOrClosed) {
    return rows;
  }

  const existing = new Map(existingPlans.map((plan) => [`${plan.task_id}:${plan.date}`, plan]));

  return rows.map((row) => {
    const current = existing.get(`${row.task_id}:${row.date}`);

    if (!current || row.planned_score >= current.planned_score) {
      return row;
    }

    return {
      ...row,
      planned_value: Number(current.planned_value),
      planned_score: Number(current.planned_score)
    };
  });
}

export function copyMonthTemplate({
  targetMonth,
  sourcePlans,
  tasks,
  rules,
  options
}: {
  targetMonth: Pick<Month, "id" | "year" | "month">;
  sourcePlans: Pick<DailyPlan, "task_id" | "planned_value" | "planned_score">[];
  tasks: Task[];
  rules: TaskPlanningRule[];
  options: CopyMonthTemplateOptions;
}) {
  const tasksWithPlan = new Set(sourcePlans.filter((plan) => Number(plan.planned_score) > 0).map((plan) => plan.task_id));
  const selectedTasks = tasks.filter((task) => {
    if (!options.copyAllTasks && options.onlyActive && !task.is_active) {
      return false;
    }

    if (options.excludeTasksWithoutPlan && !tasksWithPlan.has(task.id)) {
      return false;
    }

    return true;
  });
  const rows = selectedTasks.flatMap((task) => {
    const rule = rules.find((item) => item.task_id === task.id);

    if (rule) {
      return generatePlanFromRule(targetMonth, task, rule);
    }

    return generateDailyPlanForMonth(targetMonth, task, 1);
  });

  return {
    tasks: selectedTasks,
    rows
  };
}

function buildRows(
  month: Pick<Month, "id" | "year" | "month">,
  task: Pick<Task, "id" | "weight">,
  dates: Date[],
  plannedValue: number
) {
  return dates.map((date) => ({
    month_id: month.id,
    task_id: task.id,
    date: toDateKey(date),
    planned_value: plannedValue,
    planned_score: calculateScore(plannedValue, Number(task.weight))
  }));
}
