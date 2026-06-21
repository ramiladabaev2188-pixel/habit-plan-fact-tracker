import Link from "next/link";
import { redirect } from "next/navigation";
import { closeMonthAction, unlockMonthAction } from "@/app/actions";
import { MonthComparisonChart } from "@/components/charts/month-comparison-chart";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ConfirmSubmitButton } from "@/components/shared/confirm-submit-button";
import { ErrorState } from "@/components/shared/page-state";
import { SetupNotice } from "@/components/shared/setup-notice";
import { calculateMonthStats, calculateTaskStats } from "@/lib/metrics";
import { getMainFocusTask } from "@/lib/recommendations";
import { loadHistoryPage } from "@/lib/supabase/data";
import { formatPercent, formatScore } from "@/lib/utils";
import type { DailyFact, DailyPlan, Month, Task } from "@/types/domain";

export default async function HistoryPage({
  searchParams
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const params = await searchParams;
  const pageSize = 8;
  const currentPage = Math.max(1, Number(params.page ?? 1) || 1);
  const result = await loadHistoryPage({ page: currentPage, pageSize });

  if (!result.configured) {
    return <SetupNotice />;
  }

  if (!result.user) {
    redirect("/login");
  }

  if (result.error || !result.data) {
    return <ErrorState message={result.error ?? "Неизвестная ошибка"} />;
  }

  const { months, chartMonths, tasks, plans, facts, total } = result.data;
  const rows = buildRows(months, plans, facts, tasks);
  const chartRows = buildRows(chartMonths, plans, facts, tasks);
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold tracking-normal">История месяцев</h1>
        <p className="text-sm text-muted-foreground">Сравнение месяцев, статусы и доступ к отчетам.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Сравнение месяцев</CardTitle>
        </CardHeader>
        <CardContent>
          <MonthComparisonChart
            data={chartRows
              .slice()
              .reverse()
              .map((row) => ({
                title: row.month.title,
                completion: row.stats.monthCompletion,
                forecast: row.stats.forecastPercent
              }))}
          />
        </CardContent>
      </Card>

      <div className="grid gap-4">
        {rows.map(({ month, stats, focus }) => (
          <Card key={month.id}>
            <CardContent className="grid gap-4 p-5 lg:grid-cols-[1fr_auto] lg:items-center">
              <div className="space-y-3">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-lg font-semibold">{month.title}</h2>
                  <Badge variant={month.status === "closed" ? "secondary" : month.status === "approved" ? "success" : "info"}>
                    {month.status}
                  </Badge>
                </div>
                <div className="grid gap-3 sm:grid-cols-4">
                  <SmallStat label="Выполнение" value={formatPercent(stats.monthCompletion)} />
                  <SmallStat label="Прогноз" value={formatPercent(stats.forecastPercent)} />
                  <SmallStat label="Баллы" value={`${formatScore(stats.totalFactScore)} / ${formatScore(stats.totalPlanScore)}`} />
                  <SmallStat label="Фокус" value={focus?.title ?? "Нет данных"} />
                </div>
              </div>
              <div className="flex flex-wrap gap-2 lg:justify-end">
                <Button asChild variant="outline" size="sm">
                  <Link href={`/monthly-report?month=${month.id}`}>Открыть отчет</Link>
                </Button>
                {month.status === "closed" ? (
                  <form action={unlockMonthAction}>
                    <input type="hidden" name="monthId" value={month.id} />
                    <ConfirmSubmitButton
                      type="submit"
                      variant="warning"
                      size="sm"
                      message="Разблокировать закрытый месяц и снова разрешить редактирование фактов?"
                    >
                      Разблокировать месяц
                    </ConfirmSubmitButton>
                  </form>
                ) : (
                  <form action={closeMonthAction}>
                    <input type="hidden" name="monthId" value={month.id} />
                    <ConfirmSubmitButton
                      type="submit"
                      variant="secondary"
                      size="sm"
                      message="Закрыть месяц? Факты станут доступны только для просмотра до разблокировки."
                    >
                      Закрыть месяц
                    </ConfirmSubmitButton>
                  </form>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {total > pageSize ? (
        <div className="flex items-center justify-between gap-3 rounded-lg border bg-card p-3">
          <Button asChild variant="outline" size="sm">
            <Link href={`/history?page=${Math.max(1, currentPage - 1)}`}>Назад</Link>
          </Button>
          <div className="text-sm text-muted-foreground">
            Страница {currentPage} из {totalPages}
          </div>
          <Button asChild variant="outline" size="sm">
            <Link href={`/history?page=${Math.min(totalPages, currentPage + 1)}`}>Вперед</Link>
          </Button>
        </div>
      ) : null}
    </div>
  );
}

function buildRows(
  months: Month[],
  plans: DailyPlan[],
  facts: DailyFact[],
  tasks: Task[]
) {
  return months.map((month) => {
    const monthPlans = plans.filter((plan) => plan.month_id === month.id);
    const monthFacts = facts.filter((fact) => fact.month_id === month.id);
    const stats = calculateMonthStats(monthPlans, monthFacts, tasks);
    const focus = getMainFocusTask(calculateTaskStats(monthPlans, monthFacts, tasks));
    return { month, stats, focus };
  });
}

function SmallStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md bg-muted/50 p-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-1 truncate text-sm font-semibold">{value}</div>
    </div>
  );
}
