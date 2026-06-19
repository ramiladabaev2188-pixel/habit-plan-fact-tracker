import { redirect } from "next/navigation";
import {
  archiveGoalAction,
  deleteGoalAction,
  upsertGoalAction
} from "@/app/actions";
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
import { calculateTaskStats } from "@/lib/metrics";
import { loadTrackerData } from "@/lib/supabase/data";
import { formatPercent, formatScore } from "@/lib/utils";
import type { Goal } from "@/types/domain";

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

export default async function GoalsPage({
  searchParams
}: {
  searchParams: Promise<{ status?: string; type?: string; priority?: string; month?: string }>;
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

  const { goals, goalTasks, tasks, plans, facts } = result.data;
  const taskStats = calculateTaskStats(plans, facts, tasks);
  const filteredGoals = goals.filter((goal) => {
    const statusOk = !params.status || params.status === "all" || goal.status === params.status;
    const typeOk = !params.type || params.type === "all" || goal.type === params.type;
    const priorityOk = !params.priority || params.priority === "all" || goal.priority === params.priority;
    return statusOk && typeOk && priorityOk;
  });

  return (
    <div className="space-y-5 md:pl-64">
      <div>
        <h1 className="text-2xl font-semibold tracking-normal">Цели</h1>
        <p className="text-sm text-muted-foreground">Связывайте цели с привычками и смотрите прогресс по факту.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Создать цель</CardTitle>
          <CardDescription>Прогресс считается по связанным задачам выбранного месяца.</CardDescription>
        </CardHeader>
        <CardContent>
          <GoalForm tasks={tasks} />
        </CardContent>
      </Card>

      <form action="/goals" className="grid gap-3 sm:grid-cols-3 lg:w-[720px]">
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
        <Select name="priority" defaultValue={params.priority ?? "all"}>
          <option value="all">Все приоритеты</option>
          <option value="low">Низкий</option>
          <option value="medium">Средний</option>
          <option value="high">Высокий</option>
        </Select>
        <Button type="submit" className="sm:col-span-3 lg:w-fit">Применить фильтр</Button>
      </form>

      {filteredGoals.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center">
            <div className="text-lg font-semibold">Целей пока нет</div>
            <p className="mt-2 text-sm text-muted-foreground">Создайте первую цель и свяжите ее с задачами.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 xl:grid-cols-2">
          {filteredGoals.map((goal) => {
            const linkedTaskIds = goalTasks
              .filter((item) => item.goal_id === goal.id)
              .map((item) => item.task_id);
            const linkedStats = taskStats.filter((task) => linkedTaskIds.includes(task.taskId));
            const planScore = linkedStats.reduce((sum, task) => sum + task.planScore, 0);
            const factScore = linkedStats.reduce((sum, task) => sum + task.factScore, 0);
            const progress = planScore > 0 ? factScore / planScore : 0;

            return (
              <Card key={goal.id}>
                <CardHeader>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <CardTitle>{goal.title}</CardTitle>
                      <CardDescription>{goal.description || "Описание не заполнено"}</CardDescription>
                    </div>
                    <div className="flex flex-wrap gap-2">
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
                    <div className="flex justify-between text-sm">
                      <span>{typeLabels[goal.type]}</span>
                      <span className="font-semibold">{formatPercent(progress)}</span>
                    </div>
                    <Progress value={Math.min(progress, 1.2) * 100} />
                    <div className="text-sm text-muted-foreground">
                      {formatScore(factScore)} / {formatScore(planScore)} баллов по связанным задачам
                    </div>
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
                  <GoalForm goal={goal} tasks={tasks} selectedTaskIds={linkedTaskIds} />
                  <div className="flex flex-wrap gap-2">
                    <form action={archiveGoalAction}>
                      <input type="hidden" name="goalId" value={goal.id} />
                      <ConfirmSubmitButton
                        type="submit"
                        variant="outline"
                        size="sm"
                        message="Архивировать эту цель?"
                      >
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
    </div>
  );
}

function GoalForm({
  goal,
  tasks,
  selectedTaskIds = []
}: {
  goal?: Goal;
  tasks: { id: string; title: string }[];
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
          <Label>Приоритет</Label>
          <Select name="priority" defaultValue={goal?.priority ?? "medium"}>
            <option value="low">Низкий</option>
            <option value="medium">Средний</option>
            <option value="high">Высокий</option>
          </Select>
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
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
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
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
