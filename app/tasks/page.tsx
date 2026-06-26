import Link from "next/link";
import { redirect } from "next/navigation";
import {
  Archive,
  CalendarClock,
  CheckCircle2,
  ChevronRight,
  Flag,
  MessageSquare,
  Plus,
  Rows3,
  Target
} from "lucide-react";
import {
  addPersonalBoardCommentAction,
  archivePersonalBoardTaskAction,
  createPersonalBoardAction,
  createPersonalBoardTaskAction,
  movePersonalBoardTaskAction,
  updatePersonalBoardTaskAction
} from "@/app/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { ConfirmSubmitButton } from "@/components/shared/confirm-submit-button";
import { ErrorState } from "@/components/shared/page-state";
import { SetupNotice } from "@/components/shared/setup-notice";
import { loadPersonalBoardData } from "@/lib/supabase/personal-board-data";
import type {
  Goal,
  Month,
  PersonalBoard,
  PersonalBoardColumn,
  PersonalBoardComment,
  PersonalBoardPriority,
  PersonalBoardTask,
  Task
} from "@/types/domain";

const priorityLabels: Record<PersonalBoardPriority, string> = {
  low: "Низкий",
  medium: "Обычный",
  high: "Высокий",
  urgent: "Срочно"
};

const priorityVariants: Record<PersonalBoardPriority, "outline" | "secondary" | "warning" | "destructive"> = {
  low: "outline",
  medium: "secondary",
  high: "warning",
  urgent: "destructive"
};

export default async function TasksPage({
  searchParams
}: {
  searchParams: Promise<{ board?: string }>;
}) {
  const params = await searchParams;
  const result = await loadPersonalBoardData(params.board);

  if (!result.configured) return <SetupNotice />;
  if (!result.user) redirect("/login");
  if (result.error || !result.data) return <ErrorState message={result.error ?? "Не удалось загрузить личные задачи"} />;

  const { boards, selectedBoard, columns, boardTasks, comments, goals, habitTasks, months } = result.data;

  if (!selectedBoard) {
    return <EmptyPersonalBoardState />;
  }

  const doneColumnIds = new Set(columns.filter((column) => isDoneColumn(column.title)).map((column) => column.id));
  const activeTasks = boardTasks.filter((task) => !doneColumnIds.has(task.column_id));
  const urgentTasks = activeTasks.filter((task) => task.priority === "urgent" || task.priority === "high");
  const dueSoonTasks = activeTasks.filter((task) => task.due_date && daysUntil(task.due_date) <= 7);
  const doneTasks = boardTasks.filter((task) => doneColumnIds.has(task.column_id));

  return (
    <div className="app-page">
      <header className="workspace-header">
        <div>
          <div className="page-kicker">Личное рабочее пространство</div>
          <div className="mt-1 flex flex-wrap items-center gap-3">
            <h1 className="workspace-title">Задачи</h1>
            <Badge variant="info">личная доска</Badge>
          </div>
          <p className="workspace-subtitle">
            Здесь живут личные дела, проекты и идеи. Они не привязаны к команде, но при необходимости могут ссылаться на цель, привычку или месяц.
          </p>
        </div>
        <BoardSelector boards={boards} selectedBoardId={selectedBoard.id} />
      </header>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4" aria-label="Сводка личной доски">
        <BoardMetric icon={<Rows3 className="h-5 w-5" />} label="Активные задачи" value={String(activeTasks.length)} />
        <BoardMetric icon={<Flag className="h-5 w-5" />} label="Высокий приоритет" value={String(urgentTasks.length)} />
        <BoardMetric icon={<CalendarClock className="h-5 w-5" />} label="Ближайшие сроки" value={String(dueSoonTasks.length)} />
        <BoardMetric icon={<CheckCircle2 className="h-5 w-5" />} label="Готово" value={String(doneTasks.length)} />
      </section>

      <section className="signal-panel border-info/25 bg-info/10">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="font-semibold">{selectedBoard.title}</div>
            <p className="mt-1 text-sm text-muted-foreground">
              {selectedBoard.description || "Личная доска для задач, которые не должны смешиваться с командными приглашениями и участниками."}
            </p>
          </div>
          <Button asChild variant="outline" size="sm">
            <Link href="/team/board">Открыть командную доску</Link>
          </Button>
        </div>
      </section>

      <section className="overflow-x-auto pb-3" aria-label="Личная канбан-доска">
        <div className="grid min-w-[72rem] grid-flow-col auto-cols-[17.5rem] gap-4 lg:min-w-0 lg:grid-flow-row lg:auto-cols-auto lg:grid-cols-4">
          {columns.map((column) => {
            const columnTasks = boardTasks.filter((task) => task.column_id === column.id);

            return (
              <section key={column.id} className="rounded-lg border border-border bg-fog p-3">
                <header className="mb-3 flex items-center justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-2">
                    <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: column.color }} />
                    <h2 className="truncate font-semibold">{column.title}</h2>
                  </div>
                  <span className="font-mono text-xs text-muted-foreground">{columnTasks.length}</span>
                </header>

                <div className="space-y-2">
                  {columnTasks.map((task) => (
                    <TaskCard
                      key={task.id}
                      task={task}
                      columns={columns}
                      comments={comments.filter((comment) => comment.task_id === task.id)}
                      goals={goals}
                      habitTasks={habitTasks}
                      months={months}
                    />
                  ))}
                  {columnTasks.length === 0 ? <p className="px-1 py-6 text-center text-sm text-muted-foreground">Здесь пока пусто</p> : null}
                </div>

                <details className="mt-3">
                  <summary className="flex cursor-pointer list-none items-center gap-2 rounded-md px-2 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-card hover:text-foreground">
                    <Plus className="h-4 w-4" />
                    Добавить задачу
                  </summary>
                  <TaskForm
                    boardId={selectedBoard.id}
                    columnId={column.id}
                    goals={goals}
                    habitTasks={habitTasks}
                    months={months}
                  />
                </details>
              </section>
            );
          })}
        </div>
      </section>
    </div>
  );
}

function BoardSelector({
  boards,
  selectedBoardId
}: {
  boards: PersonalBoard[];
  selectedBoardId: string;
}) {
  return (
    <div className="grid w-full gap-2 sm:grid-cols-[minmax(0,1fr)_auto] lg:w-auto lg:grid-cols-[260px_auto]">
      <form action="/tasks" className="contents">
        <div className="space-y-1">
          <Label>Доска</Label>
          <Select name="board" defaultValue={selectedBoardId}>
            {boards.map((board) => (
              <option key={board.id} value={board.id}>{board.title}</option>
            ))}
          </Select>
        </div>
        <Button type="submit" className="self-end">Открыть</Button>
      </form>
      <details className="sm:col-span-2">
        <summary className="mt-2 cursor-pointer list-none text-sm font-medium text-muted-foreground hover:text-foreground">
          Создать еще одну доску
        </summary>
        <Card className="mt-3">
          <CardContent className="p-4">
            <CreateBoardForm />
          </CardContent>
        </Card>
      </details>
    </div>
  );
}

function TaskCard({
  task,
  columns,
  comments,
  goals,
  habitTasks,
  months
}: {
  task: PersonalBoardTask;
  columns: PersonalBoardColumn[];
  comments: PersonalBoardComment[];
  goals: Goal[];
  habitTasks: Task[];
  months: Month[];
}) {
  const goal = task.goal_id ? goals.find((item) => item.id === task.goal_id) : null;
  const habitTask = task.habit_task_id ? habitTasks.find((item) => item.id === task.habit_task_id) : null;
  const month = task.month_id ? months.find((item) => item.id === task.month_id) : null;

  return (
    <article className="rounded-md border border-border bg-card p-3 shadow-[0_1px_3px_rgba(32,32,32,0.04)]">
      <div className="flex items-start justify-between gap-2">
        <h3 className="text-sm font-semibold leading-snug">{task.title}</h3>
        <Badge variant={priorityVariants[task.priority]}>{priorityLabels[task.priority]}</Badge>
      </div>
      {task.description ? <p className="mt-2 line-clamp-3 text-sm text-muted-foreground">{task.description}</p> : null}

      <div className="mt-3 flex flex-wrap gap-1.5">
        {task.due_date ? <DueDateBadge date={task.due_date} /> : null}
        {goal ? <Badge variant="outline"><Target className="mr-1 h-3 w-3" />{goal.title}</Badge> : null}
        {habitTask ? <Badge variant="outline">{habitTask.title}</Badge> : null}
        {month ? <Badge variant="outline">{month.title}</Badge> : null}
        {comments.length > 0 ? <Badge variant="secondary"><MessageSquare className="mr-1 h-3 w-3" />{comments.length}</Badge> : null}
      </div>

      <details className="mt-3 border-t border-border pt-3">
        <summary className="cursor-pointer text-xs font-medium text-muted-foreground hover:text-foreground">Открыть задачу</summary>
        <div className="mt-3 space-y-3">
          <form action={movePersonalBoardTaskAction} className="flex gap-2">
            <input type="hidden" name="boardId" value={task.board_id} />
            <input type="hidden" name="taskId" value={task.id} />
            <Select name="columnId" defaultValue={task.column_id} aria-label={`Переместить задачу ${task.title}`}>
              {columns.map((column) => <option key={column.id} value={column.id}>{column.title}</option>)}
            </Select>
            <Button type="submit" size="sm" variant="outline"><ChevronRight className="h-4 w-4" /> Перенести</Button>
          </form>

          <details className="rounded-md border border-border/80">
            <summary className="cursor-pointer px-3 py-2 text-xs font-medium text-muted-foreground hover:text-foreground">
              Редактировать
            </summary>
            <div className="border-t border-border/80 p-3">
              <TaskForm
                task={task}
                boardId={task.board_id}
                columnId={task.column_id}
                goals={goals}
                habitTasks={habitTasks}
                months={months}
              />
            </div>
          </details>

          {comments.length ? (
            <div className="space-y-2">
              {comments.map((comment) => (
                <p key={comment.id} className="rounded-md bg-fog px-3 py-2 text-xs text-muted-foreground">{comment.content}</p>
              ))}
            </div>
          ) : null}

          <form action={addPersonalBoardCommentAction} className="space-y-2">
            <input type="hidden" name="taskId" value={task.id} />
            <Textarea name="content" required className="min-h-16" placeholder="Комментарий для себя" />
            <Button type="submit" size="sm" variant="secondary">Добавить комментарий</Button>
          </form>

          <form action={archivePersonalBoardTaskAction}>
            <input type="hidden" name="boardId" value={task.board_id} />
            <input type="hidden" name="taskId" value={task.id} />
            <ConfirmSubmitButton type="submit" size="sm" variant="destructive" message="Архивировать личную задачу?">
              <Archive className="h-4 w-4" /> В архив
            </ConfirmSubmitButton>
          </form>
        </div>
      </details>
    </article>
  );
}

function TaskForm({
  task,
  boardId,
  columnId,
  goals,
  habitTasks,
  months
}: {
  task?: PersonalBoardTask;
  boardId: string;
  columnId: string;
  goals: Goal[];
  habitTasks: Task[];
  months: Month[];
}) {
  const action = task ? updatePersonalBoardTaskAction : createPersonalBoardTaskAction;

  return (
    <form action={action} className="mt-2 space-y-3 rounded-md border border-border bg-card p-3">
      <input type="hidden" name="boardId" value={boardId} />
      <input type="hidden" name="columnId" value={columnId} />
      {task ? <input type="hidden" name="taskId" value={task.id} /> : null}

      <div className="space-y-1">
        <Label>Задача</Label>
        <Input name="title" required defaultValue={task?.title ?? ""} placeholder="Что нужно сделать" />
      </div>

      <div className="space-y-1">
        <Label>Описание</Label>
        <Textarea name="description" className="min-h-16" defaultValue={task?.description ?? ""} placeholder="Контекст, шаги, критерий готовности" />
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1">
          <Label>Приоритет</Label>
          <Select name="priority" defaultValue={task?.priority ?? "medium"}>
            <option value="low">Низкий</option>
            <option value="medium">Обычный</option>
            <option value="high">Высокий</option>
            <option value="urgent">Срочно</option>
          </Select>
        </div>
        <div className="space-y-1">
          <Label>Срок</Label>
          <Input name="dueDate" type="date" defaultValue={task?.due_date ?? ""} />
        </div>
      </div>

      <div className="space-y-1">
        <Label>Связать с целью</Label>
        <Select name="goalId" defaultValue={task?.goal_id ?? ""}>
          <option value="">Без цели</option>
          {goals.map((goal) => <option key={goal.id} value={goal.id}>{goal.title}</option>)}
        </Select>
      </div>

      <div className="space-y-1">
        <Label>Связать с привычкой</Label>
        <Select name="habitTaskId" defaultValue={task?.habit_task_id ?? ""}>
          <option value="">Без привычки</option>
          {habitTasks.map((habitTask) => <option key={habitTask.id} value={habitTask.id}>{habitTask.title}</option>)}
        </Select>
      </div>

      <div className="space-y-1">
        <Label>Связать с месяцем</Label>
        <Select name="monthId" defaultValue={task?.month_id ?? ""}>
          <option value="">Без месяца</option>
          {months.map((month) => <option key={month.id} value={month.id}>{month.title}</option>)}
        </Select>
      </div>

      <Button type="submit" size="sm">
        <Plus className="h-4 w-4" />
        {task ? "Сохранить" : "Добавить"}
      </Button>
    </form>
  );
}

function EmptyPersonalBoardState() {
  return (
    <div className="app-page">
      <header className="workspace-header">
        <div>
          <div className="page-kicker">Личное рабочее пространство</div>
          <h1 className="workspace-title mt-1">Задачи</h1>
          <p className="workspace-subtitle">
            Создайте первую личную доску. Она не будет связана с командой и не изменит план/факт.
          </p>
        </div>
      </header>
      <Card className="section-panel max-w-2xl">
        <CardHeader>
          <CardTitle>Создать личную доску</CardTitle>
          <CardDescription>По умолчанию появятся колонки «Входящие», «В работе», «На паузе» и «Готово».</CardDescription>
        </CardHeader>
        <CardContent>
          <CreateBoardForm />
        </CardContent>
      </Card>
    </div>
  );
}

function CreateBoardForm() {
  return (
    <form action={createPersonalBoardAction} className="space-y-4">
      <div className="space-y-2">
        <Label>Название</Label>
        <Input name="title" required defaultValue="Личная доска" placeholder="Например, Личные проекты" />
      </div>
      <div className="space-y-2">
        <Label>Описание</Label>
        <Textarea name="description" placeholder="Для каких задач эта доска" />
      </div>
      <Button type="submit"><Plus className="h-4 w-4" /> Создать доску</Button>
    </form>
  );
}

function BoardMetric({
  icon,
  label,
  value
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-lg border border-border bg-card px-4 py-3">
      <div className="flex items-center justify-between gap-3 text-muted-foreground">
        <div className="text-xs">{label}</div>
        {icon}
      </div>
      <div className="mt-2 font-mono text-3xl font-semibold tabular-nums">{value}</div>
    </div>
  );
}

function DueDateBadge({ date }: { date: string }) {
  const days = daysUntil(date);
  const label = days < 0 ? `просрочено ${Math.abs(days)} дн.` : days === 0 ? "сегодня" : `через ${days} дн.`;
  const variant = days < 0 ? "destructive" : days <= 3 ? "warning" : "outline";

  return <Badge variant={variant}>{label}</Badge>;
}

function isDoneColumn(title: string) {
  return title.trim().toLowerCase() === "готово" || title.trim().toLowerCase() === "done";
}

function daysUntil(date: string) {
  const today = new Date();
  const todayUtc = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate());
  const [year, month, day] = date.split("-").map(Number);
  const targetUtc = Date.UTC(year, month - 1, day);

  return Math.round((targetUtc - todayUtc) / 86_400_000);
}
