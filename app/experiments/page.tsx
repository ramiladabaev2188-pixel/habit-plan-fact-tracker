import { redirect } from "next/navigation";
import Link from "next/link";
import {
  archiveExperimentAction,
  saveExperimentCheckinAction,
  upsertExperimentAction
} from "@/app/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { ConfirmSubmitButton } from "@/components/shared/confirm-submit-button";
import { ErrorState } from "@/components/shared/page-state";
import { SetupNotice } from "@/components/shared/setup-notice";
import { getTodayKey } from "@/lib/dates/month";
import { calculateExperimentStats } from "@/lib/reflection";
import { loadExperimentsPage, loadTrackerData } from "@/lib/supabase/data";
import { formatPercent } from "@/lib/utils";

const statusLabels = {
  draft: "Черновик",
  active: "Активен",
  completed: "Завершен",
  archived: "Архив"
} as const;

const examples = [
  "14 дней утренней прогулки",
  "30 дней чтения",
  "7 дней без сахара",
  "30 дней учета финансов",
  "14 дней подъема до 7:00"
];

export default async function ExperimentsPage({
  searchParams
}: {
  searchParams: Promise<{ page?: string; status?: string; lifeArea?: string }>;
}) {
  const params = await searchParams;
  const pageSize = 12;
  const currentPage = Math.max(1, Number(params.page ?? 1) || 1);
  const [trackerResult, experimentsResult] = await Promise.all([
    loadTrackerData(undefined),
    loadExperimentsPage({
      page: currentPage,
      pageSize,
      status: params.status,
      lifeAreaId: params.lifeArea
    })
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

  if (experimentsResult.error) {
    return <ErrorState message={experimentsResult.error} />;
  }

  const { lifeAreas } = trackerResult.data;
  const { experiments, checkins, total } = experimentsResult;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const today = getTodayKey();
  const checkinsByExperiment = new Map<string, typeof checkins>();
  checkins.forEach((checkin) => {
    const current = checkinsByExperiment.get(checkin.experiment_id) ?? [];
    current.push(checkin);
    checkinsByExperiment.set(checkin.experiment_id, current);
  });

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-normal">Эксперименты над собой</h1>
          <p className="text-sm text-muted-foreground">
            Проверяйте гипотезы маленькими циклами, а не силой воли.
          </p>
        </div>
        <form action="/experiments" className="grid gap-2 sm:grid-cols-[180px_220px_auto] sm:items-end">
          <div className="space-y-2">
            <Label>Статус</Label>
            <Select name="status" defaultValue={params.status ?? ""}>
              <option value="">Все</option>
              <option value="draft">Черновик</option>
              <option value="active">Активен</option>
              <option value="completed">Завершен</option>
              <option value="archived">Архив</option>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Сфера</Label>
            <Select name="lifeArea" defaultValue={params.lifeArea ?? "all"}>
              <option value="all">Все сферы</option>
              {lifeAreas.map((area) => (
                <option key={area.id} value={area.id}>
                  {area.name}
                </option>
              ))}
            </Select>
          </div>
          <Button type="submit">Открыть</Button>
        </form>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Новый эксперимент</CardTitle>
        </CardHeader>
        <CardContent>
          <form action={upsertExperimentAction} className="grid gap-4 lg:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="experiment-title">Название</Label>
              <Input id="experiment-title" name="title" placeholder={examples[0]} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="experiment-life-area">Сфера</Label>
              <Select id="experiment-life-area" name="lifeAreaId">
                <option value="">Без сферы</option>
                {lifeAreas.map((area) => (
                  <option key={area.id} value={area.id}>
                    {area.name}
                  </option>
                ))}
              </Select>
            </div>
            <div className="space-y-2 lg:col-span-2">
              <Label htmlFor="experiment-hypothesis">Гипотеза</Label>
              <Textarea
                id="experiment-hypothesis"
                name="hypothesis"
                placeholder="Если я сделаю это 14 дней, то станет легче удерживать ритм..."
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="experiment-start">Дата начала</Label>
              <Input id="experiment-start" name="startDate" type="date" defaultValue={today} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="experiment-end">Дата конца</Label>
              <Input id="experiment-end" name="endDate" type="date" defaultValue={today} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="experiment-status">Статус</Label>
              <Select id="experiment-status" name="status" defaultValue="active">
                <option value="draft">Черновик</option>
                <option value="active">Активен</option>
                <option value="completed">Завершен</option>
                <option value="archived">Архив</option>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="experiment-metric">Метрика успеха</Label>
              <Input id="experiment-metric" name="successMetric" placeholder="Например, 10 отметок из 14" />
            </div>
            <div className="flex items-end lg:col-span-2">
              <Button type="submit" className="w-full sm:w-auto">
                Создать эксперимент
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {experiments.length ? (
        <div className="grid gap-4">
          {experiments.map((experiment) => {
            const experimentCheckins = checkinsByExperiment.get(experiment.id) ?? [];
            const stats = calculateExperimentStats(experiment, experimentCheckins, today);
            const area = lifeAreas.find((item) => item.id === experiment.life_area_id);

            return (
              <Card key={experiment.id}>
                <CardHeader>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <CardTitle>{experiment.title}</CardTitle>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {experiment.start_date} - {experiment.end_date}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {area ? <Badge variant="outline">{area.name}</Badge> : null}
                      <Badge variant={experiment.status === "active" ? "success" : "outline"}>
                        {statusLabels[experiment.status]}
                      </Badge>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
                  <div className="space-y-4">
                    {experiment.hypothesis ? (
                      <div className="rounded-md border p-4 text-sm">
                        <div className="mb-1 font-medium">Гипотеза</div>
                        {experiment.hypothesis}
                      </div>
                    ) : null}
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span>Прогресс</span>
                        <span>{formatPercent(stats.percent)}</span>
                      </div>
                      <Progress value={Math.min(100, Math.round(stats.percent * 100))} />
                      <p className="text-sm text-muted-foreground">
                        Выполнено {stats.doneDays} из {stats.totalDays} дней. {stats.summary}
                      </p>
                      <Badge variant={stats.percent >= 0.8 ? "success" : stats.elapsedDays >= 3 && stats.percent < 0.5 ? "warning" : "outline"}>
                        {getExperimentVerdict(stats.percent, stats.elapsedDays)}
                      </Badge>
                    </div>
                    <form action={saveExperimentCheckinAction} className="grid gap-3 rounded-md border p-4 sm:grid-cols-[150px_120px_1fr_auto] sm:items-end">
                      <input type="hidden" name="experimentId" value={experiment.id} />
                      <div className="space-y-2">
                        <Label>Дата</Label>
                        <Input name="date" type="date" defaultValue={today} />
                      </div>
                      <div className="space-y-2">
                        <Label>Значение</Label>
                        <Input name="value" type="number" step="0.25" min="0" defaultValue="1" />
                      </div>
                      <div className="space-y-2">
                        <Label>Заметка</Label>
                        <Input name="note" placeholder="Коротко: что произошло" />
                      </div>
                      <Button type="submit">Отметить</Button>
                    </form>
                  </div>
                  <form action={upsertExperimentAction} className="space-y-3 rounded-md border p-4">
                    <input type="hidden" name="id" value={experiment.id} />
                    <div className="space-y-2">
                      <Label>Название</Label>
                      <Input name="title" defaultValue={experiment.title} required />
                    </div>
                    <div className="space-y-2">
                      <Label>Сфера</Label>
                      <Select name="lifeAreaId" defaultValue={experiment.life_area_id ?? ""}>
                        <option value="">Без сферы</option>
                        {lifeAreas.map((area) => (
                          <option key={area.id} value={area.id}>
                            {area.name}
                          </option>
                        ))}
                      </Select>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="space-y-2">
                        <Label>Дата начала</Label>
                        <Input name="startDate" type="date" defaultValue={experiment.start_date} required />
                      </div>
                      <div className="space-y-2">
                        <Label>Дата конца</Label>
                        <Input name="endDate" type="date" defaultValue={experiment.end_date} required />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label>Гипотеза</Label>
                      <Textarea name="hypothesis" defaultValue={experiment.hypothesis ?? ""} />
                    </div>
                    <div className="space-y-2">
                      <Label>Метрика успеха</Label>
                      <Input name="successMetric" defaultValue={experiment.success_metric ?? ""} />
                    </div>
                    <div className="space-y-2">
                      <Label>Итог</Label>
                      <Textarea name="resultSummary" defaultValue={experiment.result_summary ?? ""} />
                    </div>
                    <div className="space-y-2">
                      <Label>Вывод</Label>
                      <Textarea name="conclusion" defaultValue={experiment.conclusion ?? ""} />
                    </div>
                    <div className="space-y-2">
                      <Label>Статус</Label>
                      <Select name="status" defaultValue={experiment.status}>
                        <option value="draft">Черновик</option>
                        <option value="active">Активен</option>
                        <option value="completed">Завершен</option>
                        <option value="archived">Архив</option>
                      </Select>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button type="submit">Сохранить итог</Button>
                      <ConfirmSubmitButton formAction={archiveExperimentAction} name="id" value={experiment.id} variant="outline" message="Архивировать эксперимент?">
                        В архив
                      </ConfirmSubmitButton>
                    </div>
                  </form>
                </CardContent>
              </Card>
            );
          })}
        </div>
      ) : (
        <Card>
          <CardContent className="p-6 text-sm text-muted-foreground">
            Экспериментов пока нет. Начните с маленькой гипотезы на 7-14 дней.
          </CardContent>
        </Card>
      )}

      {total > pageSize ? (
        <div className="flex items-center justify-between gap-3 rounded-lg border bg-card p-3">
          <Button asChild variant="outline" size="sm">
            <Link href={createPageHref(params, Math.max(1, currentPage - 1))}>Назад</Link>
          </Button>
          <div className="text-sm text-muted-foreground">
            Страница {currentPage} из {totalPages}
          </div>
          <Button asChild variant="outline" size="sm">
            <Link href={createPageHref(params, Math.min(totalPages, currentPage + 1))}>Вперёд</Link>
          </Button>
        </div>
      ) : null}
    </div>
  );
}

function createPageHref(params: Record<string, string | undefined>, page: number) {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (key !== "page" && value) {
      search.set(key, value);
    }
  }
  search.set("page", String(Math.max(1, page)));
  return `/experiments?${search.toString()}`;
}

function getExperimentVerdict(percent: number, elapsedDays: number) {
  if (percent >= 0.8) {
    return "Гипотеза подтверждается";
  }
  if (elapsedDays >= 3 && percent < 0.5) {
    return "Гипотеза пока не подтверждается";
  }
  return "Недостаточно данных";
}
