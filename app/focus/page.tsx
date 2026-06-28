import { redirect } from "next/navigation";
import { Clock3, Target } from "lucide-react";
import { FocusSessionForm } from "@/components/focus/focus-session-form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ErrorState } from "@/components/shared/page-state";
import { summarizeFocusSessions } from "@/lib/activity";
import { loadFocusPage } from "@/lib/supabase/data";

export default async function FocusPage() {
  const result = await loadFocusPage();

  if (result.error === "Нужна авторизация") {
    redirect("/login");
  }

  if (result.error) {
    return <ErrorState message={result.error} />;
  }

  const summary = summarizeFocusSessions(result.sessions);
  const taskById = new Map(result.tasks.map((task) => [task.id, task]));

  return (
    <div className="app-page">
      <div className="workspace-header">
        <div>
          <div className="page-kicker">Глубокая работа</div>
          <h1 className="workspace-title mt-1">Фокус</h1>
          <p className="workspace-subtitle">
            Фиксируйте короткие рабочие блоки по задачам, чтобы видеть не только факт выполнения, но и вложенное внимание.
          </p>
        </div>
      </div>

      <section className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock3 className="h-5 w-5" />
              Минут фокуса
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="data-value text-4xl">{summary.totalMinutes}</div>
            <p className="mt-2 text-sm text-muted-foreground">Всего по последним сессиям</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Target className="h-5 w-5" />
              Сессий
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="data-value text-4xl">{summary.finished}</div>
            <p className="mt-2 text-sm text-muted-foreground">С сохраненным результатом</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Средняя длина</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="data-value text-4xl">{summary.averageMinutes}</div>
            <p className="mt-2 text-sm text-muted-foreground">Минут за сессию</p>
          </CardContent>
        </Card>
      </section>

      <FocusSessionForm tasks={result.tasks} />

      <Card>
        <CardHeader>
          <CardTitle>История</CardTitle>
        </CardHeader>
        <CardContent>
          {result.sessions.length ? (
            <div className="space-y-3">
              {result.sessions.map((session) => {
                const task = session.task_id ? taskById.get(session.task_id) : null;

                return (
                  <div key={session.id} className="rounded-lg border border-border/75 bg-card p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <div className="font-semibold">{task?.title ?? "Фокус без привязки"}</div>
                        <div className="mt-1 text-sm text-muted-foreground">
                          {new Date(session.started_at).toLocaleString("ru-RU")}
                          {session.ended_at ? ` - ${new Date(session.ended_at).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" })}` : ""}
                        </div>
                      </div>
                      <div className="rounded-full border border-border px-3 py-1 text-sm font-semibold">
                        {session.duration_minutes ?? 0} мин.
                      </div>
                    </div>
                    {session.outcome ? <p className="mt-3 text-sm">{session.outcome}</p> : null}
                    {session.note ? <p className="mt-2 text-sm text-muted-foreground">{session.note}</p> : null}
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="rounded-lg border border-dashed border-border p-6 text-sm text-muted-foreground">
              Пока нет фокус-сессий. Нажмите “Старт”, сделайте блок работы и сохраните результат.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
