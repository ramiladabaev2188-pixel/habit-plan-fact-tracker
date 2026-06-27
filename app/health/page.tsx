import { redirect } from "next/navigation";
import { deleteHealthLogAction, upsertHealthLogAction } from "@/app/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { ErrorState } from "@/components/shared/page-state";
import { SetupNotice } from "@/components/shared/setup-notice";
import { ConfirmSubmitButton } from "@/components/shared/confirm-submit-button";
import { getTodayKey } from "@/lib/dates/month";
import { calculateDailyStats } from "@/lib/metrics";
import { calculateHealthSummary } from "@/lib/practical";
import { loadHealthPage, loadTrackerData } from "@/lib/supabase/data";
import { formatPercent, formatScore } from "@/lib/utils";

export default async function HealthPage() {
  const [trackerResult, healthResult] = await Promise.all([
    loadTrackerData(undefined, { dailyNotesScope: "all" }),
    loadHealthPage()
  ]);

  if (!trackerResult.configured) {
    return <SetupNotice />;
  }

  if (!trackerResult.user) {
    redirect("/login");
  }

  if (trackerResult.error || !trackerResult.data) {
    return <ErrorState message={trackerResult.error ?? "Неизвестная ошибка"} />;
  }

  if (healthResult.error) {
    return <ErrorState message={healthResult.error} />;
  }

  const { plans, facts, tasks } = trackerResult.data;
  const summary = calculateHealthSummary(healthResult.logs);
  const today = getTodayKey();
  const energyConnection = buildEnergyConnection(healthResult.logs, plans, facts, tasks);

  return (
    <div className="app-page space-y-6">
      <div className="workspace-header">
        <div>
          <div className="page-kicker">Личный контур</div>
          <h1 className="workspace-title mt-1">Здоровье</h1>
          <p className="workspace-subtitle">
            Сон, энергия, боль, шаги и тренировки. Контур помогает подбирать реалистичную нагрузку.
          </p>
        </div>
        <Badge variant={summary.gentleMode ? "warning" : "success"}>
          {summary.gentleMode ? "Бережный режим" : "Ресурс в норме"}
        </Badge>
      </div>

      <div className="grid gap-3 md:grid-cols-4">
        <Metric title="Вес" value={summary.latest?.weight ? `${summary.latest.weight} кг` : "нет данных"} />
        <Metric title="Сон" value={summary.averageSleep === null ? "нет данных" : `${formatScore(summary.averageSleep)} ч`} />
        <Metric title="Энергия" value={summary.averageEnergy === null ? "нет данных" : `${formatScore(summary.averageEnergy)} / 5`} />
        <Metric title="Тренировки" value={`${summary.workouts} за период`} />
      </div>

      {summary.gentleMode ? (
        <Card className="section-panel border-amber-300/70 bg-amber-50/60 dark:bg-amber-950/20">
          <CardContent className="p-5">
            <div className="font-semibold">Сегодня лучше бережный режим</div>
            <p className="mt-2 text-sm text-muted-foreground">
              Низкая энергия или высокий уровень боли. Сохраняйте ритм через минимальное действие, сон и восстановление.
            </p>
          </CardContent>
        </Card>
      ) : null}

      <Card className="section-panel border-info/30 bg-info/10">
        <CardContent className="p-5 text-sm text-muted-foreground">
          <span className="font-semibold text-foreground">Как считается энергия:</span>{" "}
          энергия в экране “День” — быстрая отметка ритма, а журнал здоровья — более полный лог тела
          (сон, боль, шаги, тренировки). В аналитике они объединяются по дате: если есть health log, он уточняет картину здоровья,
          но не перезаписывает дневной комментарий.
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
        <Card className="section-panel">
          <CardHeader>
            <CardTitle>Журнал здоровья</CardTitle>
            <CardDescription>Один короткий лог в день достаточно.</CardDescription>
          </CardHeader>
          <CardContent>
            <form action={upsertHealthLogAction} className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="health-date">Дата</Label>
                <Input id="health-date" name="date" type="date" defaultValue={today} required />
              </div>
              <NumberField id="weight" name="weight" label="Вес, кг" step="0.1" />
              <NumberField id="sleepHours" name="sleepHours" label="Сон, часов" step="0.25" />
              <div className="space-y-2">
                <Label htmlFor="energy">Энергия</Label>
                <Select id="energy" name="energy" defaultValue="">
                  <option value="">Не указано</option>
                  <option value="1">1 — очень низкая</option>
                  <option value="2">2 — низкая</option>
                  <option value="3">3 — средняя</option>
                  <option value="4">4 — хорошая</option>
                  <option value="5">5 — высокая</option>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="painLevel">Боль / ограничения</Label>
                <Input id="painLevel" name="painLevel" type="number" min={0} max={10} placeholder="0-10" />
              </div>
              <NumberField id="steps" name="steps" label="Шаги" step="1" />
              <div className="space-y-2">
                <Label htmlFor="mood">Настроение</Label>
                <Input id="mood" name="mood" placeholder="спокойно, устал, бодро" />
              </div>
              <label className="flex items-center gap-2 rounded-lg border border-border/80 p-3 text-sm">
                <input type="checkbox" name="workoutDone" />
                Тренировка была
              </label>
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="health-comment">Комментарий</Label>
                <Textarea id="health-comment" name="comment" placeholder="Что повлияло на состояние" />
              </div>
              <div className="sm:col-span-2">
                <Button type="submit">Сохранить лог</Button>
              </div>
            </form>
          </CardContent>
        </Card>

        <Card className="section-panel">
          <CardHeader>
            <CardTitle>Энергия и выполнение плана</CardTitle>
            <CardDescription>Связь строится по дням, где есть план и лог здоровья.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {energyConnection.total ? (
              energyConnection.groups.map((group) => (
                <div key={group.label} className="rounded-lg border border-border/80 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="font-semibold">{group.label}</div>
                      <div className="text-sm text-muted-foreground">{group.count} дней</div>
                    </div>
                    <Badge variant={group.completion >= 0.8 ? "success" : group.completion >= 0.6 ? "warning" : "destructive"}>
                      {formatPercent(group.completion)}
                    </Badge>
                  </div>
                </div>
              ))
            ) : (
              <div className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">
                Добавьте несколько логов здоровья и фактов дня, чтобы увидеть связь энергии с выполнением.
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="section-panel">
        <CardHeader>
          <CardTitle>Последние записи</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {healthResult.logs.length ? (
            healthResult.logs.map((log) => (
              <div key={log.id} className="rounded-lg border border-border/80 p-4 text-sm">
                <div className="grid gap-2 sm:grid-cols-6">
                  <div className="font-semibold">{log.date}</div>
                  <div>Вес: {log.weight ?? "—"}</div>
                  <div>Сон: {log.sleep_hours ?? "—"}</div>
                  <div>Энергия: {log.energy ?? "—"}</div>
                  <div>Боль: {log.pain_level ?? "—"}</div>
                  <div>Шаги: {log.steps ?? "—"}</div>
                </div>
                <details className="mt-3 rounded-md border border-border/80 bg-fog">
                  <summary className="cursor-pointer px-3 py-2 text-sm font-medium">Редактировать запись</summary>
                  <form action={upsertHealthLogAction} className="grid gap-3 border-t border-border/80 p-3 sm:grid-cols-2">
                    <input type="hidden" name="date" value={log.date} />
                    <NumberField id={`weight-${log.id}`} name="weight" label="Вес, кг" step="0.1" defaultValue={log.weight ?? ""} />
                    <NumberField id={`sleep-${log.id}`} name="sleepHours" label="Сон, часов" step="0.25" defaultValue={log.sleep_hours ?? ""} />
                    <div className="space-y-2">
                      <Label>Энергия</Label>
                      <Select name="energy" defaultValue={log.energy ? String(log.energy) : ""}>
                        <option value="">Не указано</option>
                        <option value="1">1 — очень низкая</option>
                        <option value="2">2 — низкая</option>
                        <option value="3">3 — средняя</option>
                        <option value="4">4 — хорошая</option>
                        <option value="5">5 — высокая</option>
                      </Select>
                    </div>
                    <NumberField id={`pain-${log.id}`} name="painLevel" label="Боль / ограничения" step="1" defaultValue={log.pain_level ?? ""} />
                    <NumberField id={`steps-${log.id}`} name="steps" label="Шаги" step="1" defaultValue={log.steps ?? ""} />
                    <div className="space-y-2">
                      <Label>Настроение</Label>
                      <Input name="mood" defaultValue={log.mood ?? ""} />
                    </div>
                    <label className="flex items-center gap-2 rounded-lg border border-border/80 p-3 text-sm">
                      <input type="checkbox" name="workoutDone" defaultChecked={log.workout_done} />
                      Тренировка была
                    </label>
                    <div className="space-y-2 sm:col-span-2">
                      <Label>Комментарий</Label>
                      <Textarea name="comment" defaultValue={log.comment ?? ""} />
                    </div>
                    <div className="flex flex-wrap gap-2 sm:col-span-2">
                      <Button type="submit" variant="outline">Сохранить изменения</Button>
                    </div>
                  </form>
                  <form action={deleteHealthLogAction} className="border-t border-border/80 p-3">
                    <input type="hidden" name="id" value={log.id} />
                    <ConfirmSubmitButton type="submit" variant="destructive" size="sm" message={`Удалить запись здоровья за ${log.date}?`}>
                      Удалить запись
                    </ConfirmSubmitButton>
                  </form>
                </details>
              </div>
            ))
          ) : (
            <div className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">
              Записей здоровья пока нет.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function Metric({ title, value }: { title: string; value: string }) {
  return (
    <Card className="section-panel">
      <CardContent className="p-5">
        <div className="text-sm text-muted-foreground">{title}</div>
        <div className="mt-3 text-3xl font-semibold">{value}</div>
      </CardContent>
    </Card>
  );
}

function NumberField({
  id,
  name,
  label,
  step,
  defaultValue
}: {
  id: string;
  name: string;
  label: string;
  step: string;
  defaultValue?: string | number;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <Input id={id} name={name} type="number" min={0} step={step} defaultValue={defaultValue} />
    </div>
  );
}

function buildEnergyConnection(
  logs: Array<{ date: string; energy: number | null }>,
  plans: Parameters<typeof calculateDailyStats>[0],
  facts: Parameters<typeof calculateDailyStats>[1],
  tasks: Parameters<typeof calculateDailyStats>[3]
) {
  const buckets = [
    { label: "Низкая энергия", min: 1, max: 2, values: [] as number[] },
    { label: "Средняя энергия", min: 3, max: 3, values: [] as number[] },
    { label: "Высокая энергия", min: 4, max: 5, values: [] as number[] }
  ];

  logs.forEach((log) => {
    if (!log.energy) return;
    const daily = calculateDailyStats(plans, facts, log.date, tasks);
    if (daily.planScore <= 0) return;
    const bucket = buckets.find((item) => log.energy! >= item.min && log.energy! <= item.max);
    bucket?.values.push(daily.completion);
  });

  const groups = buckets.map((bucket) => ({
    label: bucket.label,
    count: bucket.values.length,
    completion: bucket.values.length
      ? bucket.values.reduce((sum, value) => sum + value, 0) / bucket.values.length
      : 0
  }));

  return {
    total: groups.reduce((sum, group) => sum + group.count, 0),
    groups
  };
}
