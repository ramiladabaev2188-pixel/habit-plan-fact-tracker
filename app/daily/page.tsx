import Link from "next/link";
import { redirect } from "next/navigation";
import { closeMonthAction } from "@/app/actions";
import { DailyInput } from "@/components/daily/daily-input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { EmptyMonthState, ErrorState } from "@/components/shared/page-state";
import { SetupNotice } from "@/components/shared/setup-notice";
import { formatDayFull, getMonthDates, getTodayKey, toDateKey } from "@/lib/dates/month";
import { calculateDailyStats, calculateMonthStats, calculateTaskStats } from "@/lib/metrics";
import { getMainFocusTask } from "@/lib/recommendations";
import { loadTrackerData } from "@/lib/supabase/data";
import { formatPercent, formatScore } from "@/lib/utils";

export default async function DailyPage({
  searchParams
}: {
  searchParams: Promise<{ month?: string; date?: string }>;
}) {
  const params = await searchParams;
  const result = await loadTrackerData(params.month);
  const selectedDate = params.date ?? getTodayKey();

  if (!result.configured) {
    return <SetupNotice />;
  }

  if (!result.user) {
    redirect("/login");
  }

  if (result.error || !result.data) {
    return <ErrorState message={result.error ?? "Неизвестная ошибка"} />;
  }

  const { selectedMonth, months, plans, facts, tasks, categories, dailyNotes } = result.data;

  if (!selectedMonth) {
    return (
      <div className="md:pl-64">
        <EmptyMonthState />
      </div>
    );
  }

  const dayPlans = plans.filter((plan) => plan.date === selectedDate && plan.planned_value > 0);
  const dayStats = calculateDailyStats(dayPlans, facts, selectedDate, tasks);
  const yesterdayKey = shiftDateKey(selectedDate, -1);
  const yesterdayPlans = plans.filter((plan) => plan.date === yesterdayKey && plan.planned_value > 0);
  const yesterdayFacts = facts.filter((fact) => fact.date === yesterdayKey);
  const yesterdayFactKeys = new Set(yesterdayFacts.map((fact) => `${fact.task_id}:${fact.date}`));
  const hasUnfilledYesterday =
    yesterdayPlans.length > 0 &&
    yesterdayPlans.some((plan) => !yesterdayFactKeys.has(`${plan.task_id}:${plan.date}`));
  const monthStats = calculateMonthStats(plans, facts, tasks, selectedDate);
  const focusTask = getMainFocusTask(calculateTaskStats(plans, facts, tasks, selectedDate));
  const lastMonthDate = selectedMonth ? toDateKey(getMonthDates(selectedMonth.year, selectedMonth.month).at(-1) ?? new Date()) : selectedDate;
  const monthEnded = selectedMonth.status !== "closed" && lastMonthDate < getTodayKey();
  const dayNote = dailyNotes.find((note) => note.month_id === selectedMonth.id && note.date === selectedDate) ?? null;
  const items = dayPlans
    .map((plan) => {
      const task = tasks.find((item) => item.id === plan.task_id);

      if (!task) {
        return null;
      }

      return {
        task,
        plan,
        category: categories.find((category) => category.id === task.category_id) ?? null,
        fact:
          facts.find((fact) => fact.task_id === task.id && fact.date === selectedDate) ?? null
      };
    })
    .filter((item): item is NonNullable<typeof item> => Boolean(item));

  return (
    <div className="space-y-5 md:pl-64">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-normal">День</h1>
          <p className="text-sm text-muted-foreground">{formatDayFull(selectedDate)}</p>
        </div>
        <form className="grid gap-3 sm:grid-cols-[220px_180px_auto]" action="/daily">
          <div className="space-y-2">
            <Label>Месяц</Label>
            <Select name="month" defaultValue={selectedMonth.id}>
              {months.map((month) => (
                <option key={month.id} value={month.id}>
                  {month.title}
                </option>
              ))}
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Дата</Label>
            <Input name="date" type="date" defaultValue={selectedDate} />
          </div>
          <Button type="submit" className="self-end">Открыть</Button>
        </form>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Итог дня</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-md bg-muted/60 p-3">
            <div className="text-sm text-muted-foreground">Выполнение</div>
            <div className="text-2xl font-semibold">{formatPercent(dayStats.completion)}</div>
          </div>
          <div className="rounded-md bg-muted/60 p-3">
            <div className="text-sm text-muted-foreground">Факт</div>
            <div className="text-2xl font-semibold">{formatScore(dayStats.factScore)}</div>
          </div>
          <div className="rounded-md bg-muted/60 p-3">
            <div className="text-sm text-muted-foreground">План</div>
            <div className="text-2xl font-semibold">{formatScore(dayStats.planScore)}</div>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-3 lg:grid-cols-3">
        {hasUnfilledYesterday ? (
          <Card className="border-warning/50 bg-warning/10">
            <CardContent className="flex flex-col gap-3 p-4">
              <div>
                <div className="font-semibold">Вчера не заполнено</div>
                <p className="text-sm text-muted-foreground">Есть плановые задачи без факта за {yesterdayKey}.</p>
              </div>
              <Button asChild variant="outline" size="sm">
                <Link href={`/daily?month=${selectedMonth.id}&date=${yesterdayKey}`}>Открыть вчера</Link>
              </Button>
            </CardContent>
          </Card>
        ) : null}

        {monthStats.forecastPercent < 0.8 && monthStats.totalPlanScore > 0 ? (
          <Card className="border-destructive/40 bg-destructive/10">
            <CardContent className="p-4">
              <div className="font-semibold">Прогноз ниже 80%</div>
              <p className="text-sm text-muted-foreground">
                Текущий прогноз: {formatPercent(monthStats.forecastPercent)}. Нужен более плотный факт по задачам с весом.
              </p>
            </CardContent>
          </Card>
        ) : null}

        {focusTask && focusTask.requiredPerDay > 0 ? (
          <Card className="border-info/40 bg-info/10">
            <CardContent className="p-4">
              <div className="font-semibold">Главный фокус</div>
              <p className="text-sm text-muted-foreground">
                {focusTask.title}: {formatScore(focusTask.requiredPerDay)} балла в день.
              </p>
            </CardContent>
          </Card>
        ) : null}

        {monthEnded ? (
          <Card className="border-over/40 bg-over/10">
            <CardContent className="flex flex-col gap-3 p-4">
              <div>
                <div className="font-semibold">Месяц завершился</div>
                <p className="text-sm text-muted-foreground">Можно закрыть месяц и создать следующий из шаблона.</p>
              </div>
              <form action={closeMonthAction}>
                <input type="hidden" name="monthId" value={selectedMonth.id} />
                <Button type="submit" size="sm" variant="secondary">Закрыть месяц</Button>
              </form>
            </CardContent>
          </Card>
        ) : null}
      </div>

      <DailyInput
        monthId={selectedMonth.id}
        date={selectedDate}
        items={items}
        yesterdayFacts={yesterdayFacts}
        dailyNote={dayNote}
        readOnly={selectedMonth.status === "closed"}
      />
    </div>
  );
}

function shiftDateKey(dateKey: string, days: number) {
  const [year, month, day] = dateKey.split("-").map(Number);
  return toDateKey(new Date(year, month - 1, day + days));
}
