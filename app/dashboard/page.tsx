import { redirect } from "next/navigation";
import type * as React from "react";
import Link from "next/link";
import { Activity, AlertTriangle, BatteryMedium, CalendarCheck, CarFront, Flag, Sprout, Target, TrendingUp, WalletCards } from "lucide-react";
import { completeOnboardingAction } from "@/app/actions";
import { DashboardCumulativePlanFactChart, DashboardPlanFactChart } from "@/components/charts/dashboard-charts";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { LocalReminders } from "@/components/shared/local-reminders";
import { EmptyMonthState, ErrorState } from "@/components/shared/page-state";
import { SetupNotice } from "@/components/shared/setup-notice";
import { getMonthDates, getTodayKey, toDateKey } from "@/lib/dates/month";
import { calculateLifeCenterSnapshot, type LifeCenterSignal } from "@/lib/life-center";
import {
  calculateCategoryStats,
  calculateDailyStats,
  calculateMonthStats,
  calculateTaskStats,
  getForecastStatus
} from "@/lib/metrics";
import { getMainFocusTask, getRiskTasks } from "@/lib/recommendations";
import { calculateFinanceSummary, calculateHealthSummary, carStatusLabels, formatMoney, getCarServiceState } from "@/lib/practical";
import { calculateRhythmSnapshot, getRhythmMilestones } from "@/lib/rhythm";
import { loadCarPage, loadFinancePage, loadHealthPage, loadTrackerData, loadWorkPage } from "@/lib/supabase/data";
import { loadPersonalBoardData } from "@/lib/supabase/personal-board-data";
import { cn, formatPercent, formatScore } from "@/lib/utils";

const badgeVariantByLevel = {
  over: "over",
  success: "success",
  warning: "warning",
  danger: "destructive",
  info: "info"
} as const;

export default async function DashboardPage({
  searchParams
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  const params = await searchParams;
  const [result, financeResult, healthResult, carResult, workResult, boardResult] = await Promise.all([
    loadTrackerData(params.month, {
      includeGoals: true,
      includeWeeklyReviews: true,
      includeExperiments: true,
      includeExperimentCheckins: true,
      includeLifeEvents: true,
      dailyNotesScope: "all"
    }),
    loadFinancePage(),
    loadHealthPage(),
    loadCarPage(),
    loadWorkPage(),
    loadPersonalBoardData()
  ]);

  if (!result.configured) {
    return <SetupNotice />;
  }

  if (!result.user) {
    redirect("/login");
  }

  if (result.error || !result.data) {
    return <ErrorState message={result.error ?? "Неизвестная ошибка"} />;
  }

  const {
    profile,
    selectedMonth,
    plans,
    facts,
    tasks,
    categories,
    lifeAreas,
    goals,
    dailyNotes,
    weeklyReviews,
    preferences
  } = result.data;
  const shouldShowOnboarding =
    !preferences?.onboarding_completed_at &&
    (lifeAreas.length === 0 || categories.length === 0 || tasks.length === 0 || goals.length === 0);

  if (!selectedMonth) {
    return (
      <div className="space-y-5">
        {shouldShowOnboarding ? (
          <OnboardingPanel
            profileName={profile?.name ?? ""}
            lifeAreas={lifeAreas}
            compact={false}
          />
        ) : null}
        <EmptyMonthState />
      </div>
    );
  }

  const monthStats = calculateMonthStats(plans, facts, tasks);
  const forecastStatus = getForecastStatus(monthStats.forecastPercent);
  const monthDates = getMonthDates(selectedMonth.year, selectedMonth.month);
  const dailyStats = monthDates.map((date) => {
    const key = toDateKey(date);
    return calculateDailyStats(plans, facts, key, tasks);
  });
  const chartData = dailyStats.map((stat) => ({
    date: stat.date,
    label: stat.date.slice(-2),
    plan: stat.planScore,
    fact: stat.factScore
  }));
  const categoryStats = calculateCategoryStats(plans, facts, tasks);
  const taskStats = calculateTaskStats(plans, facts, tasks).filter((task) => task.planScore > 0);
  const riskTasks = getRiskTasks(taskStats, 6, selectedMonth.target_percent);
  const focus = getMainFocusTask(taskStats, selectedMonth.target_percent);
  const rhythm = calculateRhythmSnapshot({
    dailyStats,
    dailyNotes: dailyNotes.filter((note) => note.month_id === selectedMonth.id),
    targetPercent: selectedMonth.target_percent
  });
  const milestones = getRhythmMilestones({
    rhythm,
    forecastPercent: monthStats.forecastPercent,
    targetPercent: selectedMonth.target_percent
  });
  const lifeCenter = calculateLifeCenterSnapshot({
    selectedMonth,
    lifeAreas,
    categories,
    tasks,
    plans,
    facts,
    goals,
    goalTasks: result.data.goalTasks,
    weeklyReviews,
    dailyNotes,
    experiments: result.data.experiments,
    experimentCheckins: result.data.experimentCheckins,
    lifeEvents: result.data.lifeEvents,
    financeSnapshots: financeResult.error ? [] : financeResult.snapshots,
    financeGoals: financeResult.error ? [] : financeResult.goals,
    healthLogs: healthResult.error ? [] : healthResult.logs,
    cars: carResult.error ? [] : carResult.cars,
    carServiceItems: carResult.error ? [] : carResult.serviceItems,
    workProjects: workResult.error ? [] : workResult.projects,
    workCases: workResult.error ? [] : workResult.cases,
    workSkills: workResult.error ? [] : workResult.skills,
    personalBoardTasks: boardResult.error || !boardResult.data ? [] : boardResult.data.boardTasks
  });
  const moduleWarnings = [
    financeResult.error ? { title: "Финансы", detail: financeResult.error, href: "/finance" } : null,
    healthResult.error ? { title: "Здоровье", detail: healthResult.error, href: "/health" } : null,
    carResult.error ? { title: "Авто", detail: carResult.error, href: "/car" } : null,
    workResult.error ? { title: "Работа", detail: workResult.error, href: "/work" } : null,
    boardResult.error ? { title: "Личная доска", detail: boardResult.error, href: "/tasks" } : null
  ].filter((item): item is { title: string; detail: string; href: string } => Boolean(item));
  const growthStats = lifeCenter.growth;
  const strongArea = growthStats.strongAreas[0] ?? growthStats.areas.filter((area) => area.planScore > 0).sort((a, b) => b.completion - a.completion)[0] ?? null;
  const weakArea = growthStats.weakAreas[0] ?? null;
  const activeGoals = goals.filter((goal) => goal.status === "active").slice(0, 3);
  const topGoal = activeGoals[0] ?? null;
  const topGoalProgress =
    topGoal?.target_value && topGoal.target_value > 0
      ? `${formatPercent((topGoal.current_value ?? 0) / topGoal.target_value)} · ${topGoal.current_value ?? 0} / ${topGoal.target_value}${topGoal.unit ? ` ${topGoal.unit}` : ""}`
      : topGoal
        ? "Прогресс через связанные задачи"
        : "Добавьте 1-3 главные цели, чтобы dashboard вел к смыслу";
  const latestWeeklyReview = weeklyReviews
    .filter((review) => review.next_week_focus || review.lesson)
    .sort((a, b) => b.week_number - a.week_number)[0] ?? null;
  const financeSummary = financeResult.error ? null : calculateFinanceSummary(financeResult.snapshots, financeResult.goals);
  const healthSummary = healthResult.error ? null : calculateHealthSummary(healthResult.logs);
  const displayedEnergyAverage = rhythm.energyAverage ?? healthSummary?.averageEnergy ?? null;
  const displayedEnergyEntries = rhythm.energyEntries || healthResult.logs.filter((log) => log.energy !== null).length;
  const carRows = carResult.error
    ? []
    : carResult.serviceItems
        .map((item) => {
          const car = carResult.cars.find((candidate) => candidate.id === item.car_id);
          return car ? { item, car, state: getCarServiceState(item, car) } : null;
        })
        .filter(Boolean)
        .sort((a, b) => {
          const priority = { overdue: 0, soon: 1, unknown: 2, ok: 3 };
          return priority[a!.state.status] - priority[b!.state.status];
        });
  const nextCarService = carRows[0] ?? null;
  const nextStep = lifeCenter.nextBestStep.title;
  const yesterdayKey = shiftDateKey(getTodayKey(), -1);
  const yesterdayPlans = plans.filter((plan) => plan.date === yesterdayKey && plan.planned_score > 0);
  const yesterdayFactKeys = new Set(
    facts.filter((fact) => fact.date === yesterdayKey).map((fact) => `${fact.task_id}:${fact.date}`)
  );
  const hasUnfilledYesterday =
    yesterdayPlans.length > 0 &&
    yesterdayPlans.some((plan) => !yesterdayFactKeys.has(`${plan.task_id}:${plan.date}`));

  return (
    <div className="app-page app-page-with-rail dashboard-page">
      <LocalReminders
        preferences={preferences}
        forecastPercent={monthStats.forecastPercent}
        hasUnfilledYesterday={hasUnfilledYesterday}
        focusTaskTitle={focus?.title ?? null}
      />
      <div className="workspace-header">
        <div>
          <h1 className="workspace-title">Дашборд</h1>
          <p className="workspace-subtitle">{selectedMonth.title}. Как у меня сейчас дела и что самое важное сделать дальше.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Badge variant="outline">Общий факт {formatPercent(monthStats.monthCompletion)}</Badge>
          <Badge variant={badgeVariantByLevel[forecastStatus.level]}>
            {forecastStatus.label}
          </Badge>
        </div>
      </div>

      {shouldShowOnboarding ? (
        <OnboardingPanel profileName={profile?.name ?? ""} lifeAreas={lifeAreas} compact />
      ) : null}

      {moduleWarnings.length ? (
        <section className="grid gap-3 md:grid-cols-2" aria-label="Предупреждения загрузки модулей">
          {moduleWarnings.map((warning) => (
            <Card key={warning.title} className="border-warning/40 bg-warning/10">
              <CardContent className="flex items-start justify-between gap-4 p-4">
                <div>
                  <div className="font-semibold">Модуль «{warning.title}» не загрузился</div>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Dashboard продолжает работать, но данные этого контура сейчас не учитываются.
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">{warning.detail}</p>
                </div>
                <Button asChild size="sm" variant="outline">
                  <Link href={warning.href}>Открыть</Link>
                </Button>
              </CardContent>
            </Card>
          ))}
        </section>
      ) : null}

      <section className="signal-panel grid gap-4 lg:grid-cols-[1.15fr_0.85fr_auto]" aria-labelledby="now-main-heading">
        <div>
          <div className="page-kicker">Сейчас главное</div>
          <h2 id="now-main-heading" className="mt-2 text-2xl font-semibold tracking-normal">{nextStep}</h2>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">{lifeCenter.nextBestStep.detail}</p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
          <div className="rounded-md border border-border/75 bg-card/70 p-3">
            <div className="text-xs text-muted-foreground">Главный разрыв</div>
            <div className="mt-1 font-medium">
              {weakArea ? weakArea.area.name : focus?.title ?? "Явного провала нет"}
            </div>
          </div>
          <div className="rounded-md border border-border/75 bg-card/70 p-3">
            <div className="text-xs text-muted-foreground">Положительный сигнал</div>
            <div className="mt-1 font-medium">
              {strongArea ? strongArea.area.name : milestones[0]?.label ?? "Система держится"}
            </div>
          </div>
        </div>
        <Button asChild className="self-end">
          <Link href={lifeCenter.nextBestStep.href ?? "/daily"}>Сделать шаг</Link>
        </Button>
      </section>

      <section className="dashboard-hero-grid" aria-labelledby="focus-heading">
        <div className="dashboard-focus-stage">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="dashboard-focus-label">Главный фокус</div>
              <h2 id="focus-heading" className="mt-3 max-w-2xl text-3xl font-semibold tracking-tight md:text-4xl">
                {focus?.title ?? "План месяца идет ровно"}
              </h2>
            </div>
            <AlertTriangle className="h-6 w-6 shrink-0 text-signal" strokeWidth={1.7} />
          </div>
          {focus ? (
            <>
              <p className="mt-4 max-w-xl text-sm leading-6 text-muted-foreground">
                Она отстает от требуемого темпа. Ориентир построен по плану, который уже должен был быть выполнен, а не по всему месяцу.
              </p>
              <div className="mt-7 grid gap-4 border-t border-border pt-4 sm:grid-cols-2">
                <div>
                  <div className="text-xs text-muted-foreground">Текущий темп</div>
                  <div className="data-value mt-1 text-3xl">{formatPercent(focus.forecastPercent)}</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Минимум в день</div>
                  <div className="data-value mt-1 text-3xl">{formatScore(focus.requiredPerDay)} балла</div>
                </div>
              </div>
            </>
          ) : (
            <p className="mt-4 max-w-xl text-sm leading-6 text-muted-foreground">Все начатые задачи идут в целевом темпе. Сохраняйте ритм без лишнего давления.</p>
          )}
        </div>

        <aside className="dashboard-readout" aria-label="Ключевые показатели месяца">
          <div className="dashboard-readout-cell border-b border-border/80">
            <div className="flex items-center justify-between gap-3">
              <span className="text-sm font-medium text-muted-foreground">Выполнение месяца</span>
              <Target className="h-5 w-5 text-signal" strokeWidth={1.8} />
            </div>
            <div className="data-value mt-5 text-5xl">{formatPercent(monthStats.monthCompletion)}</div>
            <div className="mt-3 text-sm text-muted-foreground">{formatScore(monthStats.currentFactScore)} из {formatScore(monthStats.totalPlanScore)} баллов</div>
          </div>
          <div className="dashboard-readout-cell">
            <div className="flex items-center justify-between gap-3">
              <span className="text-sm font-medium text-muted-foreground">Прогноз к концу месяца</span>
              <TrendingUp className="h-5 w-5 text-signal" strokeWidth={1.8} />
            </div>
            <div className="data-value mt-5 text-4xl">{formatPercent(monthStats.forecastPercent)}</div>
            <div className="mt-2 text-sm text-muted-foreground">Цель темпа: {formatPercent(selectedMonth.target_percent)}</div>
            <Progress className="mt-4" value={Math.min(monthStats.forecastPercent, 1.2) * 100} />
          </div>
        </aside>
      </section>

      <section className="dashboard-metric-rail" aria-label="Дополнительные показатели">
        <MetricCell
          icon={<Activity className="h-5 w-5" />}
          label="Нужно в день"
          value={formatScore(monthStats.requiredPerDay)}
          detail={`Осталось плановых дней: ${monthStats.remainingDays}`}
        />
        <MetricCell
          icon={<CalendarCheck className="h-5 w-5" />}
          label="Дней с планом"
          value={`${monthStats.elapsedDaysWithPlan} / ${monthStats.totalPlannedDays}`}
          detail="Прошло / всего"
        />
        <MetricCell
          icon={<Target className="h-5 w-5" />}
          label="Факт баллов"
          value={formatScore(monthStats.currentFactScore)}
          detail={`из ${formatScore(monthStats.totalPlanScore)} плана`}
        />
        <MetricCell
          icon={<TrendingUp className="h-5 w-5" />}
          label="Статус темпа"
          value={forecastStatus.level === "danger" ? "Риск" : forecastStatus.level === "warning" ? "Ускориться" : "В норме"}
          detail={`По плану на прошедшие дни: ${formatScore(monthStats.planScoreToDate)} баллов`}
        />
      </section>

      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-3" aria-label="Главная сводка развития">
        <ProductSignalCard
          icon={<Sprout className="h-5 w-5" />}
          title="Индекс развития"
          value={growthStats.totalPlanScore > 0 ? formatPercent(lifeCenter.developmentIndex) : "нет плана"}
          detail={
            weakArea
              ? `Слабая сфера: ${weakArea.area.name}`
              : strongArea
                ? `Сильная сфера: ${strongArea.area.name}`
                : "Свяжите категории со сферами"
          }
        />
        <ProductSignalCard
          icon={<Target className="h-5 w-5" />}
          title="Следующий шаг"
          value={nextStep}
          detail={lifeCenter.nextBestStep.detail}
        />
        <ProductSignalCard
          icon={<Flag className="h-5 w-5" />}
          title="Главные цели"
          value={activeGoals.length ? `${activeGoals.length} активные` : "нет целей"}
          detail={topGoal ? `${topGoal.title}: ${topGoalProgress}` : topGoalProgress}
        />
        <ProductSignalCard
          icon={<AlertTriangle className="h-5 w-5" />}
          title="Ближайшие риски"
          value={lifeCenter.risks.length ? `${lifeCenter.risks.length} сигналов` : "нет явных рисков"}
          detail={lifeCenter.risks[0]?.detail ?? "Начатые задачи держат целевой темп"}
        />
        <ProductSignalCard
          icon={<WalletCards className="h-5 w-5" />}
          title="Финансовый фокус"
          value={financeSummary?.latest ? formatMoney(financeSummary.monthlyFreeCash) : "нет снимка"}
          detail={
            financeSummary?.latest
              ? financeSummary.monthlyFreeCash >= 0
                ? "Свободный поток положительный"
                : "Расходы выше дохода, нужен контроль"
              : "Добавьте финансовый снимок"
          }
        />
        <ProductSignalCard
          icon={<CarFront className="h-5 w-5" />}
          title="Авто"
          value={nextCarService ? nextCarService.item.name : "нет данных"}
          detail={
            nextCarService
              ? `${nextCarService.car.name}: ${carStatusLabels[nextCarService.state.status]}`
              : "Добавьте авто и узлы обслуживания"
          }
        />
        {latestWeeklyReview ? (
          <ProductSignalCard
            icon={<CalendarCheck className="h-5 w-5" />}
            title="Фокус недели"
            value={latestWeeklyReview.next_week_focus || "Есть недельный вывод"}
            detail={latestWeeklyReview.lesson ?? "Открыть недельный отчет"}
          />
        ) : null}
      </section>

      <section className="grid gap-3 lg:grid-cols-3" aria-label="Центр внимания">
        <SignalPanel
          title="Что требует внимания"
          empty="Критичных сигналов нет. Система выглядит связанной."
          signals={lifeCenter.risks}
        />
        <SignalPanel
          title="Что давно не обновлялось"
          empty="Практические контуры достаточно свежие."
          signals={lifeCenter.staleData}
        />
        <SignalPanel
          title="Что не связано"
          empty="Цели, задачи и сферы связаны между собой."
          signals={lifeCenter.disconnectedData}
        />
      </section>

      <section className="grid gap-3 xl:grid-cols-[1.2fr_0.8fr]" aria-label="Ритм и достижения">
        <Card className="section-panel">
          <CardHeader className="flex flex-row items-start justify-between gap-3">
            <div>
              <CardTitle>Ритм и ресурс</CardTitle>
              <p className="mt-1 text-sm text-muted-foreground">Самонаблюдение по энергии и регулярности, не медицинский показатель.</p>
            </div>
            <BatteryMedium className="h-5 w-5 text-signal" strokeWidth={1.8} />
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-[auto_1fr] sm:items-center">
            <div className="min-w-32 rounded-md bg-muted/55 p-4">
              <div className="text-xs text-muted-foreground">Средняя энергия</div>
              <div className="data-value mt-1 text-3xl">{displayedEnergyAverage === null ? "—" : `${formatScore(displayedEnergyAverage)}/5`}</div>
              <div className="mt-1 text-xs text-muted-foreground">{displayedEnergyEntries} отметок</div>
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <div className="font-semibold">{rhythm.label}</div>
                <Badge variant={rhythm.consistencyPercent >= selectedMonth.target_percent ? "success" : "secondary"}>
                  {rhythm.daysAtTarget} из {rhythm.plannedDays} дней в ритме
                </Badge>
              </div>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">{rhythm.guidance}</p>
            </div>
          </CardContent>
        </Card>

        <Card className="section-panel">
          <CardHeader>
            <CardTitle>Знаки месяца</CardTitle>
            <p className="mt-1 text-sm text-muted-foreground">Небольшие ориентиры за реальный прогресс, без штрафов.</p>
          </CardHeader>
          <CardContent className="space-y-2">
            {milestones.map((milestone) => (
              <div key={milestone.id} className="flex items-center justify-between gap-3 rounded-md border border-border/75 px-3 py-2">
                <div>
                  <div className="text-sm font-medium">{milestone.label}</div>
                  <div className="text-xs text-muted-foreground">{milestone.detail}</div>
                </div>
                <Badge variant={milestone.unlocked ? "success" : "outline"}>
                  {milestone.unlocked ? "получено" : "в пути"}
                </Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      </section>

      <details className="section-panel overflow-hidden">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-4 p-5 transition-colors hover:bg-fog">
          <div>
            <h2 className="text-lg font-semibold tracking-normal">Графики и динамика</h2>
            <p className="mt-1 text-sm text-muted-foreground">Подробный ритм по дням открыт по запросу, чтобы дашборд не перегружал первый экран.</p>
          </div>
          <span className="text-sm text-muted-foreground">Подробнее</span>
        </summary>
        <div className="grid gap-3 border-t border-border p-4 xl:grid-cols-2">
          <section className="dashboard-chart-panel shadow-none">
            <div className="dashboard-panel-header">
              <div>
                <h3 className="text-lg font-semibold tracking-tight">План и факт по дням</h3>
                <p className="mt-1 text-sm text-muted-foreground">Ритм выполнения без накопления.</p>
              </div>
            </div>
            <div className="p-5">
              <DashboardPlanFactChart data={chartData} />
            </div>
          </section>
          <section className="dashboard-chart-panel shadow-none">
            <div className="dashboard-panel-header">
              <div>
                <h3 className="text-lg font-semibold tracking-tight">Накопительный темп</h3>
                <p className="mt-1 text-sm text-muted-foreground">Разрыв между планом и фактом за месяц.</p>
              </div>
            </div>
            <div className="p-5">
              <DashboardCumulativePlanFactChart data={chartData} />
            </div>
          </section>
        </div>
      </details>

      <Card className="section-panel">
        <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <CardTitle>Категории</CardTitle>
            <p className="text-sm text-muted-foreground">Где темп держится, а где нужен фокус.</p>
          </div>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {categoryStats.map((categoryStat) => {
          const category = categories.find((item) => item.id === categoryStat.categoryId);
          const hasElapsedPlan = categoryStat.planScoreToDate > 0;
          const status = hasElapsedPlan ? getForecastStatus(categoryStat.pacePercent) : { level: "info" as const };

          return (
            <div key={categoryStat.categoryId} className="list-row">
              <div className="flex items-center justify-between gap-3">
                <div className="flex min-w-0 items-center gap-2 text-sm font-semibold">
                  <span
                    className="h-2.5 w-2.5 shrink-0 rounded-full"
                    style={{ backgroundColor: category?.color ?? "#64748b" }}
                  />
                  <span className="truncate">{category?.name ?? "Без категории"}</span>
                </div>
                <div className="data-value text-2xl">{hasElapsedPlan ? formatPercent(categoryStat.pacePercent) : "позже"}</div>
              </div>
              <div className="mt-4 space-y-2">
                <Progress
                  value={hasElapsedPlan ? Math.min(categoryStat.pacePercent, 1.2) * 100 : 0}
                  indicatorClassName={cn(status.level === "over" && "bg-over", status.level === "warning" && "bg-warning", status.level === "danger" && "bg-destructive", status.level === "success" && "bg-success")}
                />
                <div className="text-sm text-muted-foreground">
                  {hasElapsedPlan
                    ? `Темп по пройденному плану: ${formatScore(categoryStat.factScoreToDate)} / ${formatScore(categoryStat.planScoreToDate)}`
                    : "План категории начинается позже"}
                </div>
              </div>
            </div>
          );
        })}
        </CardContent>
      </Card>

      <Card className="section-panel">
        <CardHeader>
          <CardTitle>Задачи, которым нужен темп</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {riskTasks.length ? riskTasks.map((task) => (
            <div key={task.taskId} className="list-row grid gap-2 sm:grid-cols-[1fr_auto] sm:items-center">
              <div>
                <div className="font-medium">{task.title}</div>
                <div className="text-sm text-muted-foreground">
                  Темп {formatPercent(task.forecastPercent)} · нужно {formatScore(task.requiredPerDay)} в день
                </div>
              </div>
              <Badge variant="warning">
                Ниже цели {formatPercent(selectedMonth.target_percent)}
              </Badge>
            </div>
          )) : (
            <p className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
              Начатые задачи держат целевой темп. Будущие задачи здесь не считаются риском.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function shiftDateKey(dateKey: string, days: number) {
  const [year, month, day] = dateKey.split("-").map(Number);
  return toDateKey(new Date(year, month - 1, day + days));
}

function MetricCell({
  icon,
  label,
  value,
  detail
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <div className="dashboard-metric-cell">
      <div className="flex items-center justify-between gap-3 text-muted-foreground">
        <span className="text-sm font-medium">{label}</span>
        <span className="text-signal">{icon}</span>
      </div>
      <div className="data-value mt-5 text-3xl">{value}</div>
      <div className="mt-2 text-sm leading-5 text-muted-foreground">{detail}</div>
    </div>
  );
}

function ProductSignalCard({
  icon,
  title,
  value,
  detail
}: {
  icon: React.ReactNode;
  title: string;
  value: string;
  detail: string;
}) {
  return (
    <Card className="section-panel">
      <CardContent className="p-5">
        <div className="flex items-center justify-between gap-3 text-muted-foreground">
          <span className="text-sm font-medium">{title}</span>
          <span className="text-signal">{icon}</span>
        </div>
        <div className="mt-4 line-clamp-2 text-2xl font-semibold tracking-tight">{value}</div>
        <p className="mt-2 line-clamp-2 text-sm leading-5 text-muted-foreground">{detail}</p>
      </CardContent>
    </Card>
  );
}

function SignalPanel({
  title,
  empty,
  signals
}: {
  title: string;
  empty: string;
  signals: LifeCenterSignal[];
}) {
  return (
    <Card className="section-panel">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {signals.length ? (
          signals.slice(0, 4).map((signal) => {
            const content = (
              <>
                <div className="flex items-center justify-between gap-3">
                  <div className="font-medium">{signal.title}</div>
                  <span
                    className={cn(
                      "h-2.5 w-2.5 shrink-0 rounded-full",
                      signal.level === "danger" && "bg-destructive",
                      signal.level === "warning" && "bg-warning",
                      signal.level === "success" && "bg-success",
                      signal.level === "info" && "bg-info"
                    )}
                  />
                </div>
                <p className="mt-1 text-sm leading-5 text-muted-foreground">{signal.detail}</p>
              </>
            );

            return signal.href ? (
              <Link key={signal.id} href={signal.href} className="block rounded-lg border border-border/75 p-3 transition-colors hover:bg-muted/45">
                {content}
              </Link>
            ) : (
              <div key={signal.id} className="rounded-lg border border-border/75 p-3">
                {content}
              </div>
            );
          })
        ) : (
          <p className="rounded-lg border border-dashed border-border p-4 text-sm leading-6 text-muted-foreground">{empty}</p>
        )}
      </CardContent>
    </Card>
  );
}

function OnboardingPanel({
  profileName,
  lifeAreas,
  compact
}: {
  profileName: string;
  lifeAreas: Array<{ id: string; name: string; color: string }>;
  compact: boolean;
}) {
  const defaultAreaIds = lifeAreas.slice(0, 4).map((area) => area.id);

  return (
    <Card className="section-panel border-primary/30">
      <CardHeader>
        <CardTitle>Быстрая настройка личной системы</CardTitle>
        <p className="text-sm text-muted-foreground">
          Не блокирует приложение. Заполните один раз, чтобы dashboard, цели и стартовые задачи стали осмысленнее.
        </p>
      </CardHeader>
      <CardContent>
        <form action={completeOnboardingAction} className="grid gap-4 lg:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="onboarding-name">Имя</Label>
            <Input id="onboarding-name" name="name" defaultValue={profileName} required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="onboarding-mode">Режим</Label>
            <Select id="onboarding-mode" name="mode" defaultValue="normal">
              <option value="recovery">Восстановление</option>
              <option value="normal">Нормальный</option>
              <option value="push">Рывок</option>
            </Select>
          </div>
          <div className="space-y-2 lg:col-span-2">
            <Label>Главные сферы жизни</Label>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
              {lifeAreas.map((area) => (
                <label key={area.id} className="flex items-center gap-2 rounded-lg border border-border/80 bg-card p-3 text-sm">
                  <input type="checkbox" name="lifeAreaIds" value={area.id} defaultChecked={defaultAreaIds.includes(area.id)} />
                  <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: area.color }} />
                  {area.name}
                </label>
              ))}
            </div>
          </div>
          <div className="space-y-2 lg:col-span-2">
            <Label htmlFor="desiredIdentity">Кем хочу стать через год</Label>
            <Textarea
              id="desiredIdentity"
              name="desiredIdentity"
              placeholder="Например: спокойный, сильный и системный человек, который держит слово перед собой"
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="goal1">Главная цель 1</Label>
            <Input id="goal1" name="goal1" required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="goal2">Главная цель 2</Label>
            <Input id="goal2" name="goal2" />
          </div>
          {!compact ? (
            <div className="space-y-2">
              <Label htmlFor="goal3">Главная цель 3</Label>
              <Input id="goal3" name="goal3" />
            </div>
          ) : (
            <input type="hidden" name="goal3" value="" />
          )}
          <div className="space-y-2">
            <Label htmlFor="starterTemplate">Стартовый шаблон задач</Label>
            <Select id="starterTemplate" name="starterTemplate" defaultValue="balanced">
              <option value="balanced">Баланс</option>
              <option value="health">Здоровье</option>
              <option value="discipline">Дисциплина</option>
              <option value="work">Работа</option>
            </Select>
          </div>
          <div className="space-y-2 lg:col-span-2">
            <Label>Что чаще всего мешает</Label>
            <div className="grid gap-2 sm:grid-cols-3">
              {["не хватает энергии", "не хватает времени", "забываю", "перегружаю план", "мешают другие дела", "нет условий"].map((blocker) => (
                <label key={blocker} className="flex items-center gap-2 rounded-lg border border-border/80 bg-card p-3 text-sm">
                  <input type="checkbox" name="blockers" value={blocker} />
                  {blocker}
                </label>
              ))}
            </div>
          </div>
          <div className="lg:col-span-2">
            <Button type="submit">Собрать стартовую систему</Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
