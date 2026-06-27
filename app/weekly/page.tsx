import { redirect } from "next/navigation";
import { upsertWeeklyReviewAction } from "@/app/actions";
import { generateWeeklyRecommendations } from "@/lib/recommendations";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
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
  const result = await loadTrackerData(params.month, { includeWeeklyReviews: true });

  if (!result.configured) {
    return <SetupNotice />;
  }

  if (!result.user) {
    redirect("/login");
  }

  if (result.error || !result.data) {
    return <ErrorState message={result.error ?? "Неизвестная ошибка"} />;
  }

  const { selectedMonth, months, plans, facts, tasks, weeklyReviews } = result.data;

  if (!selectedMonth) {
    return <EmptyMonthState />;
  }

  const weeklyReport = calculateWeeklyReport(selectedMonth, plans, facts, tasks);
  const reviewsByWeek = new Map(weeklyReviews.map((review) => [review.week_number, review]));

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
                <option key={month.id} value={month.id}>
                  {month.title}
                </option>
              ))}
            </Select>
          </div>
          <Button type="submit">Открыть</Button>
        </form>
      </div>

      <div className="grid gap-4">
        {weeklyReport.map((week) => {
          const recommendations = generateWeeklyRecommendations(week);
          const review = reviewsByWeek.get(week.weekNumber);

          return (
            <Card key={week.weekNumber}>
              <CardHeader>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <CardTitle>Неделя {week.weekNumber}</CardTitle>
                    <p className="text-sm text-muted-foreground">
                      {week.startDate.slice(-2)}-{week.endDate.slice(-2)} число
                    </p>
                  </div>
                  <Badge
                    variant={
                      week.timeState === "future"
                        ? "outline"
                        : week.pacePercent >= 1
                          ? "over"
                          : week.pacePercent >= 0.8
                            ? "success"
                            : week.pacePercent >= 0.6
                              ? "warning"
                              : week.planScore > 0
                                ? "destructive"
                                : "outline"
                    }
                  >
                    {week.status}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 lg:grid-cols-[1fr_1fr_1fr]">
                  <div className="space-y-3 rounded-md border p-4">
                    <div className="text-sm text-muted-foreground">
                      {week.timeState === "past" ? "Итог недели" : "Темп недели"}
                    </div>
                    <div className="text-3xl font-semibold">
                      {week.timeState === "future" ? "-" : formatPercent(week.pacePercent)}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {week.timeState === "past"
                        ? `${formatScore(week.factScore)} / ${formatScore(week.planScore)} баллов`
                        : `${formatScore(week.factScore)} / ${formatScore(week.planScoreToDate)} баллов по прошедшему плану`}
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
                </div>

                <form action={upsertWeeklyReviewAction} className="rounded-md border bg-muted/25 p-4">
                  <input type="hidden" name="monthId" value={selectedMonth.id} />
                  <input type="hidden" name="weekNumber" value={week.weekNumber} />
                  <input type="hidden" name="startDate" value={week.startDate} />
                  <input type="hidden" name="endDate" value={week.endDate} />
                  <div className="mb-4">
                    <div className="font-medium">Ручной разбор недели</div>
                    <p className="text-sm text-muted-foreground">
                      Без обвинений: фиксируем, что работало, что мешало, и как упростить следующую неделю.
                    </p>
                  </div>
                  <div className="grid gap-3 lg:grid-cols-2">
                    <ReviewField name="workedWell" label="Что получилось?" defaultValue={review?.worked_well} />
                    <ReviewField name="didntWork" label="Что не получилось?" defaultValue={review?.didnt_work} />
                    <ReviewField name="blockers" label="Что мешало?" defaultValue={review?.blockers} />
                    <ReviewField name="repeatNext" label="Что повторить?" defaultValue={review?.repeat_next} />
                    <ReviewField name="removeNext" label="Что убрать?" defaultValue={review?.remove_next} />
                    <ReviewField name="lesson" label="Главный урок недели" defaultValue={review?.lesson} />
                    <div className="lg:col-span-2">
                      <ReviewField
                        name="nextWeekFocus"
                        label="Главный фокус следующей недели"
                        defaultValue={review?.next_week_focus}
                      />
                    </div>
                  </div>
                  <div className="mt-4 flex justify-end">
                    <Button type="submit">{review ? "Обновить разбор" : "Сохранить разбор"}</Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

function ReviewField({ name, label, defaultValue }: { name: string; label: string; defaultValue?: string | null }) {
  return (
    <div className="space-y-2">
      <Label htmlFor={`${name}-review`}>{label}</Label>
      <Textarea id={`${name}-review`} name={name} defaultValue={defaultValue ?? ""} className="min-h-20" />
    </div>
  );
}
