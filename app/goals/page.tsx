import Link from "next/link";
import { redirect } from "next/navigation";
import { Archive, Compass, Target, Trash2 } from "lucide-react";
import { archiveGoalAction, deleteGoalAction, upsertGoalAction } from "@/app/actions";
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
import { calculateTaskStats, type TaskStat } from "@/lib/metrics";
import { loadGoalsPage, loadTrackerData } from "@/lib/supabase/data";
import { formatPercent, formatScore } from "@/lib/utils";
import type { Goal, LifeArea } from "@/types/domain";

const typeLabels = {
  long_term: "Долгосрочная",
  monthly: "Месячная",
  weekly: "Недельная"
};

const statusLabels = {
  active: "Активна",
  completed: "Достигнута",
  paused: "Пауза",
  archived: "Архив"
};

const priorityLabels = {
  low: "Низкий",
  medium: "Средний",
  high: "Высокий"
};

const progressModeLabels = {
  linked_tasks: "По связанным задачам",
  manual_value: "Ручное значение",
  mixed: "Смешанный прогресс"
};

export default async function GoalsPage({
  searchParams
}: {
  searchParams: Promise<{
    status?: string;
    type?: string;
    priority?: string;
    lifeArea?: string;
    month?: string;
    page?: string;
  }>;
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

  const { tasks, plans, facts, months, selectedMonth, lifeAreas } = result.data;
  const pageSize = 8;
  const currentPage = Math.max(1, Number(params.page ?? 1) || 1);
  const goalsPage = await loadGoalsPage({
    page: currentPage,
    pageSize,
    status: params.status,
    type: params.type,
    priority: params.priority,
    lifeAreaId: params.lifeArea
  });

  if (goalsPage.error) {
    return <ErrorState message={goalsPage.error} />;
  }

  const { goals, goalTasks } = goalsPage;
  const taskStats = calculateTaskStats(plans, facts, tasks);
  const taskStatMap = new Map(taskStats.map((stat) => [stat.taskId, stat]));
  const lifeAreaMap = new Map(lifeAreas.map((area) => [area.id, area]));
  const totalPages = Math.max(1, Math.ceil(goalsPage.total / pageSize));

  return (
    <div className="app-page space-y-5">
      <div className="workspace-header">
        <div>
          <div className="page-kicker">Цели и версия себя</div>
          <h1 className="workspace-title mt-1">Цели</h1>
          <p className="workspace-subtitle">
            Связывайте цели со сферами жизни и задачами. Цель должна показывать не только прогресс, но и зачем она нужна.
          </p>
        </div>
      </div>

      <Card className="section-panel">
        <CardHeader>
          <CardTitle>Создать цель</CardTitle>
          <CardDescription>
            Цель может считаться по задачам, вручную по числовому значению или смешанным способом.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <GoalForm tasks={tasks} lifeAreas={lifeAreas} />
        </CardContent>
      </Card>

      <form action="/goals" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <Select name="month" defaultValue={selectedMonth?.id ?? ""} aria-label="Период прогресса целей">
          <option value="">Текущий месяц</option>
          {months.map((month) => (
            <option key={month.id} value={month.id}>
              {month.title}
            </option>
          ))}
        </Select>
        <Select name="lifeArea" defaultValue={params.lifeArea ?? "all"} aria-label="Сфера жизни">
          <option value="all">Все сферы</option>
          {lifeAreas.map((area) => (
            <option key={area.id} value={area.id}>
              {area.name}
            </option>
          ))}
        </Select>
        <Select name="status" defaultValue={params.status ?? "all"}>
          <option value="all">Все статусы</option>
          <option value="active">Активна</option>
          <option value="completed">Достигнута</option>
          <option value="paused">Пауза</option>
          <option value="archived">Архив</option>
        </Select>
        <Select name="type" defaultValue={params.type ?? "all"}>
          <option value="all">Все типы</option>
          <option value="long_term">Долгосрочная</option>
          <option value="monthly">Месячная</option>
          <option value="weekly">Недельная</option>
        </Select>
        <div className="flex gap-2">
          <Select name="priority" defaultValue={params.priority ?? "all"}>
            <option value="all">Все приоритеты</option>
            <option value="low">Низкий</option>
            <option value="medium">Средний</option>
            <option value="high">Высокий</option>
          </Select>
          <Button type="submit">Фильтр</Button>
        </div>
      </form>

      {goals.length === 0 ? (
        <Card className="section-panel">
          <CardContent className="p-8 text-center">
            <Target className="mx-auto h-10 w-10 text-muted-foreground" />
            <div className="mt-4 text-lg font-semibold">Целей пока нет</div>
            <p className="mt-2 text-sm text-muted-foreground">
              Создайте первую цель, привяжите ее к сфере жизни и выберите задачи, которые реально двигают прогресс.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 xl:grid-cols-2">
          {goals.map((goal) => {
            const linkedTaskIds = goalTasks
              .filter((item) => item.goal_id === goal.id)
              .map((item) => item.task_id);
            const linkedStats = linkedTaskIds
              .map((taskId) => taskStatMap.get(taskId))
              .filter(Boolean) as TaskStat[];
            const planScore = linkedStats.reduce((sum, task) => sum + task.planScore, 0);
            const factScore = linkedStats.reduce((sum, task) => sum + task.factScore, 0);
            const linkedProgress = planScore > 0 ? factScore / planScore : 0;
            const progress = getGoalProgress(goal, linkedProgress);
            const lifeArea = goal.life_area_id ? lifeAreaMap.get(goal.life_area_id) ?? null : null;
            const nextStep = getNextStep(linkedStats);

            return (
              <Card key={goal.id} className="section-panel">
                <CardHeader>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <CardTitle>{goal.title}</CardTitle>
                      <CardDescription>{goal.description || "Описание не заполнено"}</CardDescription>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {lifeArea ? (
                        <Badge variant="outline">
                          <span className="mr-1.5 h-2.5 w-2.5 rounded-full" style={{ backgroundColor: lifeArea.color }} />
                          {lifeArea.name}
                        </Badge>
                      ) : null}
                      <Badge variant={goal.priority === "high" ? "warning" : "outline"}>
                        {priorityLabels[goal.priority]}
                      </Badge>
                      <Badge variant={goal.status === "completed" ? "success" : goal.status === "archived" ? "secondary" : "info"}>
                        {statusLabels[goal.status]}
                      </Badge>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-5">
                  <div className="space-y-2">
                    <div className="flex flex-wrap justify-between gap-2 text-sm">
                      <span>{typeLabels[goal.type]} · {progressModeLabels[goal.progress_mode]}</span>
                      <span className="font-semibold">{formatPercent(progress)}</span>
                    </div>
                    <Progress value={Math.min(progress, 1.2) * 100} />
                    <div className="text-sm text-muted-foreground">
                      {formatScore(factScore)} / {formatScore(planScore)} баллов по связанным задачам
                    </div>
                    {goal.target_value !== null ? (
                      <div className="text-sm text-muted-foreground">
                        Значение: {formatScore(goal.current_value ?? 0)} / {formatScore(goal.target_value)} {goal.unit ?? ""}
                      </div>
                    ) : null}
                  </div>

                  <div className="grid gap-3 md:grid-cols-2">
                    <div className="rounded-md border border-border/80 p-3">
                      <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Зачем</div>
                      <p className="mt-2 text-sm">{goal.why_text || "Не заполнено. Цель без причины быстро теряет силу."}</p>
                    </div>
                    <div className="rounded-md border border-border/80 p-3">
                      <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Версия себя</div>
                      <p className="mt-2 text-sm">{goal.desired_identity || "Не заполнено. Опишите, каким человеком эта цель помогает стать."}</p>
                    </div>
                  </div>

                  <div className="rounded-md border border-blue-200 bg-blue-50/70 p-3 text-sm dark:border-blue-900/50 dark:bg-blue-950/25">
                    <div className="flex items-center gap-2 font-semibold">
                      <Compass className="h-4 w-4" />
                      Следующий шаг
                    </div>
                    <p className="mt-1 text-muted-foreground">{nextStep}</p>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {linkedTaskIds.length ? (
                      linkedTaskIds.map((taskId) => {
                        const task = tasks.find((item) => item.id === taskId);
                        return task ? <Badge key={task.id} variant="outline">{task.title}</Badge> : null;
                      })
                    ) : (
                      <span className="text-sm text-muted-foreground">Задачи не связаны</span>
                    )}
                  </div>

                  <details className="rounded-md border border-border/80">
                    <summary className="cursor-pointer px-3 py-2 text-sm font-medium text-muted-foreground hover:text-foreground">
                      Редактировать цель
                    </summary>
                    <div className="border-t border-border/80 p-3">
                      <GoalForm goal={goal} tasks={tasks} lifeAreas={lifeAreas} selectedTaskIds={linkedTaskIds} />
                    </div>
                  </details>

                  <div className="flex flex-wrap gap-2">
                    <form action={archiveGoalAction}>
                      <input type="hidden" name="goalId" value={goal.id} />
                      <ConfirmSubmitButton
                        type="submit"
                        variant="outline"
                        size="sm"
                        message="Архивировать эту цель?"
                      >
                        <Archive className="h-4 w-4" />
                        Архивировать
                      </ConfirmSubmitButton>
                    </form>
                    <form action={deleteGoalAction}>
                      <input type="hidden" name="goalId" value={goal.id} />
                      <ConfirmSubmitButton
                        type="submit"
                        variant="destructive"
                        size="sm"
                        message="Удалить цель без восстановления?"
                      >
                        <Trash2 className="h-4 w-4" />
                        Удалить
                      </ConfirmSubmitButton>
                    </form>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {goalsPage.total > pageSize ? (
        <div className="flex items-center justify-between gap-3 rounded-lg border bg-card p-3">
          <Button asChild variant="outline" size="sm">
            <Link href={createPageHref(params, Math.max(1, currentPage - 1))}>Назад</Link>
          </Button>
          <div className="text-sm text-muted-foreground">
            Страница {currentPage} из {totalPages}
          </div>
          <Button asChild variant="outline" size="sm">
            <Link href={createPageHref(params, Math.min(totalPages, currentPage + 1))}>Вперед</Link>
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
  return `/goals?${search.toString()}`;
}

function getGoalProgress(goal: Goal, linkedProgress: number) {
  const manualProgress =
    goal.target_value && goal.target_value > 0
      ? Math.max(0, Number(goal.current_value ?? 0) / Number(goal.target_value))
      : null;

  if (goal.progress_mode === "manual_value") {
    return manualProgress ?? 0;
  }

  if (goal.progress_mode === "mixed") {
    const values = [linkedProgress, manualProgress].filter((value): value is number => value !== null);
    return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
  }

  return linkedProgress;
}

function getNextStep(linkedStats: TaskStat[]) {
  if (!linkedStats.length) {
    return "Свяжите цель с задачами, чтобы система могла показать следующий шаг.";
  }

  const focus = [...linkedStats]
    .filter((task) => task.planScore > 0)
    .sort((a, b) => b.requiredPerDay - a.requiredPerDay || a.completion - b.completion)[0];

  if (!focus) {
    return "По связанным задачам пока нет плана на выбранный месяц.";
  }

  return `${focus.title}: нужно держать примерно ${formatScore(focus.requiredPerDay)} балла в день.`;
}

function GoalForm({
  goal,
  tasks,
  lifeAreas,
  selectedTaskIds = []
}: {
  goal?: Goal;
  tasks: { id: string; title: string }[];
  lifeAreas: LifeArea[];
  selectedTaskIds?: string[];
}) {
  return (
    <form action={upsertGoalAction} className="space-y-4">
      {goal ? <input type="hidden" name="id" value={goal.id} /> : null}
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-2">
          <Label>Название</Label>
          <Input name="title" defaultValue={goal?.title ?? ""} required />
        </div>
        <div className="space-y-2">
          <Label>Сфера жизни</Label>
          <Select name="lifeAreaId" defaultValue={goal?.life_area_id ?? ""}>
            <option value="">Без сферы</option>
            {lifeAreas.map((area) => (
              <option key={area.id} value={area.id}>
                {area.name}
              </option>
            ))}
          </Select>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="space-y-2">
          <Label>Тип</Label>
          <Select name="type" defaultValue={goal?.type ?? "monthly"}>
            <option value="long_term">Долгосрочная</option>
            <option value="monthly">Месячная</option>
            <option value="weekly">Недельная</option>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Статус</Label>
          <Select name="status" defaultValue={goal?.status ?? "active"}>
            <option value="active">Активна</option>
            <option value="completed">Достигнута</option>
            <option value="paused">Пауза</option>
            <option value="archived">Архив</option>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Приоритет</Label>
          <Select name="priority" defaultValue={goal?.priority ?? "medium"}>
            <option value="low">Низкий</option>
            <option value="medium">Средний</option>
            <option value="high">Высокий</option>
          </Select>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="space-y-2">
          <Label>Расчет прогресса</Label>
          <Select name="progressMode" defaultValue={goal?.progress_mode ?? "linked_tasks"}>
            <option value="linked_tasks">По задачам</option>
            <option value="manual_value">Ручное значение</option>
            <option value="mixed">Смешанный</option>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Текущее значение</Label>
          <Input name="currentValue" type="number" min="0" step="0.01" defaultValue={goal?.current_value ?? ""} />
        </div>
        <div className="space-y-2">
          <Label>Целевое значение</Label>
          <Input name="targetValue" type="number" min="0" step="0.01" defaultValue={goal?.target_value ?? ""} />
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="space-y-2">
          <Label>Единица</Label>
          <Input name="unit" placeholder="кг, ₽, часов, страниц" defaultValue={goal?.unit ?? ""} />
        </div>
        <div className="space-y-2">
          <Label>Дата начала</Label>
          <Input name="startDate" type="date" defaultValue={goal?.start_date ?? ""} />
        </div>
        <div className="space-y-2">
          <Label>Дедлайн</Label>
          <Input name="dueDate" type="date" defaultValue={goal?.due_date ?? ""} />
        </div>
      </div>

      <div className="space-y-2">
        <Label>Описание</Label>
        <Textarea name="description" defaultValue={goal?.description ?? ""} className="min-h-20" />
      </div>
      <div className="space-y-2">
        <Label>Зачем</Label>
        <Textarea name="whyText" defaultValue={goal?.why_text ?? ""} className="min-h-20" />
      </div>
      <div className="space-y-2">
        <Label>Версия себя</Label>
        <Textarea
          name="desiredIdentity"
          defaultValue={goal?.desired_identity ?? ""}
          placeholder="Например: человек, который держит слово перед собой"
          className="min-h-20"
        />
      </div>

      <div className="space-y-2">
        <Label>Связать задачи</Label>
        <div className="grid gap-2 sm:grid-cols-2">
          {tasks.map((task) => (
            <label key={task.id} className="flex items-center gap-2 rounded-md border p-2 text-sm">
              <input
                type="checkbox"
                name="taskIds"
                value={task.id}
                defaultChecked={selectedTaskIds.includes(task.id)}
              />
              {task.title}
            </label>
          ))}
        </div>
      </div>
      <Button type="submit">{goal ? "Сохранить цель" : "Создать цель"}</Button>
    </form>
  );
}
