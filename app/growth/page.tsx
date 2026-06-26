import { ArrowDownRight, ArrowUpRight, Gauge, Sprout } from "lucide-react";
import { redirect } from "next/navigation";
import { archiveLifeAreaAction, upsertLifeAreaAction } from "@/app/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { ConfirmSubmitButton } from "@/components/shared/confirm-submit-button";
import { ErrorState } from "@/components/shared/page-state";
import { SetupNotice } from "@/components/shared/setup-notice";
import { calculateGrowthStats, type LifeAreaStat } from "@/lib/growth";
import { loadTrackerData } from "@/lib/supabase/data";
import { formatPercent, formatScore } from "@/lib/utils";
import type { LifeArea } from "@/types/domain";

export default async function GrowthPage({
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

  const { lifeAreas, categories, tasks, months, selectedMonth, plans, facts } = result.data;
  const stats = calculateGrowthStats({ lifeAreas, categories, tasks, plans, facts });
  const hasLinkedPlan = stats.totalPlanScore > 0;

  return (
    <div className="app-page space-y-6">
      <div className="workspace-header">
        <div>
          <div className="page-kicker">Сферы жизни</div>
          <h1 className="workspace-title mt-1">Развитие</h1>
          <p className="workspace-subtitle">
            Индекс по ключевым сферам: здоровье, дисциплина, финансы, отношения, вера, обучение и энергия.
          </p>
        </div>
        <form action="/growth" className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-end">
          <Select name="month" defaultValue={selectedMonth?.id ?? ""} aria-label="Месяц развития">
            {months.map((month) => (
              <option key={month.id} value={month.id}>
                {month.title}
              </option>
            ))}
          </Select>
          <Button type="submit" variant="outline">
            Открыть
          </Button>
        </form>
      </div>

      {!lifeAreas.length ? (
        <Card className="section-panel">
          <CardContent className="p-8 text-center">
            <Sprout className="mx-auto h-10 w-10 text-muted-foreground" />
            <div className="mt-4 text-lg font-semibold">Сферы жизни пока не созданы</div>
            <p className="mt-2 text-sm text-muted-foreground">
              Примените миграцию Supabase: она добавит базовые сферы и свяжет существующие категории.
            </p>
          </CardContent>
        </Card>
      ) : null}

      <div className="grid gap-3 md:grid-cols-3">
        <MetricCard
          title="Индекс развития"
          value={formatPercent(stats.overallIndex)}
          description={`${formatScore(stats.totalFactScore)} / ${formatScore(stats.totalPlanScore)} баллов`}
          tone={stats.overallIndex >= 0.8 ? "good" : stats.overallIndex >= 0.6 ? "risk" : "bad"}
        />
        <MetricCard
          title="Ритм 7 дней"
          value={formatPercent(stats.last7Index)}
          description="Короткая динамика по сферам"
          tone={stats.last7Index >= 0.8 ? "good" : stats.last7Index >= 0.6 ? "risk" : "bad"}
        />
        <MetricCard
          title="Ритм 30 дней"
          value={formatPercent(stats.last30Index)}
          description="Стабильность месяца"
          tone={stats.last30Index >= 0.8 ? "good" : stats.last30Index >= 0.6 ? "risk" : "bad"}
        />
      </div>

      <details className="section-panel rounded-xl border border-border/80 bg-card">
        <summary className="cursor-pointer px-5 py-4 text-sm font-semibold text-muted-foreground hover:text-foreground">
          Настроить сферы жизни
        </summary>
        <div className="border-t border-border/80 p-5">
          <LifeAreaForm />
          {lifeAreas.length ? (
            <div className="mt-5 grid gap-3 lg:grid-cols-2">
              {lifeAreas.map((area) => (
                <div key={area.id} className="rounded-lg border border-border/80 p-4">
                  <LifeAreaForm area={area} />
                  <form action={archiveLifeAreaAction} className="mt-3">
                    <input type="hidden" name="id" value={area.id} />
                    <ConfirmSubmitButton
                      type="submit"
                      variant="outline"
                      size="sm"
                      message={`Скрыть сферу «${area.name}»? Связи категорий останутся в базе, но сфера пропадет из активного списка.`}
                    >
                      Скрыть сферу
                    </ConfirmSubmitButton>
                  </form>
                </div>
              ))}
            </div>
          ) : null}
        </div>
      </details>

      {!hasLinkedPlan ? (
        <Card className="section-panel">
          <CardContent className="p-8 text-center">
            <Gauge className="mx-auto h-10 w-10 text-muted-foreground" />
            <div className="mt-4 text-lg font-semibold">Недостаточно данных для индекса</div>
            <p className="mt-2 text-sm text-muted-foreground">
              Привяжите категории к сферам жизни в разделе “План”, затем сгенерируйте план и внесите факты.
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="grid gap-4 lg:grid-cols-[1.4fr_0.9fr]">
            <Card className="section-panel">
              <CardHeader>
                <CardTitle>Индекс по сферам</CardTitle>
                <CardDescription>Расчет идет по плановым задачам, привязанным к сфере через категорию.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {stats.areas.map((stat) => (
                  <LifeAreaRow key={stat.area.id} stat={stat} />
                ))}
              </CardContent>
            </Card>

            <div className="space-y-4">
              <SignalPanel
                title="Сильные сферы"
                description="То, что сейчас поддерживает общий темп"
                stats={stats.strongAreas}
                empty="Пока нет сфер выше 80%."
                icon="up"
              />
              <SignalPanel
                title="Проседающие сферы"
                description="Куда стоит перенести внимание на ближайшие дни"
                stats={stats.weakAreas}
                empty="Нет явных просадок по сферам."
                icon="down"
              />
            </div>
          </div>

          <Card className="section-panel">
            <CardHeader>
              <CardTitle>Вклад задач в сферы</CardTitle>
              <CardDescription>Самые весомые задачи внутри каждой сферы.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 lg:grid-cols-2">
              {stats.areas
                .filter((stat) => stat.contributions.length > 0)
                .map((stat) => (
                  <div key={stat.area.id} className="rounded-lg border border-border/80 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2 font-semibold">
                        <span className="h-3 w-3 rounded-full" style={{ backgroundColor: stat.area.color }} />
                        {stat.area.name}
                      </div>
                      <Badge variant="outline">{formatPercent(stat.completion)}</Badge>
                    </div>
                    <div className="mt-3 space-y-3">
                      {stat.contributions.slice(0, 5).map((item) => (
                        <div key={item.taskId} className="space-y-1">
                          <div className="flex items-center justify-between gap-3 text-sm">
                            <span className="font-medium">{item.taskTitle}</span>
                            <span className="text-muted-foreground">{formatPercent(item.completion)}</span>
                          </div>
                          <Progress value={Math.min(item.completion, 1.2) * 100} />
                          <div className="text-xs text-muted-foreground">
                            {formatScore(item.factScore)} / {formatScore(item.planScore)} баллов
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

function MetricCard({
  title,
  value,
  description,
  tone
}: {
  title: string;
  value: string;
  description: string;
  tone: "good" | "risk" | "bad";
}) {
  const toneClass = {
    good: "border-emerald-200 bg-emerald-50/70 text-emerald-900 dark:border-emerald-900/60 dark:bg-emerald-950/30 dark:text-emerald-100",
    risk: "border-amber-200 bg-amber-50/70 text-amber-950 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-100",
    bad: "border-red-200 bg-red-50/70 text-red-950 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-100"
  }[tone];

  return (
    <Card className={`section-panel ${toneClass}`}>
      <CardHeader className="pb-2">
        <CardDescription>{title}</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="text-4xl font-semibold tracking-tight">{value}</div>
        <div className="mt-2 text-sm opacity-80">{description}</div>
      </CardContent>
    </Card>
  );
}

function LifeAreaForm({ area }: { area?: LifeArea }) {
  return (
    <form action={upsertLifeAreaAction} className="grid gap-3">
      {area ? <input type="hidden" name="id" value={area.id} /> : null}
      <div className="grid gap-3 sm:grid-cols-[1fr_120px_120px]">
        <div className="space-y-2">
          <Label>{area ? "Название" : "Новая сфера"}</Label>
          <Input name="name" defaultValue={area?.name ?? ""} placeholder="Например, Творчество" required />
        </div>
        <div className="space-y-2">
          <Label>Цвет</Label>
          <Input name="color" type="color" defaultValue={area?.color ?? "#2563eb"} />
        </div>
        <div className="space-y-2">
          <Label>Порядок</Label>
          <Input name="sortOrder" type="number" min="0" step="1" defaultValue={area?.sort_order ?? 100} />
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-[180px_1fr]">
        <div className="space-y-2">
          <Label>Иконка</Label>
          <Input name="icon" defaultValue={area?.icon ?? ""} placeholder="heart-pulse" />
        </div>
        <div className="space-y-2">
          <Label>Описание</Label>
          <Textarea name="description" defaultValue={area?.description ?? ""} className="min-h-16" />
        </div>
      </div>
      <Button type="submit" className="w-fit">
        {area ? "Сохранить сферу" : "Добавить сферу"}
      </Button>
    </form>
  );
}

function LifeAreaRow({ stat }: { stat: LifeAreaStat }) {
  const hasPlan = stat.planScore > 0;

  return (
    <div className="rounded-lg border border-border/80 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 font-semibold">
            <span className="h-3 w-3 rounded-full" style={{ backgroundColor: stat.area.color }} />
            {stat.area.name}
          </div>
          <p className="mt-1 text-sm text-muted-foreground">{stat.area.description ?? "Описание сферы не заполнено"}</p>
        </div>
        <Badge variant={hasPlan ? (stat.completion >= 0.8 ? "success" : "warning") : "secondary"}>
          {hasPlan ? formatPercent(stat.completion) : "нет плана"}
        </Badge>
      </div>
      <div className="mt-4 space-y-2">
        <Progress value={Math.min(stat.completion, 1.2) * 100} />
        <div className="flex flex-wrap justify-between gap-2 text-sm text-muted-foreground">
          <span>{formatScore(stat.factScore)} / {formatScore(stat.planScore)} баллов</span>
          <span>{stat.taskCount} задач</span>
          <span>7 дней: {formatPercent(stat.last7Completion)}</span>
          <span>30 дней: {formatPercent(stat.last30Completion)}</span>
        </div>
      </div>
    </div>
  );
}

function SignalPanel({
  title,
  description,
  stats,
  empty,
  icon
}: {
  title: string;
  description: string;
  stats: LifeAreaStat[];
  empty: string;
  icon: "up" | "down";
}) {
  const Icon = icon === "up" ? ArrowUpRight : ArrowDownRight;

  return (
    <Card className="section-panel">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Icon className="h-5 w-5" />
          {title}
        </CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        {stats.length ? (
          stats.slice(0, 4).map((stat) => (
            <div key={stat.area.id} className="flex items-center justify-between rounded-md border border-border/80 px-3 py-2">
              <span>{stat.area.name}</span>
              <Badge variant={stat.completion >= 0.8 ? "success" : "warning"}>{formatPercent(stat.completion)}</Badge>
            </div>
          ))
        ) : (
          <p className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">{empty}</p>
        )}
      </CardContent>
    </Card>
  );
}
