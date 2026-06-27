import { addMonths, differenceInCalendarMonths, format, parseISO } from "date-fns";
import type {
  Car,
  CarServiceItem,
  CarServiceStatus,
  CarSystem,
  FinanceGoal,
  FinanceSnapshot,
  HealthLog,
  WorkProjectStatus
} from "@/types/domain";

export const carSystemLabels: Record<CarSystem, string> = {
  engine: "Двигатель",
  transmission: "Коробка",
  transfer_case: "Раздатка",
  front_diff: "Редуктор передний",
  rear_diff: "Редуктор задний",
  brakes: "Тормоза",
  spark_plugs: "Свечи",
  filters: "Фильтры",
  antifreeze: "Антифриз",
  power_steering: "ГУР",
  battery: "Аккумулятор",
  tires: "Шины",
  other: "Прочее"
};

export const carStatusLabels: Record<CarServiceStatus, string> = {
  ok: "Нормально",
  soon: "Скоро менять",
  overdue: "Просрочено",
  unknown: "Нет данных"
};

export const workStatusLabels: Record<WorkProjectStatus, string> = {
  active: "В работе",
  paused: "Пауза",
  completed: "Завершен",
  archived: "Архив"
};

export function formatMoney(value: number) {
  if (!Number.isFinite(value)) {
    return "0 ₽";
  }

  return new Intl.NumberFormat("ru-RU", {
    style: "currency",
    currency: "RUB",
    maximumFractionDigits: 0
  }).format(value);
}

export function calculateFinanceSummary(snapshots: FinanceSnapshot[], goals: FinanceGoal[]) {
  const latest = snapshots[0] ?? null;
  const monthlyFreeCash = latest
    ? latest.income - latest.required_expenses - latest.optional_expenses
    : 0;
  const netWorth = latest ? latest.savings + latest.investments - latest.debt_total : 0;
  const emergencyMonths =
    latest && latest.required_expenses > 0 ? latest.savings / latest.required_expenses : null;

  return {
    latest,
    monthlyFreeCash,
    netWorth,
    emergencyMonths,
    goals: goals.map((goal) => calculateFinanceGoalProgress(goal, monthlyFreeCash))
  };
}

export function calculateFinanceGoalProgress(goal: FinanceGoal, monthlyFreeCash: number, today = new Date()) {
  const remaining = Math.max(0, goal.target_amount - goal.current_amount);
  const percent = goal.target_amount > 0 ? goal.current_amount / goal.target_amount : 0;
  const monthsLeft = goal.due_date
    ? Math.max(1, differenceInCalendarMonths(parseISO(goal.due_date), today))
    : null;
  const requiredPerMonth = monthsLeft ? remaining / monthsLeft : null;
  const estimatedMonths = monthlyFreeCash > 0 && remaining > 0 ? Math.ceil(remaining / monthlyFreeCash) : null;
  const estimatedDate = estimatedMonths ? format(addMonths(today, estimatedMonths), "MM.yyyy") : null;

  return {
    goal,
    remaining,
    percent,
    monthsLeft,
    requiredPerMonth,
    estimatedMonths,
    estimatedDate
  };
}

export function calculateHealthSummary(logs: HealthLog[]) {
  const latest = logs[0] ?? null;
  const withEnergy = logs.filter((log) => typeof log.energy === "number");
  const withSleep = logs.filter((log) => typeof log.sleep_hours === "number");
  const withPain = logs.filter((log) => typeof log.pain_level === "number");
  const workouts = logs.filter((log) => log.workout_done).length;

  const averageEnergy = average(withEnergy.map((log) => log.energy ?? 0));
  const averageSleep = average(withSleep.map((log) => log.sleep_hours ?? 0));
  const averagePain = average(withPain.map((log) => log.pain_level ?? 0));
  const gentleMode =
    (latest?.energy !== null && latest?.energy !== undefined && latest.energy <= 2) ||
    (latest?.pain_level !== null && latest?.pain_level !== undefined && latest.pain_level >= 6);

  return {
    latest,
    averageEnergy,
    averageSleep,
    averagePain,
    workouts,
    gentleMode
  };
}

export function getCarServiceState(item: CarServiceItem, car: Car, today = new Date()) {
  const nextDate = item.last_service_date && item.interval_months
    ? addMonths(parseISO(item.last_service_date), item.interval_months)
    : null;
  const nextMileage =
    item.last_service_mileage !== null && item.interval_km
      ? item.last_service_mileage + item.interval_km
      : null;
  const kmLeft = nextMileage === null ? null : nextMileage - car.current_mileage;
  const daysLeft = nextDate ? Math.ceil((nextDate.getTime() - today.getTime()) / 86_400_000) : null;

  let status: CarServiceStatus = "unknown";
  if (nextDate || kmLeft !== null) {
    status = "ok";
  }
  if ((daysLeft !== null && daysLeft <= 30) || (kmLeft !== null && kmLeft <= 1000)) {
    status = "soon";
  }
  if ((daysLeft !== null && daysLeft < 0) || (kmLeft !== null && kmLeft < 0)) {
    status = "overdue";
  }

  return {
    status,
    nextDate: nextDate ? format(nextDate, "yyyy-MM-dd") : null,
    nextMileage,
    kmLeft,
    daysLeft
  };
}

function average(values: number[]) {
  if (!values.length) {
    return null;
  }

  return values.reduce((sum, value) => sum + value, 0) / values.length;
}
