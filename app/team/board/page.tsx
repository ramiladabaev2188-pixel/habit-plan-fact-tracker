import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, ChevronRight, MessageSquare, Plus, Rows3, Users } from "lucide-react";
import {
  addTeamBoardCommentAction,
  createTeamBoardAction,
  createTeamBoardTaskAction,
  moveTeamBoardTaskAction
} from "@/app/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { ErrorState } from "@/components/shared/page-state";
import { SetupNotice } from "@/components/shared/setup-notice";
import { loadTeamBoardData } from "@/lib/supabase/team-data";
import type { TeamBoardPriority } from "@/types/domain";

const priorityLabels: Record<TeamBoardPriority, string> = {
  low: "Низкий",
  medium: "Обычный",
  high: "Высокий",
  urgent: "Срочно"
};

export default async function TeamBoardPage({
  searchParams
}: {
  searchParams: Promise<{ team?: string; board?: string }>;
}) {
  const params = await searchParams;
  const result = await loadTeamBoardData({ teamId: params.team, boardId: params.board });

  if (!result.configured) return <SetupNotice />;
  if (!result.user) redirect("/login");
  if (result.error || !result.data) return <ErrorState message={result.error ?? "Не удалось загрузить доску"} />;

  const { user, teams, selectedTeam, members, profiles, boards, selectedBoard, columns, tasks, comments } = result.data;

  if (!selectedTeam) {
    return <NoTeamState />;
  }

  const profileById = new Map(profiles.map((profile) => [profile.id, profile]));
  const ownMember = members.find((member) => member.user_id === user.id);
  const canManage = ownMember?.role === "owner" || ownMember?.role === "admin";

  if (!selectedBoard) {
    return <EmptyBoardState teamId={selectedTeam.id} teamName={selectedTeam.name} canManage={canManage} />;
  }

  return (
    <div className="app-page">
      <header className="workspace-header">
        <div>
          <Link href={`/team?team=${selectedTeam.id}`} className="inline-flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground">
            <ArrowLeft className="h-4 w-4" />
            К команде
          </Link>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <h1 className="workspace-title">{selectedBoard.title}</h1>
            <Badge variant="info">Доска задач</Badge>
          </div>
          <p className="workspace-subtitle">{selectedTeam.name}. Задачи команды существуют отдельно от личных привычек и месячных планов.</p>
        </div>
        <BoardSelector teams={teams} boards={boards} selectedTeamId={selectedTeam.id} selectedBoardId={selectedBoard.id} />
      </header>

      <section className="grid gap-3 sm:grid-cols-3" aria-label="Сводка доски">
        <BoardMetric label="Задач" value={String(tasks.length)} />
        <BoardMetric label="В работе" value={String(tasks.filter((task) => columns.find((column) => column.id === task.column_id)?.title === "В работе").length)} />
        <BoardMetric label="Участников" value={String(members.length)} />
      </section>

      <section className="overflow-x-auto pb-3" aria-label="Канбан-доска">
        <div className="grid min-w-[72rem] grid-flow-col auto-cols-[17.5rem] gap-4 lg:min-w-0 lg:grid-flow-row lg:auto-cols-auto lg:grid-cols-4">
          {columns.map((column) => {
            const columnTasks = tasks.filter((task) => task.column_id === column.id);

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
                      teamId={selectedTeam.id}
                      boardId={selectedBoard.id}
                      profileById={profileById}
                      commentCount={comments.filter((comment) => comment.task_id === task.id).length}
                    />
                  ))}
                  {columnTasks.length === 0 ? <p className="px-1 py-6 text-center text-sm text-muted-foreground">Задач пока нет</p> : null}
                </div>

                <details className="mt-3">
                  <summary className="flex cursor-pointer list-none items-center gap-2 rounded-md px-2 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-card hover:text-foreground">
                    <Plus className="h-4 w-4" />
                    Добавить задачу
                  </summary>
                  <TaskForm teamId={selectedTeam.id} boardId={selectedBoard.id} columnId={column.id} members={members} profileById={profileById} />
                </details>
              </section>
            );
          })}
        </div>
      </section>

      <Card className="section-panel">
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Rows3 className="h-5 w-5 text-primary" /> Пилот доски</CardTitle>
          <CardDescription>
            Сейчас задача создаётся, назначается, обсуждается и переносится через выбор статуса. Drag-and-drop, уведомления и отдельное представление «Мои задачи» добавим после проверки этой механики на вашей команде.
          </CardDescription>
        </CardHeader>
      </Card>
    </div>
  );
}

function BoardSelector({
  teams,
  boards,
  selectedTeamId,
  selectedBoardId
}: {
  teams: { id: string; name: string }[];
  boards: { id: string; title: string }[];
  selectedTeamId: string;
  selectedBoardId: string;
}) {
  return (
    <form action="/team/board" className="grid w-full gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] lg:w-auto lg:grid-cols-[220px_220px_auto]">
      <div className="space-y-1"><Label>Команда</Label><Select name="team" defaultValue={selectedTeamId}>{teams.map((team) => <option key={team.id} value={team.id}>{team.name}</option>)}</Select></div>
      <div className="space-y-1"><Label>Доска</Label><Select name="board" defaultValue={selectedBoardId}>{boards.map((board) => <option key={board.id} value={board.id}>{board.title}</option>)}</Select></div>
      <Button type="submit" className="self-end">Открыть</Button>
    </form>
  );
}

function TaskCard({
  task,
  columns,
  teamId,
  boardId,
  profileById,
  commentCount
}: {
  task: { id: string; column_id: string; title: string; description: string | null; priority: TeamBoardPriority; assignee_id: string | null; due_date: string | null };
  columns: { id: string; title: string }[];
  teamId: string;
  boardId: string;
  profileById: Map<string, { name: string; email?: string | null }>;
  commentCount: number;
}) {
  const assignee = task.assignee_id ? profileById.get(task.assignee_id) : null;

  return (
    <article className="rounded-md border border-border bg-card p-3 shadow-[0_1px_3px_rgba(32,32,32,0.04)]">
      <div className="flex items-start justify-between gap-2">
        <h3 className="text-sm font-semibold leading-snug">{task.title}</h3>
        <Badge variant={task.priority === "urgent" ? "destructive" : task.priority === "high" ? "warning" : "outline"}>{priorityLabels[task.priority]}</Badge>
      </div>
      <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
        <span>{assignee?.name || assignee?.email || "Без исполнителя"}</span>
        {task.due_date ? <span>до {formatDate(task.due_date)}</span> : null}
        {commentCount > 0 ? <span className="inline-flex items-center gap-1"><MessageSquare className="h-3.5 w-3.5" /> {commentCount}</span> : null}
      </div>
      <details className="mt-3 border-t border-border pt-3">
        <summary className="cursor-pointer text-xs font-medium text-muted-foreground hover:text-foreground">Открыть задачу</summary>
        <div className="mt-3 space-y-3">
          {task.description ? <p className="whitespace-pre-wrap text-sm text-muted-foreground">{task.description}</p> : null}
          <form action={moveTeamBoardTaskAction} className="flex gap-2">
            <input type="hidden" name="teamId" value={teamId} />
            <input type="hidden" name="boardId" value={boardId} />
            <input type="hidden" name="taskId" value={task.id} />
            <Select name="columnId" defaultValue={task.column_id} aria-label={`Переместить задачу ${task.title}`}>
              {columns.map((column) => <option key={column.id} value={column.id}>{column.title}</option>)}
            </Select>
            <Button type="submit" size="sm" variant="outline"><ChevronRight className="h-4 w-4" /> Перенести</Button>
          </form>
          <form action={addTeamBoardCommentAction} className="space-y-2">
            <input type="hidden" name="teamId" value={teamId} />
            <input type="hidden" name="boardId" value={boardId} />
            <input type="hidden" name="taskId" value={task.id} />
            <Textarea name="content" required className="min-h-16" placeholder="Комментарий для команды" />
            <Button type="submit" size="sm" variant="secondary">Добавить комментарий</Button>
          </form>
        </div>
      </details>
    </article>
  );
}

function TaskForm({
  teamId,
  boardId,
  columnId,
  members,
  profileById
}: {
  teamId: string;
  boardId: string;
  columnId: string;
  members: { user_id: string }[];
  profileById: Map<string, { name: string; email?: string | null }>;
}) {
  return (
    <form action={createTeamBoardTaskAction} className="mt-2 space-y-3 rounded-md border border-border bg-card p-3">
      <input type="hidden" name="teamId" value={teamId} />
      <input type="hidden" name="boardId" value={boardId} />
      <input type="hidden" name="columnId" value={columnId} />
      <div className="space-y-1"><Label>Задача</Label><Input name="title" required placeholder="Что нужно сделать" /></div>
      <div className="space-y-1"><Label>Описание</Label><Textarea name="description" className="min-h-16" placeholder="Контекст, критерий готовности" /></div>
      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1"><Label>Приоритет</Label><Select name="priority" defaultValue="medium"><option value="low">Низкий</option><option value="medium">Обычный</option><option value="high">Высокий</option><option value="urgent">Срочно</option></Select></div>
        <div className="space-y-1"><Label>Исполнитель</Label><Select name="assigneeId" defaultValue=""><option value="">Не назначен</option>{members.map((member) => { const profile = profileById.get(member.user_id); return <option key={member.user_id} value={member.user_id}>{profile?.name || profile?.email || "Участник"}</option>; })}</Select></div>
      </div>
      <div className="space-y-1"><Label>Дедлайн</Label><Input name="dueDate" type="date" /></div>
      <Button type="submit" size="sm"><Plus className="h-4 w-4" /> Добавить</Button>
    </form>
  );
}

function EmptyBoardState({ teamId, teamName, canManage }: { teamId: string; teamName: string; canManage: boolean }) {
  return (
    <div className="app-page">
      <header className="workspace-header"><div><Link href={`/team?team=${teamId}`} className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="h-4 w-4" /> К команде</Link><h1 className="workspace-title mt-3">Командная доска</h1><p className="workspace-subtitle">{teamName}. Здесь появятся общие задачи, ответственность и обсуждения.</p></div></header>
      <Card className="section-panel max-w-2xl"><CardHeader><CardTitle>Тестовая доска</CardTitle><CardDescription>Будет создана отдельная доска с колонками «Идеи», «В работе», «Ждёт» и «Готово». Она не использует личные планы или факты.</CardDescription></CardHeader><CardContent>{canManage ? <form action={createTeamBoardAction} className="space-y-4"><input type="hidden" name="teamId" value={teamId} /><div className="space-y-2"><Label>Название доски</Label><Input name="title" required defaultValue="Рабочая доска" /></div><div className="space-y-2"><Label>Описание</Label><Textarea name="description" placeholder="О чём эта совместная работа" /></div><Button type="submit"><Plus className="h-4 w-4" /> Создать тестовую доску</Button></form> : <p className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">Создать доску может владелец или администратор команды.</p>}</CardContent></Card>
    </div>
  );
}

function NoTeamState() {
  return <div className="app-page"><Card className="section-panel"><CardHeader><CardTitle className="flex items-center gap-2"><Users className="h-5 w-5" /> Сначала нужна команда</CardTitle><CardDescription>Создайте команду или примите приглашение, затем здесь можно будет открыть общую доску задач.</CardDescription></CardHeader><CardContent><Button asChild><Link href="/team">Перейти к команде</Link></Button></CardContent></Card></div>;
}

function BoardMetric({ label, value }: { label: string; value: string }) {
  return <div className="rounded-lg border border-border bg-card px-4 py-3"><div className="text-xs text-muted-foreground">{label}</div><div className="mt-1 font-mono text-2xl font-semibold tabular-nums">{value}</div></div>;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "short", timeZone: "UTC" }).format(new Date(`${value}T00:00:00Z`));
}
