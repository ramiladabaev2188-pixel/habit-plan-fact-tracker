import { redirect } from "next/navigation";
import type * as React from "react";
import { Activity, AlertTriangle, CalendarCheck, Target, TrendingUp } from "lucide-react";
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
  getCompletionStatus,
  getForecastStatus
} from "@/lib/metrics";
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

  const { selectedMonth, plans, facts, tasks, categories, preferences } = result.data;

  if (!selectedMonth) {
    return (
      <div className="md:pl-64">
        <EmptyMonthState />
      </div>
    );
  }

  const monthStats = calculateMonthStats(plans, facts, tasks);
  const completionStatus = getCompletionStatus(monthStats.monthCompletion);
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
  const taskStats = calculateTaskStats(plans, facts, tasks)
    .filter((task) => task.planScore > 0)
    .sort((a, b) => b.gapScore - a.gapScore);
  const focus = taskStats[0];
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
          <Badge variant={badgeVariantByLevel[completionStatus.level]}>
            {completionStatus.label}
          </Badge>
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
                Задача с самым большим влиянием на результат месяца. Закройте ее прежде, чем расходовать внимание на мелочи.
              </p>
              <div className="mt-7 grid gap-4 border-t border-border pt-4 sm:grid-cols-2">
                <div>
                  <div className="text-xs text-muted-foreground">Отставание</div>
                  <div className="data-value mt-1 text-3xl">{formatScore(focus.gapScore)} балла</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Минимум в день</div>
                  <div className="data-value mt-1 text-3xl">{formatScore(focus.requiredPerDay)} балла</div>
                </div>
              </div>
            </>
          ) : (
            <p className="mt-4 max-w-xl text-sm leading-6 text-muted-foreground">Сегодня нет задач с критическим отставанием. Сохраняйте текущий темп.</p>
          )}
        </div>

        <aside className="dashboard-readout" aria-label="Ключевые показатели месяца">
          <div className="dashboard-readout-cell border-b border-border/80">
            <div className="flex items-center justify-between gap-3">
              <span className="text-sm font-medium text-muted-foreground">Выполнение месяца</span>
              <Target className="h-5 w-5 text-signal" strokeWidth={1.8} />
            </div>
            <div className="data-value mt-5 text-5xl">{formatPercent(monthStats.monthCompletion)}</div>
            <div className="mt-3 text-sm text-muted-foreground">{formatScore(monthStats.totalFactScore)} из {formatScore(monthStats.totalPlanScore)} баллов</div>
          </div>
          <div className="dashboard-readout-cell">
            <div className="flex items-center justify-between gap-3">
              <span className="text-sm font-medium text-muted-foreground">Прогноз к концу месяца</span>
              <TrendingUp className="h-5 w-5 text-signal" strokeWidth={1.8} />
            </div>
            <div className="data-value mt-5 text-4xl">{formatPercent(monthStats.forecastPercent)}</div>
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
          value={formatScore(monthStats.totalFactScore)}
          detail={`из ${formatScore(monthStats.totalPlanScore)} плана`}
        />
        <MetricCell
          icon={<TrendingUp className="h-5 w-5" />}
          label="Статус темпа"
          value={forecastStatus.level === "danger" ? "Риск" : forecastStatus.level === "warning" ? "Ускориться" : "В норме"}
          detail={forecastStatus.label}
        />
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
          const status = getCompletionStatus(categoryStat.completion);

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
                <div className="data-value text-2xl">{formatPercent(categoryStat.completion)}</div>
              </div>
              <div className="mt-4 space-y-2">
                <Progress
                  value={Math.min(categoryStat.completion, 1.2) * 100}
                  indicatorClassName={cn(status.level === "over" && "bg-over", status.level === "warning" && "bg-warning", status.level === "danger" && "bg-destructive", status.level === "success" && "bg-success")}
                />
                <div className="text-sm text-muted-foreground">
                  {formatScore(categoryStat.factScore)} / {formatScore(categoryStat.planScore)}
                </div>
              </div>
            </div>
          );
        })}
        </CardContent>
      </Card>

      <Card className="section-panel">
        <CardHeader>
          <CardTitle>Задачи с наибольшим отставанием</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {taskStats.slice(0, 6).map((task) => (
            <div key={task.taskId} className="list-row grid gap-2 sm:grid-cols-[1fr_auto] sm:items-center">
              <div>
                <div className="font-medium">{task.title}</div>
                <div className="text-sm text-muted-foreground">
                  Факт {formatScore(task.factScore)} / план {formatScore(task.planScore)}
                </div>
              </div>
              <Badge variant={task.gapScore > 0 ? "warning" : "success"}>
                Отставание {formatScore(task.gapScore)}
              </Badge>
            </div>
          ))}
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
