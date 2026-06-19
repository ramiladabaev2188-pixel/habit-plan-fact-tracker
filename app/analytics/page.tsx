import { redirect } from "next/navigation";
import type * as React from "react";
import { Award, Flame, TrendingDown, TrendingUp } from "lucide-react";
import { CategoryChart } from "@/components/charts/category-chart";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyMonthState, ErrorState } from "@/components/shared/page-state";
import { SetupNotice } from "@/components/shared/setup-notice";
import { getMonthDates, toDateKey } from "@/lib/dates/month";
import {
  calculateCategoryStats,
  calculateDailyStats,
  calculateStreaks,
  calculateTaskStats,
  getCompletionStatus,
  getForecastStatus
} from "@/lib/metrics";
import { loadTrackerData } from "@/lib/supabase/data";
import { formatPercent, formatScore } from "@/lib/utils";

export default async function AnalyticsPage({
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

  const { selectedMonth, plans, facts, tasks, categories } = result.data;

  if (!selectedMonth) {
    return (
      <div className="md:pl-64">
        <EmptyMonthState />
      </div>
    );
  }

  const dates = getMonthDates(selectedMonth.year, selectedMonth.month);
  const dailyStats = dates.map((date) => calculateDailyStats(plans, facts, toDateKey(date), tasks));
  const streaks = calculateStreaks(dailyStats);
  const bestDay = [...dailyStats].filter((day) => day.planScore > 0).sort((a, b) => b.completion - a.completion)[0];
  const worstDay = [...dailyStats].filter((day) => day.planScore > 0).sort((a, b) => a.completion - b.completion)[0];
  const categoryStats = calculateCategoryStats(plans, facts, tasks);
  const taskStats = calculateTaskStats(plans, facts, tasks).filter((task) => task.planScore > 0);
  const categoryChartData = categoryStats.map((stat) => {
    const category = categories.find((item) => item.id === stat.categoryId);
    return {
      name: category?.name ?? "Без категории",
      plan: stat.planScore,
      fact: stat.factScore,
      percent: stat.completion
    };
  });
  const riskTasks = [...taskStats].sort((a, b) => a.completion - b.completion).slice(0, 5);
  const overTasks = [...taskStats].filter((task) => task.completion >= 1).sort((a, b) => b.completion - a.completion).slice(0, 5);

  return (
    <div className="space-y-5 md:pl-64">
      <div>
        <h1 className="text-2xl font-semibold tracking-normal">Аналитика</h1>
        <p className="text-sm text-muted-foreground">{selectedMonth.title}</p>
      </div>

      <div className="grid gap-4 lg:grid-cols-4">
        <Metric icon={<Flame className="h-5 w-5" />} label="Стрик 80%+" value={`${streaks.current80} дн.`} />
        <Metric icon={<Award className="h-5 w-5" />} label="Стрик 90%+" value={`${streaks.current90} дн.`} />
        <Metric icon={<TrendingUp className="h-5 w-5" />} label="Лучший день" value={bestDay ? formatPercent(bestDay.completion) : "0%"} />
        <Metric icon={<TrendingDown className="h-5 w-5" />} label="Худший день" value={worstDay ? formatPercent(worstDay.completion) : "0%"} />
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
        <Card>
          <CardHeader>
            <CardTitle>Выполнение по категориям</CardTitle>
          </CardHeader>
          <CardContent>
            <CategoryChart data={categoryChartData} />
          </CardContent>
        </Card>
        <div className="grid gap-4">
          <Card>
            <CardHeader>
              <CardTitle>Топ риска</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {riskTasks.map((task) => (
                <TaskLine key={task.taskId} title={task.title} value={formatPercent(task.completion)} variant="warning" />
              ))}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Перевыполнение</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {overTasks.length ? (
                overTasks.map((task) => (
                  <TaskLine key={task.taskId} title={task.title} value={formatPercent(task.completion)} variant="over" />
                ))
              ) : (
                <p className="text-sm text-muted-foreground">Пока нет задач 100%+.</p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Таблица задач</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto rounded-md border">
            <table className="min-w-[960px] w-full text-sm">
              <thead className="bg-muted/60">
                <tr>
                  <th className="p-3 text-left font-medium">Категория</th>
                  <th className="p-3 text-left font-medium">Задача</th>
                  <th className="p-3 text-right font-medium">Вес</th>
                  <th className="p-3 text-right font-medium">Факт</th>
                  <th className="p-3 text-right font-medium">План</th>
                  <th className="p-3 text-right font-medium">%</th>
                  <th className="p-3 text-right font-medium">Прогноз</th>
                  <th className="p-3 text-right font-medium">Нужно/день</th>
                  <th className="p-3 text-left font-medium">Сигнал</th>
                </tr>
              </thead>
              <tbody>
                {taskStats.map((task) => {
                  const category = categories.find((item) => item.id === task.categoryId);
                  const completionStatus = getCompletionStatus(task.completion);
                  const forecastStatus = getForecastStatus(task.forecastPercent);

                  return (
                    <tr key={task.taskId} className="border-t">
                      <td className="p-3">{category?.name ?? "Без категории"}</td>
                      <td className="p-3 font-medium">{task.title}</td>
                      <td className="p-3 text-right">{formatScore(task.weight)}</td>
                      <td className="p-3 text-right">{formatScore(task.factScore)}</td>
                      <td className="p-3 text-right">{formatScore(task.planScore)}</td>
                      <td className="p-3 text-right">{formatPercent(task.completion)}</td>
                      <td className="p-3 text-right">{formatPercent(task.forecastPercent)}</td>
                      <td className="p-3 text-right">{formatScore(task.requiredPerDay)}</td>
                      <td className="p-3">
                        <div className="flex flex-wrap gap-2">
                          <Badge variant={completionStatus.level === "danger" ? "destructive" : completionStatus.level}>
                            {completionStatus.label}
                          </Badge>
                          <Badge variant={forecastStatus.level === "danger" ? "destructive" : forecastStatus.level}>
                            {forecastStatus.label}
                          </Badge>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function Metric({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <Card>
      <CardContent className="flex items-center justify-between gap-3 p-5">
        <div>
          <div className="text-sm text-muted-foreground">{label}</div>
          <div className="text-2xl font-semibold">{value}</div>
        </div>
        <div className="rounded-md bg-info/20 p-2 text-info">{icon}</div>
      </CardContent>
    </Card>
  );
}

function TaskLine({
  title,
  value,
  variant
}: {
  title: string;
  value: string;
  variant: "warning" | "over";
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-md border p-3">
      <span className="min-w-0 truncate font-medium">{title}</span>
      <Badge variant={variant}>{value}</Badge>
    </div>
  );
}
