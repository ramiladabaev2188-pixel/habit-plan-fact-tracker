import type { DailyStat } from "@/lib/metrics";
import { calculateExperimentStats } from "@/lib/reflection";
import type { DailyNote, Experiment, ExperimentCheckin, HealthLog, LifeEvent } from "@/types/domain";

export type EnergyCompletionInsight = {
  lowEnergyCompletion: number | null;
  highEnergyCompletion: number | null;
  lowEnergyDays: number;
  highEnergyDays: number;
  message: string;
};

export function calculateEnergyCompletionInsight(
  dailyStats: DailyStat[],
  dailyNotes: DailyNote[],
  healthLogs: HealthLog[]
): EnergyCompletionInsight {
  const completionByDate = new Map(dailyStats.filter((day) => day.planScore > 0).map((day) => [day.date, day.completion]));
  const energyByDate = new Map<string, number>();

  for (const note of dailyNotes) {
    if (typeof note.energy === "number") {
      energyByDate.set(note.date, note.energy);
    }
  }

  for (const log of healthLogs) {
    if (typeof log.energy === "number" && !energyByDate.has(log.date)) {
      energyByDate.set(log.date, log.energy);
    }
  }

  const low: number[] = [];
  const high: number[] = [];

  for (const [date, energy] of energyByDate) {
    const completion = completionByDate.get(date);
    if (completion === undefined) {
      continue;
    }

    if (energy <= 2) {
      low.push(completion);
    }
    if (energy >= 4) {
      high.push(completion);
    }
  }

  const lowEnergyCompletion = average(low);
  const highEnergyCompletion = average(high);
  const message =
    lowEnergyCompletion === null && highEnergyCompletion === null
      ? "Недостаточно данных по энергии и выполнению."
      : lowEnergyCompletion !== null && highEnergyCompletion !== null && highEnergyCompletion > lowEnergyCompletion
        ? "В дни с высоким ресурсом план выполняется лучше. Стоит переносить тяжелые задачи на такие дни."
        : lowEnergyCompletion !== null && lowEnergyCompletion < 0.6
          ? "Низкая энергия заметно бьет по выполнению. Нужен бережный режим и меньший план."
          : "Связь энергии и выполнения пока неочевидна, продолжайте фиксировать ресурс.";

  return {
    lowEnergyCompletion,
    highEnergyCompletion,
    lowEnergyDays: low.length,
    highEnergyDays: high.length,
    message
  };
}

export function findInactiveExperiments(experiments: Experiment[], checkins: ExperimentCheckin[], today: string) {
  const latestCheckinByExperiment = new Map<string, string>();
  for (const checkin of checkins) {
    const current = latestCheckinByExperiment.get(checkin.experiment_id);
    if (!current || checkin.date > current) {
      latestCheckinByExperiment.set(checkin.experiment_id, checkin.date);
    }
  }

  return experiments
    .filter((experiment) => experiment.status === "active")
    .filter((experiment) => {
      const latest = latestCheckinByExperiment.get(experiment.id) ?? experiment.start_date;
      return daysBetween(latest, today) > 2;
    });
}

export function summarizeExperimentOutcomes(experiments: Experiment[], checkins: ExperimentCheckin[], today: string) {
  return experiments
    .map((experiment) => {
      const stats = calculateExperimentStats(
        experiment,
        checkins.filter((checkin) => checkin.experiment_id === experiment.id),
        today
      );
      const conclusion =
        stats.percent >= 0.8
          ? "гипотеза выглядит подтвержденной"
          : stats.elapsedDays >= 3 && stats.percent < 0.5
            ? "гипотеза пока не подтверждается"
            : "недостаточно данных";

      return { experiment, stats, conclusion };
    })
    .sort((a, b) => b.stats.percent - a.stats.percent);
}

export function findStaleLifeEvents(events: LifeEvent[], today: string) {
  const latest = events.map((event) => event.event_date).sort((a, b) => b.localeCompare(a))[0] ?? null;
  return {
    latest,
    isStale: !latest || daysBetween(latest, today) > 30
  };
}

function average(values: number[]) {
  if (!values.length) {
    return null;
  }

  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function daysBetween(from: string, to: string) {
  const start = new Date(`${from}T00:00:00`).getTime();
  const end = new Date(`${to}T00:00:00`).getTime();
  return Math.floor((end - start) / 86_400_000);
}
