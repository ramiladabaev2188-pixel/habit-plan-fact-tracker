import { redirect } from "next/navigation";
import { generateWeeklyRecommendations } from "@/lib/recommendations";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { EmptyMonthState, ErrorState } from "@/components/shared/page-state";
import { SetupNotice } from "@/components/shared/setup-notice";
import { calculateWeeklyReport } from "@/lib/metrics";
import { loadTrackerData } from "@/lib/supabase/data";
import { formatPercent, formatScore } from "@/lib/utils";

export default async function WeeklyPage({
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

  const { selectedMonth, months, plans, facts, tasks } = result.data;

  if (!selectedMonth) {
    return (
      <div>
        <EmptyMonthState />
      </div>
    );
  }

  const weeklyReport = calculateWeeklyReport(selectedMonth, plans, facts, tasks);

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-normal">Недельный отчет</h1>
          <p className="text-sm text-muted-foreground">{selectedMonth.title}</p>
        </div>
        <form action="/weekly" className="grid gap-2 sm:grid-cols-[240px_auto] sm:items-end">
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

      <div className="grid gap-4">
        {weeklyReport.map((week) => {
          const recommendations = generateWeeklyRecommendations(week);

          return (
            <Card key={week.weekNumber}>
              <CardHeader>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <CardTitle>Неделя {week.weekNumber}</CardTitle>
                    <p className="text-sm text-muted-foreground">
                      {week.startDate.slice(-2)}–{week.endDate.slice(-2)} число
                    </p>
                  </div>
                  <Badge variant={week.timeState === "future" ? "outline" : week.pacePercent >= 1 ? "over" : week.pacePercent >= 0.8 ? "success" : week.pacePercent >= 0.6 ? "warning" : week.planScore > 0 ? "destructive" : "outline"}>
                    {week.status}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="grid gap-4 lg:grid-cols-[1fr_1fr_1fr]">
                <div className="space-y-3 rounded-md border p-4">
                  <div className="text-sm text-muted-foreground">{week.timeState === "past" ? "Итог недели" : "Темп недели"}</div>
                  <div className="text-3xl font-semibold">{week.timeState === "future" ? "—" : formatPercent(week.pacePercent)}</div>
                  <div className="text-sm text-muted-foreground">
                    {week.timeState === "past"
                      ? `${formatScore(week.factScore)} / ${formatScore(week.planScore)} баллов`
                      : `${formatScore(week.factScore)} / ${formatScore(week.planScoreToDate)} баллов по пройденному плану`}
                  </div>
                  <p className="text-sm">{week.comment}</p>
                </div>
                <div className="space-y-3 rounded-md border p-4">
                  <div className="font-medium">Просели</div>
                  {week.weakTasks.length ? (
                    week.weakTasks.map((task) => (
                      <div key={task.taskId} className="flex justify-between gap-3 text-sm">
                        <span>{task.title}</span>
                        <span className="font-medium">{formatPercent(task.completion)}</span>
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-muted-foreground">Просадок нет.</p>
                  )}
                </div>
                <div className="space-y-3 rounded-md border p-4">
                  <div className="font-medium">Вытянули</div>
                  {week.strongTasks.length ? (
                    week.strongTasks.map((task) => (
                      <div key={task.taskId} className="flex justify-between gap-3 text-sm">
                        <span>{task.title}</span>
                        <span className="font-medium">{formatPercent(task.completion)}</span>
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-muted-foreground">Пока нет сильных задач.</p>
                  )}
                  <div className="pt-2">
                    <div className="mb-2 text-sm font-medium">Рекомендации</div>
                    <ul className="space-y-1 text-sm text-muted-foreground">
                      {recommendations.map((item) => (
                        <li key={item}>{item}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
