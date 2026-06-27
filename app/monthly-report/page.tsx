import { redirect } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { EmptyMonthState, ErrorState } from "@/components/shared/page-state";
import { SetupNotice } from "@/components/shared/setup-notice";
import {
  calculateCategoryStats,
  calculateDailyStats,
  calculateMonthStats,
  calculateStreaks,
  calculateTaskStats,
  calculateWeeklyReport
} from "@/lib/metrics";
import {
  generateMonthlyInsights,
  getNextActions,
  getRiskTasks,
  getStrongTasks
} from "@/lib/recommendations";
import { calculateFailureInsights } from "@/lib/reflection";
import { getMonthDates, getTodayKey, toDateKey } from "@/lib/dates/month";
import { loadTrackerData } from "@/lib/supabase/data";
import { formatPercent, formatScore } from "@/lib/utils";

export default async function MonthlyReportPage({
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

  const { selectedMonth, months, plans, facts, tasks, categories } = result.data;

  if (!selectedMonth) {
    return (
      <div>
        <EmptyMonthState />
      </div>
    );
  }

  const monthStats = calculateMonthStats(plans, facts, tasks);
  const taskStats = calculateTaskStats(plans, facts, tasks).filter((task) => task.planScore > 0);
  const monthDates = getMonthDates(selectedMonth.year, selectedMonth.month);
  const today = getTodayKey();
  const dailyStats = monthDates.map((date) => calculateDailyStats(plans, facts, toDateKey(date), tasks));
  const zeroFactDays = dailyStats.filter((day) => day.date <= today && day.planScore > 0 && day.factScore === 0);
  const weeklyReport = calculateWeeklyReport(selectedMonth, plans, facts, tasks, today);
  const rawCategoryStats = calculateCategoryStats(plans, facts, tasks, today);
  const categoryStats = rawCategoryStats.map((category) => {
    const categoryInfo = categories.find((item) => item.id === category.categoryId);
    const categoryTaskIds = new Set(
      tasks
        .filter((task) => (task.category_id ?? "Без категории") === category.categoryId)
        .map((task) => task.id)
    );
    const categoryTaskStats = taskStats.filter((task) => categoryTaskIds.has(task.taskId));
    const categoryDailyStats = monthDates.map((date) => {
      const key = toDateKey(date);
      return calculateDailyStats(
        plans.filter((plan) => categoryTaskIds.has(plan.task_id)),
        facts.filter((fact) => categoryTaskIds.has(fact.task_id)),
        key,
        tasks
      );
    });

    return {
      categoryId: String(category.categoryId),
      categoryName: categoryInfo?.name ?? "Без категории",
      completion: category.completion,
      planScore: category.planScore,
      factScore: category.factScore,
      forecastPercent: category.forecastPercent,
      requiredPerDay: categoryTaskStats.reduce((sum, task) => sum + task.requiredPerDay, 0),
      streak: calculateStreaks(categoryDailyStats, today).current80
    };
  });
  const insights = generateMonthlyInsights({
    monthCompletion: monthStats.monthCompletion,
    forecastPercent: monthStats.forecastPercent,
    targetPercent: selectedMonth.target_percent,
    taskStats,
    categoryStats,
    zeroFactDays
  });
  const nextActions = getNextActions({
    monthCompletion: monthStats.monthCompletion,
    forecastPercent: monthStats.forecastPercent,
    targetPercent: selectedMonth.target_percent,
    taskStats,
    categoryStats,
    zeroFactDays
  });
  const strongTasks = getStrongTasks(taskStats, 5);
  const weakTasks = getRiskTasks(taskStats, 5);
  const failureInsights = calculateFailureInsights(plans, facts, tasks, today);

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-normal">Отчет месяца</h1>
          <p className="text-sm text-muted-foreground">
            {selectedMonth.title}: {selectedMonth.year}-{String(selectedMonth.month).padStart(2, "0")}
          </p>
        </div>
        <form action="/monthly-report" className="grid gap-2 sm:grid-cols-[240px_auto] sm:items-end">
          <div className="space-y-2">
            <Label>Месяц</Label>
            <Select name="month" defaultValue={selectedMonth.id}>
              {months.map((month) => (
                <option key={month.id} value={month.id}>{month.title}</option>
              ))}
            </Select>
          </div>
          <Button type="submit">Открыть</Button>
        </form>
      </div>

      <div className="grid gap-4 lg:grid-cols-4">
        <ReportKpi label="Выполнение" value={formatPercent(monthStats.monthCompletion)} detail="факт / план месяца" />
        <ReportKpi label="Прогноз" value={formatPercent(monthStats.forecastPercent)} detail={`${formatScore(monthStats.forecastScore)} баллов`} />
        <ReportKpi label="Баллы" value={`${formatScore(monthStats.totalFactScore)} / ${formatScore(monthStats.totalPlanScore)}`} detail="факт / план" />
        <ReportKpi label="Нулевые дни" value={`${zeroFactDays.length}`} detail="дни с планом и нулевым фактом" />
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_1fr]">
        <Card>
          <CardHeader>
            <CardTitle>Выводы</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {insights.map((item) => (
              <div key={item} className="rounded-md border bg-muted/40 p-3 text-sm">{item}</div>
            ))}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Следующие действия</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {nextActions.map((item) => (
              <div key={item} className="rounded-md border p-3 text-sm">{item}</div>
            ))}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Почему срывается план</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 lg:grid-cols-3">
          <ReportList
            title="Причины"
            empty="Причины пока не отмечены. Это нормально: блок начнет помогать после нескольких дневных отметок."
            items={failureInsights.topReasons.map((item) => `${item.label}: ${item.count} раз`)}
          />
          <ReportList
            title="Задачи"
            empty="Пока нет повторяющихся провалов по задачам."
            items={failureInsights.missedTasks.map((item) => `${item.title}: ${item.count} дн.`)}
          />
          <ReportList
            title="Дни недели"
            empty="Недостаточно данных по дням недели."
            items={failureInsights.missedWeekdays.map((item) => `${item.label}: ${item.count}`)}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Категории</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto rounded-md border">
            <table className="min-w-[780px] w-full text-sm">
              <thead className="bg-muted/60">
                <tr>
                  <th className="p-3 text-left font-medium">Категория</th>
                  <th className="p-3 text-right font-medium">Факт %</th>
                  <th className="p-3 text-right font-medium">Прогноз %</th>
                  <th className="p-3 text-right font-medium">Нужно/день</th>
                  <th className="p-3 text-right font-medium">Стрик 80%+</th>
                </tr>
              </thead>
              <tbody>
                {categoryStats.map((category) => (
                  <tr key={category.categoryId} className="border-t">
                    <td className="p-3 font-medium">{category.categoryName}</td>
                    <td className="p-3 text-right">{formatPercent(category.completion)}</td>
                    <td className="p-3 text-right">{formatPercent(category.forecastPercent ?? 0)}</td>
                    <td className="p-3 text-right">{formatScore(category.requiredPerDay ?? 0)}</td>
                    <td className="p-3 text-right">{category.streak} дн.</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Недельный ритм</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {weeklyReport.map((week) => (
              <div key={week.weekNumber} className="flex items-center justify-between gap-3 rounded-md border p-3">
                <div>
                  <div className="font-medium">Неделя {week.weekNumber}</div>
                  <div className="text-sm text-muted-foreground">{formatScore(week.factScore)} / {formatScore(week.planScore)}</div>
                </div>
                <Badge variant={week.completion >= 0.8 ? "success" : "warning"}>{formatPercent(week.completion)}</Badge>
              </div>
            ))}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Лучшие задачи</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {strongTasks.map((task) => (
              <TaskRow key={task.taskId} title={task.title} value={formatPercent(task.completion)} />
            ))}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Слабые задачи</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {weakTasks.map((task) => (
              <TaskRow key={task.taskId} title={task.title} value={formatPercent(task.completion)} />
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function ReportKpi({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <Card>
      <CardContent className="p-5">
        <div className="text-sm text-muted-foreground">{label}</div>
        <div className="mt-2 text-2xl font-semibold tracking-normal">{value}</div>
        <div className="mt-1 text-sm text-muted-foreground">{detail}</div>
      </CardContent>
    </Card>
  );
}

function TaskRow({ title, value }: { title: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-md border p-3 text-sm">
      <span className="min-w-0 truncate font-medium">{title}</span>
      <Badge variant="outline">{value}</Badge>
    </div>
  );
}

function ReportList({ title, empty, items }: { title: string; empty: string; items: string[] }) {
  return (
    <div className="space-y-3 rounded-md border p-4">
      <div className="font-medium">{title}</div>
      {items.length ? (
        items.map((item) => (
          <div key={item} className="rounded-md bg-muted/40 p-3 text-sm">{item}</div>
        ))
      ) : (
        <p className="text-sm text-muted-foreground">{empty}</p>
      )}
      <p className="text-xs text-muted-foreground">Нашли причину — теперь можно улучшить систему.</p>
    </div>
  );
}
