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
    <div className="space-y-5 md:pl-64">
      <LocalReminders
        preferences={preferences}
        forecastPercent={monthStats.forecastPercent}
        hasUnfilledYesterday={hasUnfilledYesterday}
        focusTaskTitle={focus?.title ?? null}
      />
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-normal">Дашборд</h1>
          <p className="text-sm text-muted-foreground">{selectedMonth.title}</p>
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

      <div className="grid gap-4 lg:grid-cols-4">
        <KpiCard
          icon={<Target className="h-5 w-5" />}
          label="Выполнение месяца"
          value={formatPercent(monthStats.monthCompletion)}
          detail={`${formatScore(monthStats.totalFactScore)} / ${formatScore(monthStats.totalPlanScore)} баллов`}
          progress={monthStats.monthCompletion}
          tone={completionStatus.level}
        />
        <KpiCard
          icon={<TrendingUp className="h-5 w-5" />}
          label="Прогноз"
          value={formatPercent(monthStats.forecastPercent)}
          detail={`${formatScore(monthStats.forecastScore)} баллов к концу месяца`}
          progress={monthStats.forecastPercent}
          tone={forecastStatus.level}
        />
        <KpiCard
          icon={<Activity className="h-5 w-5" />}
          label="Нужно в день"
          value={formatScore(monthStats.requiredPerDay)}
          detail={`Осталось дней с планом: ${monthStats.remainingDays}`}
          progress={monthStats.requiredPerDay / Math.max(1, monthStats.totalPlanScore / Math.max(1, monthStats.totalPlannedDays))}
          tone="info"
        />
        <KpiCard
          icon={<CalendarCheck className="h-5 w-5" />}
          label="Дней с планом"
          value={`${monthStats.elapsedDaysWithPlan} / ${monthStats.totalPlannedDays}`}
          detail="Прошло / всего"
          progress={monthStats.elapsedDaysWithPlan / Math.max(1, monthStats.totalPlannedDays)}
          tone="info"
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-warning" />
            Главный фокус дня
          </CardTitle>
        </CardHeader>
        <CardContent>
          {focus ? (
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="text-lg font-semibold">{focus.title}</div>
                <div className="text-sm text-muted-foreground">
                  Отставание {formatScore(focus.gapScore)} баллов, нужно {formatScore(focus.requiredPerDay)} в день
                </div>
              </div>
              <Badge variant={focus.completion >= 0.8 ? "success" : "warning"}>
                {formatPercent(focus.completion)}
              </Badge>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Нет задач с отставанием.</p>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>План vs факт по дням</CardTitle>
          </CardHeader>
          <CardContent>
            <DashboardPlanFactChart data={chartData} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Накопительный план vs факт</CardTitle>
          </CardHeader>
          <CardContent>
            <DashboardCumulativePlanFactChart data={chartData} />
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-4">
        {categoryStats.map((categoryStat) => {
          const category = categories.find((item) => item.id === categoryStat.categoryId);
          const status = getCompletionStatus(categoryStat.completion);

          return (
            <Card key={categoryStat.categoryId}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <span
                    className="h-3 w-3 rounded-full"
                    style={{ backgroundColor: category?.color ?? "#64748b" }}
                  />
                  {category?.name ?? "Без категории"}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="text-2xl font-semibold">{formatPercent(categoryStat.completion)}</div>
                <Progress
                  value={Math.min(categoryStat.completion, 1.2) * 100}
                  indicatorClassName={cn(status.level === "over" && "bg-over", status.level === "warning" && "bg-warning", status.level === "danger" && "bg-destructive", status.level === "success" && "bg-success")}
                />
                <div className="text-sm text-muted-foreground">
                  {formatScore(categoryStat.factScore)} / {formatScore(categoryStat.planScore)}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Задачи с наибольшим отставанием</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {taskStats.slice(0, 6).map((task) => (
            <div key={task.taskId} className="grid gap-2 rounded-md border p-3 sm:grid-cols-[1fr_auto] sm:items-center">
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

function KpiCard({
  icon,
  label,
  value,
  detail,
  progress,
  tone
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  detail: string;
  progress: number;
  tone: "over" | "success" | "warning" | "danger" | "info";
}) {
  return (
    <Card>
      <CardContent className="space-y-4 p-5">
        <div className="flex items-center justify-between gap-3">
          <div className="text-sm text-muted-foreground">{label}</div>
          <div className="rounded-md bg-muted p-2 text-primary">{icon}</div>
        </div>
        <div className="text-3xl font-semibold tracking-normal">{value}</div>
        <Progress
          value={Math.min(progress, 1.2) * 100}
          indicatorClassName={cn(
            tone === "over" && "bg-over",
            tone === "success" && "bg-success",
            tone === "warning" && "bg-warning",
            tone === "danger" && "bg-destructive",
            tone === "info" && "bg-info"
          )}
        />
        <div className="text-sm text-muted-foreground">{detail}</div>
      </CardContent>
    </Card>
  );
}
