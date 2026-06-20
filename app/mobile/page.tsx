import Link from "next/link";
import { redirect } from "next/navigation";
import { CalendarDays, Gauge, ListChecks, Smartphone, Users } from "lucide-react";
import { DailyInput } from "@/components/daily/daily-input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Select } from "@/components/ui/select";
import { EmptyMonthState, ErrorState } from "@/components/shared/page-state";
import { SetupNotice } from "@/components/shared/setup-notice";
import { getTodayKey, toDateKey } from "@/lib/dates/month";
import { calculateDailyStats, calculateMonthStats, calculateTaskStats, getCompletionStatus } from "@/lib/metrics";
import { getMainFocusTask } from "@/lib/recommendations";
import { loadTrackerData } from "@/lib/supabase/data";
import { loadTeamDashboardData } from "@/lib/supabase/team-data";
import { calculateTeamStats } from "@/lib/team-metrics";
import { cn, formatPercent, formatScore } from "@/lib/utils";

export default async function MobilePage({
  searchParams
}: {
  searchParams: Promise<{ month?: string; date?: string }>;
}) {
  const params = await searchParams;
  const selectedDate = params.date ?? getTodayKey();
  const result = await loadTrackerData(params.month);

  if (!result.configured) {
    return <SetupNotice />;
  }

  if (!result.user) {
    redirect("/login");
  }

  if (result.error || !result.data) {
    return <ErrorState message={result.error ?? "Не удалось загрузить мобильный экран"} />;
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
  const monthStats = calculateMonthStats(plans, facts, tasks, selectedDate);
  const monthStatus = getCompletionStatus(monthStats.monthCompletion);
  const taskStats = calculateTaskStats(plans, facts, tasks, selectedDate);
  const focusTask = getMainFocusTask(taskStats);
  const yesterdayKey = shiftDateKey(selectedDate, -1);
  const yesterdayFacts = facts.filter((fact) => fact.date === yesterdayKey);
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
        fact: facts.find((fact) => fact.task_id === task.id && fact.date === selectedDate) ?? null
      };
    })
    .filter((item): item is NonNullable<typeof item> => Boolean(item));

  const teamResult = await loadTeamDashboardData({
    year: selectedMonth.year,
    month: selectedMonth.month
  });
  const teamData = teamResult.data;
  const teamStats = teamData?.selectedTeam
    ? calculateTeamStats(
        teamData.members.map((member) => {
          const memberMonth = teamData.months.find((month) => month.user_id === member.user_id) ?? null;
          const memberTasks = teamData.tasks.filter((task) => task.user_id === member.user_id);
          const taskIds = new Set(memberTasks.map((task) => task.id));

          return {
            userId: member.user_id,
            profile: teamData.profiles.find((profile) => profile.id === member.user_id) ?? null,
            month: memberMonth,
            tasks: memberTasks,
            plans: memberMonth
              ? teamData.plans.filter((plan) => plan.month_id === memberMonth.id && taskIds.has(plan.task_id))
              : [],
            facts: memberMonth
              ? teamData.facts.filter((fact) => fact.month_id === memberMonth.id && taskIds.has(fact.task_id))
              : []
          };
        }),
        selectedDate
      )
    : null;

  return (
    <div className="app-page app-page-with-rail mx-auto max-w-2xl pb-24 mobile-page">
      <section className="mobile-hero">
        <div className="p-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <Badge variant="secondary" className="mb-3 bg-fog text-muted-foreground">
                <Smartphone className="mr-1 h-3.5 w-3.5" />
                Телефон
              </Badge>
              <h1 className="text-3xl font-normal tracking-tight">Сегодня</h1>
              <p className="text-sm text-muted-foreground">{selectedDate}</p>
            </div>
            <div className="rounded-lg bg-fog p-3 text-signal">
              <ListChecks className="h-7 w-7" strokeWidth={1.7} />
            </div>
          </div>
        </div>
        <div className="space-y-4 border-t border-border bg-card p-4 text-card-foreground">
          <form className="grid grid-cols-[1fr_auto] gap-2" action="/mobile">
            <input type="hidden" name="month" value={selectedMonth.id} />
            <div className="space-y-2">
              <Label htmlFor="mobile-date">Дата</Label>
              <Input id="mobile-date" name="date" type="date" defaultValue={selectedDate} />
            </div>
            <Button type="submit" className="self-end">
              Открыть
            </Button>
          </form>

          <div className="grid grid-cols-3 gap-2">
            <MobileMetric label="День" value={formatPercent(dayStats.completion)} tone={dayStats.completion >= 0.8 ? "success" : "warning"} />
            <MobileMetric label="Факт" value={formatScore(dayStats.factScore)} tone="info" />
            <MobileMetric label="План" value={formatScore(dayStats.planScore)} tone="info" />
          </div>
        </div>
      </section>

      <div className="grid grid-cols-2 gap-2">
        <Button asChild size="lg" className="h-14">
          <Link href={`/daily?month=${selectedMonth.id}&date=${selectedDate}`}>
            <ListChecks className="h-5 w-5" />
            День
          </Link>
        </Button>
        <Button asChild size="lg" variant="outline" className="h-14">
          <Link href="/team">
            <Users className="h-5 w-5" />
            Команда
          </Link>
        </Button>
        <Button asChild variant="outline" className="h-12">
          <Link href={`/calendar?month=${selectedMonth.id}`}>
            <CalendarDays className="h-4 w-4" />
            Календарь
          </Link>
        </Button>
        <Button asChild variant="outline" className="h-12">
          <Link href={`/dashboard?month=${selectedMonth.id}`}>
            <Gauge className="h-4 w-4" />
            Дашборд
          </Link>
        </Button>
      </div>

      <section className="dashboard-readout" aria-label="Итог месяца">
        <div className="p-5">
          <div className="flex items-center justify-between gap-3">
            <div className="text-sm font-medium text-muted-foreground">Итог месяца</div>
            <Badge variant={monthStatus.level === "danger" ? "destructive" : monthStatus.level}>
              {monthStatus.label}
            </Badge>
          </div>
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="data-value mt-4 text-4xl">{formatPercent(monthStats.monthCompletion)}</div>
              <div className="text-sm text-muted-foreground">
                {formatScore(monthStats.currentFactScore)} / {formatScore(monthStats.totalPlanScore)} баллов
              </div>
            </div>
          </div>
          <Progress
            value={Math.min(monthStats.monthCompletion, 1.2) * 100}
            indicatorClassName={cn(
              monthStatus.level === "over" && "bg-over",
              monthStatus.level === "success" && "bg-success",
              monthStatus.level === "warning" && "bg-warning",
              monthStatus.level === "danger" && "bg-destructive"
            )}
          />
          <div className="mt-4 grid grid-cols-2 gap-2 text-sm">
            <div className="rounded-md bg-muted/55 p-3">
              <div className="text-muted-foreground">Прогноз</div>
              <div className="font-semibold">{formatPercent(monthStats.forecastPercent)}</div>
            </div>
            <div className="rounded-md bg-muted/55 p-3">
              <div className="text-muted-foreground">Нужно в день</div>
              <div className="font-semibold">{formatScore(monthStats.requiredPerDay)}</div>
            </div>
          </div>
        </div>
      </section>

      {focusTask ? (
        <Card className="focus-panel">
          <CardContent className="p-4">
            <div className="text-sm text-muted-foreground">Главный фокус</div>
            <div className="mt-1 font-semibold">{focusTask.title}</div>
            <div className="mt-1 text-sm text-muted-foreground">
              Нужно {formatScore(focusTask.requiredPerDay)} балла в день
            </div>
          </CardContent>
        </Card>
      ) : null}

      {teamStats && teamData?.selectedTeam ? (
        <Card className="section-panel">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Команда</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="font-semibold">{teamData.selectedTeam.name}</div>
                <div className="text-sm text-muted-foreground">
                  {teamStats.membersWithPlan} из {teamStats.activeMembers} участников с планом
                </div>
              </div>
              <Badge variant={teamStats.completion >= 0.8 ? "success" : "warning"}>
                {formatPercent(teamStats.completion)}
              </Badge>
            </div>
            <Progress value={Math.min(teamStats.completion, 1.2) * 100} />
            {teamStats.focusMember ? (
              <div className="list-row text-sm">
                <span className="text-muted-foreground">Фокус команды: </span>
                <span className="font-medium">{teamStats.focusMember.name}</span>
              </div>
            ) : null}
          </CardContent>
        </Card>
      ) : null}

      <div>
        <div className="mb-3 flex items-center justify-between gap-3">
          <div>
            <div className="page-kicker">Быстрый режим</div>
            <h2 className="mt-1 text-xl font-semibold tracking-tight">Заполнить факт</h2>
          </div>
          <Select className="w-40" defaultValue={selectedMonth.id} aria-label="Месяц">
            {months.map((month) => (
              <option key={month.id} value={month.id}>
                {month.title}
              </option>
            ))}
          </Select>
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
    </div>
  );
}

function MobileMetric({ label, value, tone }: { label: string; value: string; tone: "success" | "warning" | "info" }) {
  return (
    <div className={cn("rounded-md border p-3", tone === "success" && "border-success/25 bg-success/10", tone === "warning" && "border-warning/30 bg-warning/10", tone === "info" && "border-info/25 bg-info/10")}>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-1 text-lg font-semibold">{value}</div>
    </div>
  );
}

function shiftDateKey(dateKey: string, days: number) {
  const [year, month, day] = dateKey.split("-").map(Number);
  return toDateKey(new Date(year, month - 1, day + days));
}
