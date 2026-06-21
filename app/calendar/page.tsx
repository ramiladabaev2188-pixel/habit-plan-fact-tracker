import Link from "next/link";
import { redirect } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { EmptyMonthState, ErrorState } from "@/components/shared/page-state";
import { SetupNotice } from "@/components/shared/setup-notice";
import { getMonthDates, getTodayKey, toDateKey } from "@/lib/dates/month";
import { calculateDailyStats } from "@/lib/metrics";
import { loadTrackerData } from "@/lib/supabase/data";
import { cn, formatPercent, formatScore } from "@/lib/utils";

const weekDays = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];

export default async function CalendarPage({
  searchParams
}: {
  searchParams: Promise<{ month?: string; category?: string }>;
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

  const { selectedMonth, months, categories, tasks, plans, facts } = result.data;

  if (!selectedMonth) {
    return (
      <div>
        <EmptyMonthState />
      </div>
    );
  }

  const selectedCategory = params.category ?? "all";
  const allowedTaskIds = new Set(
    tasks
      .filter((task) => selectedCategory === "all" || task.category_id === selectedCategory)
      .map((task) => task.id)
  );
  const filteredPlans = plans.filter((plan) => allowedTaskIds.has(plan.task_id));
  const filteredFacts = facts.filter((fact) => allowedTaskIds.has(fact.task_id));
  const dates = getMonthDates(selectedMonth.year, selectedMonth.month);
  const firstOffset = (dates[0].getDay() + 6) % 7;
  const today = getTodayKey();

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-normal">Календарь</h1>
          <p className="text-sm text-muted-foreground">{selectedMonth.title}</p>
        </div>
        <form className="grid gap-3 sm:grid-cols-[220px_220px_auto]" action="/calendar">
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
            <Label>Категория</Label>
            <Select name="category" defaultValue={selectedCategory}>
              <option value="all">Все категории</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </Select>
          </div>
          <Button type="submit" className="self-end">Показать</Button>
        </form>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Карта месяца</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-7 gap-2">
            {weekDays.map((day) => (
              <div key={day} className="py-2 text-center text-xs font-medium text-muted-foreground">
                {day}
              </div>
            ))}
            {Array.from({ length: firstOffset }).map((_, index) => (
              <div key={`empty-${index}`} className="min-h-24 rounded-md bg-muted/30" />
            ))}
            {dates.map((date) => {
              const key = toDateKey(date);
              const stat = calculateDailyStats(filteredPlans, filteredFacts, key, tasks);
              const isFuture = key > today;
              const stateClass = getDayColor(stat.completion, stat.planScore, isFuture);

              return (
                <Link
                  key={key}
                  href={`/daily?month=${selectedMonth.id}&date=${key}`}
                  className={cn(
                    "min-h-24 rounded-md border p-2 transition-colors hover:ring-2 hover:ring-ring",
                    stateClass
                  )}
                >
                  <div className="flex items-start justify-between gap-2">
                    <span className="font-semibold">{date.getDate()}</span>
                    <Badge variant="outline">
                      {stat.planScore <= 0 ? "нет" : isFuture ? "план" : formatPercent(stat.completion)}
                    </Badge>
                  </div>
                  <div className="mt-4 text-xs text-muted-foreground">
                    {formatScore(stat.factScore)} / {formatScore(stat.planScore)}
                  </div>
                </Link>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function getDayColor(completion: number, planScore: number, isFuture: boolean) {
  if (planScore <= 0) {
    return "bg-muted/40 text-muted-foreground";
  }

  if (isFuture) {
    return "border-info/35 bg-info/10 text-muted-foreground";
  }

  if (completion >= 1) {
    return "border-over/40 bg-over/20";
  }

  if (completion >= 0.8) {
    return "border-success/40 bg-success/20";
  }

  if (completion >= 0.6) {
    return "border-warning/50 bg-warning/20";
  }

  return "border-destructive/40 bg-destructive/10";
}
