import { getTodayKey } from "@/lib/dates/month";
import { calculateStreaks, type DailyStat } from "@/lib/metrics";
import type { DailyNote } from "@/types/domain";

export type RhythmSnapshot = {
  energyAverage: number | null;
  energyEntries: number;
  plannedDays: number;
  daysAtTarget: number;
  currentStreak: number;
  consistencyPercent: number;
  label: string;
  guidance: string;
};

export type RhythmMilestone = {
  id: string;
  label: string;
  detail: string;
  unlocked: boolean;
};

/**
 * A personal reflection signal, not a medical assessment. It connects the
 * user's optional energy check-ins with their completed planned days.
 */
export function calculateRhythmSnapshot({
  dailyStats,
  dailyNotes,
  today = getTodayKey(),
  targetPercent = 0.8
}: {
  dailyStats: DailyStat[];
  dailyNotes: DailyNote[];
  today?: string;
  targetPercent?: number;
}): RhythmSnapshot {
  const plannedDays = dailyStats.filter((day) => day.date <= today && day.planScore > 0);
  const daysAtTarget = plannedDays.filter((day) => day.completion >= targetPercent).length;
  const consistencyPercent = plannedDays.length ? daysAtTarget / plannedDays.length : 0;
  const energyValues = dailyNotes
    .filter((note) => note.date <= today && typeof note.energy === "number")
    .map((note) => Number(note.energy));
  const energyAverage = energyValues.length
    ? roundToOne(energyValues.reduce((sum, value) => sum + value, 0) / energyValues.length)
    : null;
  const currentStreak = calculateStreaks(dailyStats, today).current80;

  return {
    energyAverage,
    energyEntries: energyValues.length,
    plannedDays: plannedDays.length,
    daysAtTarget,
    currentStreak,
    consistencyPercent,
    ...getRhythmMessage(energyAverage, consistencyPercent)
  };
}

export function getRhythmMilestones({
  rhythm,
  forecastPercent,
  targetPercent = 0.8
}: {
  rhythm: RhythmSnapshot;
  forecastPercent: number;
  targetPercent?: number;
}): RhythmMilestone[] {
  return [
    {
      id: "first-check-in",
      label: "Первый ритм",
      detail: "Отметить хотя бы один плановый день.",
      unlocked: rhythm.plannedDays > 0
    },
    {
      id: "steady-three",
      label: "Ровный ход",
      detail: "Три дня подряд с выполнением 80%+.",
      unlocked: rhythm.currentStreak >= 3
    },
    {
      id: "month-pace",
      label: "В темпе месяца",
      detail: `Прогноз не ниже цели ${Math.round(targetPercent * 100)}%.`,
      unlocked: forecastPercent >= targetPercent
    }
  ];
}

function getRhythmMessage(energyAverage: number | null, consistencyPercent: number) {
  if (energyAverage === null) {
    return {
      label: "Наблюдение за ресурсом",
      guidance: "Отмечайте энергию в конце дня: через несколько дней появится личная картина ритма."
    };
  }

  if (energyAverage < 2.5) {
    return {
      label: "Бережный режим",
      guidance: "Энергия низкая: сохраните базовые привычки и не компенсируйте всё перегрузкой."
    };
  }

  if (consistencyPercent < 0.8) {
    return {
      label: "Ритм собирается",
      guidance: "Ресурс есть, но регулярность пока колеблется. Выберите одну базовую задачу на завтра."
    };
  }

  return {
    label: "Устойчивый ритм",
    guidance: "Энергия и выполнение держатся ровно. Продолжайте без искусственного усложнения плана."
  };
}

function roundToOne(value: number) {
  return Math.round((value + Number.EPSILON) * 10) / 10;
}
