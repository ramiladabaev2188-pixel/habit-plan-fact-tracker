import Link from "next/link";
import { redirect } from "next/navigation";
import { Activity, CalendarCheck, Filter } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { ErrorState } from "@/components/shared/page-state";
import { loadActivityPage } from "@/lib/supabase/data";
import { formatPercent, formatScore } from "@/lib/utils";

export default async function ActivityPage({
  searchParams
}: {
  searchParams: Promise<{ page?: string; type?: string; visibility?: string }>;
}) {
  const params = await searchParams;
  const page = Number(params.page ?? 1);
  const result = await loadActivityPage({
    page,
    pageSize: 20,
    entityType: params.type,
    visibility: params.visibility
  });

  if (result.error === "Нужна авторизация") {
    redirect("/login");
  }

  if (result.error) {
    return <ErrorState message={result.error} />;
  }

  const totalPages = Math.max(1, Math.ceil(result.total / 20));
  const prevHref = buildHref(Math.max(1, page - 1), params.type, params.visibility);
  const nextHref = buildHref(Math.min(totalPages, page + 1), params.type, params.visibility);

  return (
    <div className="app-page">
      <div className="workspace-header">
        <div>
          <div className="page-kicker">Журнал активности</div>
          <h1 className="workspace-title mt-1">Что происходило</h1>
          <p className="workspace-subtitle">
            Лента важных действий: факты, закрытые дни, фокус-сессии, события целей и системные уведомления.
          </p>
        </div>
        <form className="grid w-full gap-3 sm:grid-cols-[180px_180px_auto] lg:w-auto" action="/activity">
          <div className="space-y-2">
            <Label>Тип</Label>
            <Select name="type" defaultValue={params.type ?? "all"}>
              <option value="all">Все</option>
              <option value="daily_fact">Факт дня</option>
              <option value="day_summary">Итог дня</option>
              <option value="focus_session">Фокус</option>
              <option value="notification">Уведомления</option>
              <option value="goal">Цели</option>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Видимость</Label>
            <Select name="visibility" defaultValue={params.visibility ?? "all"}>
              <option value="all">Все</option>
              <option value="private">Личное</option>
              <option value="team">Команда</option>
            </Select>
          </div>
          <Button type="submit" className="self-end">
            <Filter className="h-4 w-4" />
            Применить
          </Button>
        </form>
      </div>

      <section className="grid gap-4 lg:grid-cols-[0.8fr_1.2fr]">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CalendarCheck className="h-5 w-5" />
              Последние закрытые дни
            </CardTitle>
          </CardHeader>
          <CardContent>
            {result.daySummaries.length ? (
              <div className="space-y-3">
                {result.daySummaries.map((summary) => (
                  <div key={summary.id} className="rounded-lg border border-border/75 bg-card p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="font-semibold">{summary.date}</div>
                        <div className="mt-1 text-xs text-muted-foreground">
                          {summary.done_count + summary.overdone_count} выполнено · {summary.partial_count} частично · {summary.missed_count} пропущено
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-lg font-semibold">{formatPercent(summary.completion)}</div>
                        <div className="text-xs text-muted-foreground">
                          {formatScore(summary.fact_score)} / {formatScore(summary.plan_score)}
                        </div>
                      </div>
                    </div>
                    {summary.note ? <p className="mt-2 text-sm text-muted-foreground">{summary.note}</p> : null}
                  </div>
                ))}
              </div>
            ) : (
              <div className="rounded-lg border border-dashed border-border p-6 text-sm text-muted-foreground">
                Закройте день на странице “Сегодня”, и здесь появится краткая история.
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5" />
              Лента событий
            </CardTitle>
          </CardHeader>
          <CardContent>
            {result.events.length ? (
              <div className="relative space-y-3 before:absolute before:left-3 before:top-2 before:h-[calc(100%-1rem)] before:w-px before:bg-border">
                {result.events.map((event) => (
                  <article key={event.id} className="relative pl-8">
                    <span className="absolute left-1.5 top-1.5 h-3 w-3 rounded-full border border-primary bg-card" />
                    <div className="rounded-lg border border-border/75 bg-card p-3">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div>
                          <div className="font-semibold">{event.title}</div>
                          {event.description ? <p className="mt-1 text-sm text-muted-foreground">{event.description}</p> : null}
                        </div>
                        <span className="rounded-full border border-border px-2 py-1 text-[11px] text-muted-foreground">
                          {event.entity_type}
                        </span>
                      </div>
                      <div className="mt-2 text-xs text-muted-foreground">
                        {new Date(event.occurred_at).toLocaleString("ru-RU")}
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <div className="rounded-lg border border-dashed border-border p-6 text-sm text-muted-foreground">
                Пока нет событий. Они появятся после сохранения факта, закрытия дня, фокус-сессий и уведомлений.
              </div>
            )}

            <div className="mt-5 flex items-center justify-between gap-3">
              <Button asChild variant="outline" size="sm" aria-disabled={page <= 1}>
                <Link href={prevHref}>Назад</Link>
              </Button>
              <span className="text-sm text-muted-foreground">
                Страница {Math.min(page, totalPages)} из {totalPages}
              </span>
              <Button asChild variant="outline" size="sm" aria-disabled={page >= totalPages}>
                <Link href={nextHref}>Вперед</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}

function buildHref(page: number, type?: string, visibility?: string) {
  const params = new URLSearchParams();
  params.set("page", String(page));
  if (type && type !== "all") params.set("type", type);
  if (visibility && visibility !== "all") params.set("visibility", visibility);
  return `/activity?${params.toString()}`;
}
