import Link from "next/link";
import { redirect } from "next/navigation";
import { closeMonthAction } from "@/app/actions";
import { DailyInput } from "@/components/daily/daily-input";
import { Button } from "@/components/ui/button";
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
  const result = await loadTrackerData(params.month, { includeGoals: true });
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

  const { selectedMonth, months, plans, facts, tasks, categories, lifeAreas, goals, goalTasks, dailyNotes } = result.data;

  if (!selectedMonth) {
    return (
      <div>
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
  const dayContribution = calculateDayContribution({
    items,
    facts,
    selectedDate,
    lifeAreas,
    goals,
    goalTasks
  });
  const unlinkedCategories = [
    ...new Map(
      items
        .filter((item) => item.category && !item.category.life_area_id)
        .map((item) => [item.category!.id, item.category!])
    ).values()
  ];
  const filledTodayCount = items.filter((item) => item.fact).length;
  const mainNextStep =
    !items.length
      ? {
          title: "Собрать план на день",
          detail: "На выбранную дату нет плановых действий. Добавьте задачу или сгенерируйте план.",
          href: `/planner?month=${selectedMonth.id}`,
          cta: "Перейти к планированию"
        }
      : filledTodayCount < items.length
        ? {
            title: "Закрыть факт за сегодня",
            detail: `Заполнено ${filledTodayCount} из ${items.length}. Сначала внесите факт, затем смотрите аналитику.`,
            href: "#daily-input",
            cta: "К вводу факта"
          }
        : focusTask && focusTask.requiredPerDay > 0
          ? {
              title: focusTask.title,
              detail: `Главный фокус месяца: нужно ${formatScore(focusTask.requiredPerDay)} балла в день.`,
              href: "/dashboard",
              cta: "Открыть дашборд"
            }
          : {
              title: "День закрыт",
              detail: "Факт заполнен. Следующий шаг — коротко отметить ресурс и вывод дня.",
              href: "#daily-rhythm",
              cta: "К ритму дня"
            };

  return (
    <div className="app-page app-page-with-rail daily-page">
      <div className="workspace-header">
        <div>
          <div className="page-kicker">Ежедневный ритм</div>
          <h1 className="workspace-title mt-1">Сегодня</h1>
          <p className="workspace-subtitle">{formatDayFull(selectedDate)}. Быстро зафиксируйте факт и оставьте короткую заметку.</p>
        </div>
        <form className="grid w-full gap-3 sm:grid-cols-[minmax(0,1fr)_180px_auto] lg:w-auto lg:grid-cols-[220px_180px_auto]" action="/daily">
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

      <section className="signal-panel grid gap-4 lg:grid-cols-[1.1fr_0.9fr_auto]" aria-label="Сейчас главное">
        <div>
          <div className="page-kicker">Сейчас главное</div>
          <h2 className="mt-2 text-2xl font-semibold tracking-normal">{mainNextStep.title}</h2>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">{mainNextStep.detail}</p>
        </div>
        <div className="rounded-md border border-border/75 bg-card/70 p-4">
          <div className="text-sm text-muted-foreground">Статус дня</div>
          <div className="data-value mt-2 text-3xl">{formatPercent(dayStats.completion)}</div>
          <div className="mt-1 text-xs text-muted-foreground">
            {filledTodayCount} из {items.length} фактов заполнено
          </div>
        </div>
        <Button asChild className="self-end">
          <Link href={mainNextStep.href}>{mainNextStep.cta}</Link>
        </Button>
      </section>

      <section className="daily-score-rail" aria-label="Итог дня">
        <div className="daily-score-cell">
          <div className="text-sm text-muted-foreground">Выполнение</div>
          <div className="data-value mt-2 text-4xl">{formatPercent(dayStats.completion)}</div>
          <div className="mt-2 text-sm text-muted-foreground">Факт относительно плана</div>
        </div>
        <div className="daily-score-cell">
          <div className="text-sm text-muted-foreground">Факт</div>
          <div className="data-value mt-2 text-4xl">{formatScore(dayStats.factScore)}</div>
          <div className="mt-2 text-sm text-muted-foreground">Баллов за выбранный день</div>
        </div>
        <div className="daily-score-cell">
          <div className="text-sm text-muted-foreground">План</div>
          <div className="data-value mt-2 text-4xl">{formatScore(dayStats.planScore)}</div>
          <div className="mt-2 text-sm text-muted-foreground">Баллов запланировано</div>
        </div>
      </section>

      <div className="grid gap-3 lg:grid-cols-3">
        {hasUnfilledYesterday ? (
          <div className="signal-panel flex flex-col gap-3 border-warning/35 bg-warning/10">
              <div>
                <div className="font-semibold">Вчера не заполнено</div>
                <p className="text-sm text-muted-foreground">Есть плановые задачи без факта за {yesterdayKey}.</p>
              </div>
              <Button asChild variant="outline" size="sm">
                <Link href={`/daily?month=${selectedMonth.id}&date=${yesterdayKey}`}>Открыть вчера</Link>
              </Button>
          </div>
        ) : null}

        {monthStats.forecastPercent < 0.8 && monthStats.totalPlanScore > 0 ? (
          <div className="signal-panel border-destructive/30 bg-destructive/10">
              <div className="font-semibold">Прогноз ниже 80%</div>
              <p className="text-sm text-muted-foreground">
                Текущий прогноз: {formatPercent(monthStats.forecastPercent)}. Нужен более плотный факт по задачам с весом.
              </p>
          </div>
        ) : null}

        {focusTask && focusTask.requiredPerDay > 0 ? (
          <div className="signal-panel border-signal/30 bg-signal/10">
              <div className="font-semibold">Главный фокус</div>
              <p className="text-sm text-muted-foreground">
                {focusTask.title}: {formatScore(focusTask.requiredPerDay)} балла в день.
              </p>
          </div>
        ) : null}

        {monthEnded ? (
          <div className="signal-panel flex flex-col gap-3 border-over/30 bg-over/10">
              <div>
                <div className="font-semibold">Месяц завершился</div>
                <p className="text-sm text-muted-foreground">Можно закрыть месяц и создать следующий из шаблона.</p>
              </div>
              <form action={closeMonthAction}>
                <input type="hidden" name="monthId" value={selectedMonth.id} />
                <Button type="submit" size="sm" variant="secondary">Закрыть месяц</Button>
              </form>
          </div>
        ) : null}
      </div>

      {items.length ? (
        <>
          <section className="grid gap-3 lg:grid-cols-3" aria-label="Сегодняшний вклад">
            <div className="signal-panel lg:col-span-2">
              <div className="font-semibold">Сегодняшний вклад</div>
              <p className="mt-1 text-sm text-muted-foreground">
                Факт дня уже двигает не только месячный процент, но и сферы жизни с целями.
              </p>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                {dayContribution.areas.length ? (
                  dayContribution.areas.map((area) => (
                    <div key={area.id} className="rounded-md border bg-card/70 p-3">
                      <div className="flex items-center justify-between gap-3">
                        <span className="font-medium">{area.name}</span>
                        <span className="text-sm text-muted-foreground">{formatPercent(area.completion)}</span>
                      </div>
                      <div className="mt-1 text-xs text-muted-foreground">
                        {formatScore(area.factScore)} / {formatScore(area.planScore)} баллов
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-muted-foreground">Пока нет факта по задачам, связанным со сферами.</p>
                )}
              </div>
              {unlinkedCategories.length ? (
                <div className="mt-4 rounded-md border border-warning/35 bg-warning/10 p-3">
                  <div className="font-medium">Есть категории без сферы жизни</div>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {unlinkedCategories.map((category) => category.name).join(", ")} не попадают в индекс развития, пока вы не свяжете их со сферой.
                  </p>
                  <Button asChild size="sm" variant="outline" className="mt-3">
                    <Link href="/planner">Связать со сферой</Link>
                  </Button>
                </div>
              ) : null}
              {!lifeAreas.length ? (
                <div className="mt-4 rounded-md border border-info/35 bg-info/10 p-3">
                  <div className="font-medium">Сферы жизни не созданы</div>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Создайте сферы, чтобы Today показывал вклад дня в развитие, а не только баллы месяца.
                  </p>
                  <Button asChild size="sm" variant="outline" className="mt-3">
                    <Link href="/growth">Создать сферы жизни</Link>
                  </Button>
                </div>
              ) : null}
            </div>
            <div className="signal-panel">
              <div className="font-semibold">Цели и слабое место</div>
              {dayContribution.goals.length ? (
                <div className="mt-3 space-y-2">
                  {dayContribution.goals.map((goal) => (
                    <div key={goal.id} className="rounded-md border bg-card/70 p-3 text-sm">
                      <div className="font-medium">{goal.title}</div>
                      <div className="text-xs text-muted-foreground">Получила вклад через выполненные задачи</div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="mt-2 text-sm text-muted-foreground">Свяжите задачи с целями, чтобы видеть вклад дня в цели.</p>
              )}
              {dayContribution.weakArea ? (
                <p className="mt-4 text-sm text-muted-foreground">
                  Слабое место дня: <span className="font-medium text-foreground">{dayContribution.weakArea.name}</span>.
                </p>
              ) : null}
            </div>
          </section>

          <div id="daily-input" />
          <DailyInput
            monthId={selectedMonth.id}
            date={selectedDate}
            items={items}
            yesterdayFacts={yesterdayFacts}
            dailyNote={dayNote}
            readOnly={selectedMonth.status === "closed"}
          />
        </>
      ) : (
        <div className="signal-panel border-info/30 bg-info/10">
          <div className="font-semibold">На выбранный день нет плана</div>
          <p className="mt-1 text-sm text-muted-foreground">
            Чтобы день попал в аналитику, добавьте задачу или сгенерируйте план в календарной таблице.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button asChild>
              <Link href={`/planner?month=${selectedMonth.id}`}>Создать план</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/planner">Добавить задачу</Link>
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function calculateDayContribution({
  items,
  facts,
  selectedDate,
  lifeAreas,
  goals,
  goalTasks
}: {
  items: Array<{
    task: { id: string; category_id: string | null };
    plan: { planned_score: number };
    category: { id: string; name: string; life_area_id?: string | null } | null;
  }>;
  facts: Array<{ task_id: string; date: string; actual_score: number }>;
  selectedDate: string;
  lifeAreas: Array<{ id: string; name: string }>;
  goals: Array<{ id: string; title: string; status: string }>;
  goalTasks: Array<{ goal_id: string; task_id: string }>;
}) {
  const factByTask = new Map(
    facts
      .filter((fact) => fact.date === selectedDate)
      .map((fact) => [fact.task_id, fact.actual_score])
  );
  const areaById = new Map(lifeAreas.map((area) => [area.id, area]));
  const areaStats = new Map<string, { id: string; name: string; factScore: number; planScore: number }>();
  const progressedTaskIds = new Set<string>();

  for (const item of items) {
    const areaId = item.category?.life_area_id ?? null;
    if (!areaId) continue;

    const area = areaById.get(areaId);
    if (!area) continue;

    const factScore = factByTask.get(item.task.id) ?? 0;
    if (factScore > 0) progressedTaskIds.add(item.task.id);

    const stat = areaStats.get(areaId) ?? { id: areaId, name: area.name, factScore: 0, planScore: 0 };
    stat.factScore += factScore;
    stat.planScore += item.plan.planned_score;
    areaStats.set(areaId, stat);
  }

  const linkedGoalIds = new Set(
    goalTasks
      .filter((relation) => progressedTaskIds.has(relation.task_id))
      .map((relation) => relation.goal_id)
  );
  const linkedGoals = goals.filter((goal) => goal.status === "active" && linkedGoalIds.has(goal.id)).slice(0, 4);
  const areas = [...areaStats.values()]
    .map((area) => ({
      ...area,
      completion: area.planScore > 0 ? area.factScore / area.planScore : 0
    }))
    .sort((a, b) => b.factScore - a.factScore);

  return {
    areas,
    goals: linkedGoals,
    weakArea: areas.filter((area) => area.planScore > 0).sort((a, b) => a.completion - b.completion)[0] ?? null
  };
}

function shiftDateKey(dateKey: string, days: number) {
  const [year, month, day] = dateKey.split("-").map(Number);
  return toDateKey(new Date(year, month - 1, day + days));
}
