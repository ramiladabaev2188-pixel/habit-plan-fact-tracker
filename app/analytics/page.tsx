import { redirect } from "next/navigation";
import type * as React from "react";
import { Award, Flame, TrendingDown, TrendingUp } from "lucide-react";
import { CategoryChart } from "@/components/charts/category-chart";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyMonthState, ErrorState } from "@/components/shared/page-state";
import { SetupNotice } from "@/components/shared/setup-notice";
import { getMonthDates, getTodayKey, toDateKey } from "@/lib/dates/month";
import {
  calculateCategoryStats,
  calculateDailyStats,
  calculateStreaks,
  calculateTaskStats,
  getForecastStatus
} from "@/lib/metrics";
import { calculateFailureInsights } from "@/lib/reflection";
import { getRiskTasks, getStrongTasks } from "@/lib/recommendations";
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
      <div>
        <EmptyMonthState />
      </div>
    );
  }

  const dates = getMonthDates(selectedMonth.year, selectedMonth.month);
  const dailyStats = dates.map((date) => calculateDailyStats(plans, facts, toDateKey(date), tasks));
  const today = getTodayKey();
  const completedDailyStats = dailyStats.filter((day) => day.planScore > 0 && day.date <= today);
  const streaks = calculateStreaks(dailyStats, today);
  const bestDay = [...completedDailyStats].sort((a, b) => b.completion - a.completion)[0];
  const worstDay = [...completedDailyStats].sort((a, b) => a.completion - b.completion)[0];
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
  const riskTasks = getRiskTasks(taskStats, 5, selectedMonth.target_percent);
  const overTasks = getStrongTasks(taskStats, 5, 1);
  const failureInsights = calculateFailureInsights(plans, facts, tasks, today);

  return (
    <div className="space-y-5">
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
              {riskTasks.length ? riskTasks.map((task) => (
                <TaskLine key={task.taskId} title={task.title} value={`Темп ${formatPercent(task.forecastPercent)}`} variant="warning" />
              )) : <p className="text-sm text-muted-foreground">У начатых задач нет рисков по темпу.</p>}
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
          <CardTitle>Почему срывается план</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 lg:grid-cols-3">
          <FailureList
            title="Частые причины"
            empty="Причины пока не отмечены. Когда факт ниже плана, можно выбрать мягкую причину без самообвинения."
            items={failureInsights.topReasons.map((item) => ({
              key: item.reason,
              label: item.label,
              value: `${item.count} раз`
            }))}
          />
          <FailureList
            title="Задачи, где чаще всего не хватает ритма"
            empty="Пока нет повторяющихся срывов по задачам."
            items={failureInsights.missedTasks.map((item) => ({
              key: item.taskId,
              label: item.title,
              value: `${item.count} дн.`
            }))}
          />
          <FailureList
            title="Дни недели"
            empty="Недостаточно данных по дням недели."
            items={failureInsights.missedWeekdays.map((item) => ({
              key: String(item.weekday),
              label: item.label,
              value: `${item.count} срывов`
            }))}
          />
        </CardContent>
      </Card>

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

function FailureList({
  title,
  empty,
  items
}: {
  title: string;
  empty: string;
  items: Array<{ key: string; label: string; value: string }>;
}) {
  return (
    <div className="space-y-3 rounded-md border p-4">
      <div>
        <div className="font-medium">{title}</div>
        <p className="mt-1 text-xs text-muted-foreground">Нашли причину — теперь можно улучшить систему.</p>
      </div>
      {items.length ? (
        items.map((item) => (
          <div key={item.key} className="flex items-center justify-between gap-3 text-sm">
            <span className="min-w-0 truncate">{item.label}</span>
            <Badge variant="outline">{item.value}</Badge>
          </div>
        ))
      ) : (
        <p className="text-sm text-muted-foreground">{empty}</p>
      )}
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
