import { redirect } from "next/navigation";
import Link from "next/link";
import { deleteLifeEventAction, upsertLifeEventAction } from "@/app/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { ConfirmSubmitButton } from "@/components/shared/confirm-submit-button";
import { ErrorState } from "@/components/shared/page-state";
import { SetupNotice } from "@/components/shared/setup-notice";
import { getTodayKey } from "@/lib/dates/month";
import { loadTimelinePage, loadTrackerData } from "@/lib/supabase/data";

const eventTypeLabels = {
  achievement: "Достижение",
  milestone: "Веха",
  decision: "Решение",
  failure: "Срыв",
  recovery: "Восстановление",
  purchase: "Покупка",
  health: "Здоровье",
  finance: "Финансы",
  work: "Работа",
  family: "Семья",
  faith: "Вера",
  custom: "Событие"
} as const;

export default async function TimelinePage({
  searchParams
}: {
  searchParams: Promise<{ page?: string; lifeArea?: string }>;
}) {
  const params = await searchParams;
  const pageSize = 20;
  const currentPage = Math.max(1, Number(params.page ?? 1) || 1);
  const [trackerResult, timelineResult] = await Promise.all([
    loadTrackerData(undefined, { includeGoals: true }),
    loadTimelinePage({
      page: currentPage,
      pageSize,
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

  if (timelineResult.error) {
    return <ErrorState message={timelineResult.error} />;
  }

  const { lifeAreas, goals } = trackerResult.data;
  const { events, total } = timelineResult;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const today = getTodayKey();

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-normal">Карта жизни</h1>
          <p className="text-sm text-muted-foreground">
            Хронология решений, достижений, срывов и восстановлений.
          </p>
        </div>
        <form action="/timeline" className="grid gap-2 sm:grid-cols-[240px_auto] sm:items-end">
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
          <CardTitle>Добавить событие</CardTitle>
        </CardHeader>
        <CardContent>
          <form action={upsertLifeEventAction} className="grid gap-4 lg:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="event-title">Название</Label>
              <Input id="event-title" name="title" placeholder="Например, закрыл важную цель" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="event-date">Дата</Label>
              <Input id="event-date" name="eventDate" type="date" defaultValue={today} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="event-type">Тип</Label>
              <Select id="event-type" name="type" defaultValue="custom">
                {Object.entries(eventTypeLabels).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="event-importance">Важность</Label>
              <Select id="event-importance" name="importance" defaultValue="3">
                <option value="1">1 - фон</option>
                <option value="2">2 - заметно</option>
                <option value="3">3 - важно</option>
                <option value="4">4 - сильно</option>
                <option value="5">5 - поворотная точка</option>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="event-life-area">Сфера</Label>
              <Select id="event-life-area" name="lifeAreaId">
                <option value="">Без сферы</option>
                {lifeAreas.map((area) => (
                  <option key={area.id} value={area.id}>
                    {area.name}
                  </option>
                ))}
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="event-goal">Цель</Label>
              <Select id="event-goal" name="goalId">
                <option value="">Без цели</option>
                {goals.map((goal) => (
                  <option key={goal.id} value={goal.id}>
                    {goal.title}
                  </option>
                ))}
              </Select>
            </div>
            <div className="space-y-2 lg:col-span-2">
              <Label htmlFor="event-description">Описание</Label>
              <Textarea id="event-description" name="description" placeholder="Что произошло и почему это важно" />
            </div>
            <div className="lg:col-span-2">
              <Button type="submit">Добавить в карту</Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {events.length ? (
        <div className="space-y-3">
          {events.map((event) => {
            const area = lifeAreas.find((item) => item.id === event.life_area_id);
            const goal = goals.find((item) => item.id === event.goal_id);

            return (
              <Card key={event.id} className={event.importance >= 4 ? "border-primary/35 bg-primary/[0.03]" : ""}>
                <CardContent className="p-5">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant={event.importance >= 4 ? "over" : "outline"}>
                          {eventTypeLabels[event.type]}
                        </Badge>
                        <Badge variant="outline">Важность {event.importance}</Badge>
                        {area ? <Badge variant="outline">{area.name}</Badge> : null}
                      </div>
                      <h2 className="mt-3 text-lg font-semibold">{event.title}</h2>
                      <p className="mt-1 text-sm text-muted-foreground">{event.event_date}</p>
                      {event.description ? <p className="mt-3 text-sm">{event.description}</p> : null}
                      {goal ? <p className="mt-3 text-sm text-muted-foreground">Связано с целью: {goal.title}</p> : null}
                    </div>
                    <form action={deleteLifeEventAction}>
                      <input type="hidden" name="id" value={event.id} />
                      <ConfirmSubmitButton type="submit" variant="outline" size="sm" message="Удалить событие из карты жизни?">
                        Удалить
                      </ConfirmSubmitButton>
                    </form>
                  </div>
                  <details className="mt-4 rounded-md border border-border/80">
                    <summary className="cursor-pointer px-3 py-2 text-sm font-medium text-muted-foreground hover:text-foreground">
                      Редактировать событие
                    </summary>
                    <form action={upsertLifeEventAction} className="grid gap-3 border-t border-border/80 p-3 lg:grid-cols-2">
                      <input type="hidden" name="id" value={event.id} />
                      <div className="space-y-2">
                        <Label>Название</Label>
                        <Input name="title" defaultValue={event.title} required />
                      </div>
                      <div className="space-y-2">
                        <Label>Дата</Label>
                        <Input name="eventDate" type="date" defaultValue={event.event_date} required />
                      </div>
                      <div className="space-y-2">
                        <Label>Тип</Label>
                        <Select name="type" defaultValue={event.type}>
                          {Object.entries(eventTypeLabels).map(([value, label]) => (
                            <option key={value} value={value}>
                              {label}
                            </option>
                          ))}
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>Важность</Label>
                        <Select name="importance" defaultValue={String(event.importance)}>
                          <option value="1">1</option>
                          <option value="2">2</option>
                          <option value="3">3</option>
                          <option value="4">4</option>
                          <option value="5">5</option>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>Сфера</Label>
                        <Select name="lifeAreaId" defaultValue={event.life_area_id ?? ""}>
                          <option value="">Без сферы</option>
                          {lifeAreas.map((lifeArea) => (
                            <option key={lifeArea.id} value={lifeArea.id}>
                              {lifeArea.name}
                            </option>
                          ))}
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>Цель</Label>
                        <Select name="goalId" defaultValue={event.goal_id ?? ""}>
                          <option value="">Без цели</option>
                          {goals.map((item) => (
                            <option key={item.id} value={item.id}>
                              {item.title}
                            </option>
                          ))}
                        </Select>
                      </div>
                      <div className="space-y-2 lg:col-span-2">
                        <Label>Описание</Label>
                        <Textarea name="description" defaultValue={event.description ?? ""} />
                      </div>
                      <div className="lg:col-span-2">
                        <Button type="submit">Сохранить событие</Button>
                      </div>
                    </form>
                  </details>
                </CardContent>
              </Card>
            );
          })}
        </div>
      ) : (
        <Card>
          <CardContent className="p-6 text-sm text-muted-foreground">
            Событий пока нет. Добавьте первую важную точку или завершите эксперимент.
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
  return `/timeline?${search.toString()}`;
}
