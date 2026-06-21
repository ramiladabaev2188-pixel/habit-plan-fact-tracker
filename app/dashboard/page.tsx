import { redirect } from "next/navigation";
import type * as React from "react";
import { Activity, AlertTriangle, BatteryMedium, CalendarCheck, Target, TrendingUp } from "lucide-react";
import { DashboardCumulativePlanFactChart, DashboardPlanFactChart } from "@/components/charts/dashboard-charts";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { LocalReminders } from "@/components/shared/local-reminders";
import { EmptyMonthState, ErrorState } from "@/components/shared/page-state";
import { SetupNotice } from "@/components/shared/setup-notice";
import { getMonthDates, getTodayKey, toDateKey } from "@/lib/dates/month";
import {
  calculateCategoryStats,
  calculateDailyStats,
  calculateMonthStats,
  calculateTaskStats,
  getForecastStatus
} from "@/lib/metrics";
import { getMainFocusTask, getRiskTasks } from "@/lib/recommendations";
import { calculateRhythmSnapshot, getRhythmMilestones } from "@/lib/rhythm";
import { loadTrackerData } from "@/lib/supabase/data";
import { cn, formatPercent, formatScore } from "@/lib/utils";

const badgeVariantByLevel = {
  over: "over",
  success: "success",
  warning: "warning",
  danger: "destructive",
  info: "info"
} as const;

export default async function DashboardPage({
  searchParams
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  const params = await searchParams;
  const result = await loadTrackerData(params.month);

  if (!result.configured) {
    return <SetupNotice />;
  }

  if (!result.user) {
    redirect("/login");
  }

  if (result.error || !result.data) {
    return <ErrorState message={result.error ?? "Неизвестная ошибка"} />;
  }

  const { selectedMonth, plans, facts, tasks, categories, dailyNotes, preferences } = result.data;

  if (!selectedMonth) {
    return (
      <div>
        <EmptyMonthState />
      </div>
    );
  }

  const monthStats = calculateMonthStats(plans, facts, tasks);
  const forecastStatus = getForecastStatus(monthStats.forecastPercent);
  const monthDates = getMonthDates(selectedMonth.year, selectedMonth.month);
  const dailyStats = monthDates.map((date) => {
    const key = toDateKey(date);
    return calculateDailyStats(plans, facts, key, tasks);
  });
  const chartData = dailyStats.map((stat) => ({
    date: stat.date,
    label: stat.date.slice(-2),
    plan: stat.planScore,
    fact: stat.factScore
  }));
  const categoryStats = calculateCategoryStats(plans, facts, tasks);
  const taskStats = calculateTaskStats(plans, facts, tasks).filter((task) => task.planScore > 0);
  const riskTasks = getRiskTasks(taskStats, 6, selectedMonth.target_percent);
  const focus = getMainFocusTask(taskStats, selectedMonth.target_percent);
  const rhythm = calculateRhythmSnapshot({
    dailyStats,
    dailyNotes: dailyNotes.filter((note) => note.month_id === selectedMonth.id),
    targetPercent: selectedMonth.target_percent
  });
  const milestones = getRhythmMilestones({
    rhythm,
    forecastPercent: monthStats.forecastPercent,
    targetPercent: selectedMonth.target_percent
  });
  const yesterdayKey = shiftDateKey(getTodayKey(), -1);
  const yesterdayPlans = plans.filter((plan) => plan.date === yesterdayKey && plan.planned_score > 0);
  const yesterdayFactKeys = new Set(
    facts.filter((fact) => fact.date === yesterdayKey).map((fact) => `${fact.task_id}:${fact.date}`)
  );
  const hasUnfilledYesterday =
    yesterdayPlans.length > 0 &&
    yesterdayPlans.some((plan) => !yesterdayFactKeys.has(`${plan.task_id}:${plan.date}`));

  return (
    <div className="app-page app-page-with-rail dashboard-page">
      <LocalReminders
        preferences={preferences}
        forecastPercent={monthStats.forecastPercent}
        hasUnfilledYesterday={hasUnfilledYesterday}
        focusTaskTitle={focus?.title ?? null}
      />
      <div className="workspace-header">
        <div>
          <h1 className="workspace-title">Дашборд</h1>
          <p className="workspace-subtitle">{selectedMonth.title}. Картина месяца, темп и то, что важнее всего закрыть сегодня.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Badge variant="outline">Общий факт {formatPercent(monthStats.monthCompletion)}</Badge>
          <Badge variant={badgeVariantByLevel[forecastStatus.level]}>
            {forecastStatus.label}
          </Badge>
        </div>
      </div>

      <section className="dashboard-hero-grid" aria-labelledby="focus-heading">
        <div className="dashboard-focus-stage">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="dashboard-focus-label">Главный фокус</div>
              <h2 id="focus-heading" className="mt-3 max-w-2xl text-3xl font-semibold tracking-tight md:text-4xl">
                {focus?.title ?? "План месяца идет ровно"}
              </h2>
            </div>
            <AlertTriangle className="h-6 w-6 shrink-0 text-signal" strokeWidth={1.7} />
          </div>
          {focus ? (
            <>
              <p className="mt-4 max-w-xl text-sm leading-6 text-muted-foreground">
                Она отстает от требуемого темпа. Ориентир построен по плану, который уже должен был быть выполнен, а не по всему месяцу.
              </p>
              <div className="mt-7 grid gap-4 border-t border-border pt-4 sm:grid-cols-2">
                <div>
                  <div className="text-xs text-muted-foreground">Текущий темп</div>
                  <div className="data-value mt-1 text-3xl">{formatPercent(focus.forecastPercent)}</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Минимум в день</div>
                  <div className="data-value mt-1 text-3xl">{formatScore(focus.requiredPerDay)} балла</div>
                </div>
              </div>
            </>
          ) : (
            <p className="mt-4 max-w-xl text-sm leading-6 text-muted-foreground">Все начатые задачи идут в целевом темпе. Сохраняйте ритм без лишнего давления.</p>
          )}
        </div>

        <aside className="dashboard-readout" aria-label="Ключевые показатели месяца">
          <div className="dashboard-readout-cell border-b border-border/80">
            <div className="flex items-center justify-between gap-3">
              <span className="text-sm font-medium text-muted-foreground">Выполнение месяца</span>
              <Target className="h-5 w-5 text-signal" strokeWidth={1.8} />
            </div>
            <div className="data-value mt-5 text-5xl">{formatPercent(monthStats.monthCompletion)}</div>
            <div className="mt-3 text-sm text-muted-foreground">{formatScore(monthStats.currentFactScore)} из {formatScore(monthStats.totalPlanScore)} баллов</div>
          </div>
          <div className="dashboard-readout-cell">
            <div className="flex items-center justify-between gap-3">
              <span className="text-sm font-medium text-muted-foreground">Прогноз к концу месяца</span>
              <TrendingUp className="h-5 w-5 text-signal" strokeWidth={1.8} />
            </div>
            <div className="data-value mt-5 text-4xl">{formatPercent(monthStats.forecastPercent)}</div>
            <div className="mt-2 text-sm text-muted-foreground">Цель темпа: {formatPercent(selectedMonth.target_percent)}</div>
            <Progress className="mt-4" value={Math.min(monthStats.forecastPercent, 1.2) * 100} />
          </div>
        </aside>
      </section>

      <section className="dashboard-metric-rail" aria-label="Дополнительные показатели">
        <MetricCell
          icon={<Activity className="h-5 w-5" />}
          label="Нужно в день"
          value={formatScore(monthStats.requiredPerDay)}
          detail={`Осталось плановых дней: ${monthStats.remainingDays}`}
        />
        <MetricCell
          icon={<CalendarCheck className="h-5 w-5" />}
          label="Дней с планом"
          value={`${monthStats.elapsedDaysWithPlan} / ${monthStats.totalPlannedDays}`}
          detail="Прошло / всего"
        />
        <MetricCell
          icon={<Target className="h-5 w-5" />}
          label="Факт баллов"
          value={formatScore(monthStats.currentFactScore)}
          detail={`из ${formatScore(monthStats.totalPlanScore)} плана`}
        />
        <MetricCell
          icon={<TrendingUp className="h-5 w-5" />}
          label="Статус темпа"
          value={forecastStatus.level === "danger" ? "Риск" : forecastStatus.level === "warning" ? "Ускориться" : "В норме"}
          detail={`По плану на прошедшие дни: ${formatScore(monthStats.planScoreToDate)} баллов`}
        />
      </section>

      <section className="grid gap-3 xl:grid-cols-[1.2fr_0.8fr]" aria-label="Ритм и достижения">
        <Card className="section-panel">
          <CardHeader className="flex flex-row items-start justify-between gap-3">
            <div>
              <CardTitle>Ритм и ресурс</CardTitle>
              <p className="mt-1 text-sm text-muted-foreground">Самонаблюдение по энергии и регулярности, не медицинский показатель.</p>
            </div>
            <BatteryMedium className="h-5 w-5 text-signal" strokeWidth={1.8} />
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-[auto_1fr] sm:items-center">
            <div className="min-w-32 rounded-md bg-muted/55 p-4">
              <div className="text-xs text-muted-foreground">Средняя энергия</div>
              <div className="data-value mt-1 text-3xl">{rhythm.energyAverage === null ? "—" : `${rhythm.energyAverage}/5`}</div>
              <div className="mt-1 text-xs text-muted-foreground">{rhythm.energyEntries} отметок</div>
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <div className="font-semibold">{rhythm.label}</div>
                <Badge variant={rhythm.consistencyPercent >= selectedMonth.target_percent ? "success" : "secondary"}>
                  {rhythm.daysAtTarget} из {rhythm.plannedDays} дней в ритме
                </Badge>
              </div>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">{rhythm.guidance}</p>
            </div>
          </CardContent>
        </Card>

        <Card className="section-panel">
          <CardHeader>
            <CardTitle>Знаки месяца</CardTitle>
            <p className="mt-1 text-sm text-muted-foreground">Небольшие ориентиры за реальный прогресс, без штрафов.</p>
          </CardHeader>
          <CardContent className="space-y-2">
            {milestones.map((milestone) => (
              <div key={milestone.id} className="flex items-center justify-between gap-3 rounded-md border border-border/75 px-3 py-2">
                <div>
                  <div className="text-sm font-medium">{milestone.label}</div>
                  <div className="text-xs text-muted-foreground">{milestone.detail}</div>
                </div>
                <Badge variant={milestone.unlocked ? "success" : "outline"}>
                  {milestone.unlocked ? "получено" : "в пути"}
                </Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      </section>

      <div className="grid gap-3 xl:grid-cols-2">
        <section className="dashboard-chart-panel">
          <div className="dashboard-panel-header">
            <div>
              <h2 className="text-lg font-semibold tracking-tight">План и факт по дням</h2>
              <p className="mt-1 text-sm text-muted-foreground">Ритм выполнения без накопления.</p>
            </div>
          </div>
          <div className="p-5">
            <DashboardPlanFactChart data={chartData} />
          </div>
        </section>
        <section className="dashboard-chart-panel">
          <div className="dashboard-panel-header">
            <div>
              <h2 className="text-lg font-semibold tracking-tight">Накопительный темп</h2>
              <p className="mt-1 text-sm text-muted-foreground">Разрыв между планом и фактом за месяц.</p>
            </div>
          </div>
          <div className="p-5">
            <DashboardCumulativePlanFactChart data={chartData} />
          </div>
        </section>
      </div>

      <Card className="section-panel">
        <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <CardTitle>Категории</CardTitle>
            <p className="text-sm text-muted-foreground">Где темп держится, а где нужен фокус.</p>
          </div>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {categoryStats.map((categoryStat) => {
          const category = categories.find((item) => item.id === categoryStat.categoryId);
          const hasElapsedPlan = categoryStat.planScoreToDate > 0;
          const status = hasElapsedPlan ? getForecastStatus(categoryStat.pacePercent) : { level: "info" as const };

          return (
            <div key={categoryStat.categoryId} className="list-row">
              <div className="flex items-center justify-between gap-3">
                <div className="flex min-w-0 items-center gap-2 text-sm font-semibold">
                  <span
                    className="h-2.5 w-2.5 shrink-0 rounded-full"
                    style={{ backgroundColor: category?.color ?? "#64748b" }}
                  />
                  <span className="truncate">{category?.name ?? "Без категории"}</span>
                </div>
                <div className="data-value text-2xl">{hasElapsedPlan ? formatPercent(categoryStat.pacePercent) : "позже"}</div>
              </div>
              <div className="mt-4 space-y-2">
                <Progress
                  value={hasElapsedPlan ? Math.min(categoryStat.pacePercent, 1.2) * 100 : 0}
                  indicatorClassName={cn(status.level === "over" && "bg-over", status.level === "warning" && "bg-warning", status.level === "danger" && "bg-destructive", status.level === "success" && "bg-success")}
                />
                <div className="text-sm text-muted-foreground">
                  {hasElapsedPlan
                    ? `Темп по пройденному плану: ${formatScore(categoryStat.factScoreToDate)} / ${formatScore(categoryStat.planScoreToDate)}`
                    : "План категории начинается позже"}
                </div>
              </div>
            </div>
          );
        })}
        </CardContent>
      </Card>

      <Card className="section-panel">
        <CardHeader>
          <CardTitle>Задачи, которым нужен темп</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {riskTasks.length ? riskTasks.map((task) => (
            <div key={task.taskId} className="list-row grid gap-2 sm:grid-cols-[1fr_auto] sm:items-center">
              <div>
                <div className="font-medium">{task.title}</div>
                <div className="text-sm text-muted-foreground">
                  Темп {formatPercent(task.forecastPercent)} · нужно {formatScore(task.requiredPerDay)} в день
                </div>
              </div>
              <Badge variant="warning">
                Ниже цели {formatPercent(selectedMonth.target_percent)}
              </Badge>
            </div>
          )) : (
            <p className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
              Начатые задачи держат целевой темп. Будущие задачи здесь не считаются риском.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function shiftDateKey(dateKey: string, days: number) {
  const [year, month, day] = dateKey.split("-").map(Number);
  return toDateKey(new Date(year, month - 1, day + days));
}

function MetricCell({
  icon,
  label,
  value,
  detail
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <div className="dashboard-metric-cell">
      <div className="flex items-center justify-between gap-3 text-muted-foreground">
        <span className="text-sm font-medium">{label}</span>
        <span className="text-signal">{icon}</span>
      </div>
      <div className="data-value mt-5 text-3xl">{value}</div>
      <div className="mt-2 text-sm leading-5 text-muted-foreground">{detail}</div>
    </div>
  );
}
