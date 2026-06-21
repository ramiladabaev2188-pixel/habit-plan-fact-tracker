import { headers } from "next/headers";
import { redirect } from "next/navigation";
import {
  Activity,
  AlertTriangle,
  Flag,
  Gauge,
  Plus,
  Settings2,
  Sparkles,
  Target,
  Trophy,
  Users
} from "lucide-react";
import {
  addTeamChallengeCheckinAction,
  addTeamGoalContributionAction,
  createTeamAction,
  createTeamChallengeAction,
  createTeamGoalAction,
  createTeamInviteAction,
  leaveTeamAction,
  updateTeamPrivacyAction
} from "@/app/actions";
import { TeamInitiativeActivityChart, TeamTempoChart } from "@/components/charts/team-charts";
import { CopyInviteLink } from "@/components/team/copy-invite-link";
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
import { getMonthTitle } from "@/lib/dates/month";
import { calculateTeamStats, type TeamMemberSnapshot } from "@/lib/team-metrics";
import { loadTeamDashboardData } from "@/lib/supabase/team-data";
import { formatPercent, formatScore } from "@/lib/utils";

type InitiativeProgress = {
  id: string;
  title: string;
  description: string | null;
  unit: string;
  target: number;
  value: number;
  percent: number;
  dueDate: string | null;
  status: string;
};

export default async function TeamPage({
  searchParams
}: {
  searchParams: Promise<{ team?: string; year?: string; month?: string; invite?: string }>;
}) {
  const params = await searchParams;
  const result = await loadTeamDashboardData({
    teamId: params.team,
    year: params.year ? Number(params.year) : undefined,
    month: params.month ? Number(params.month) : undefined
  });

  if (!result.configured) {
    return <SetupNotice />;
  }

  if (!result.user) {
    redirect("/login");
  }

  if (result.error || !result.data) {
    return <ErrorState message={result.error ?? "Не удалось загрузить команду"} />;
  }

  const {
    user,
    teams,
    selectedTeam,
    members,
    profiles,
    shareTaskDetails,
    invites,
    year,
    month,
    months,
    tasks,
    plans,
    facts,
    teamGoals,
    teamGoalContributions,
    teamChallenges,
    teamChallengeCheckins
  } = result.data;

  if (!selectedTeam) {
    return <EmptyTeamState />;
  }

  const profileMap = new Map(profiles.map((profile) => [profile.id, profile]));
  const snapshots: TeamMemberSnapshot[] = members.map((member) => {
    const memberMonth = months.find((item) => item.user_id === member.user_id) ?? null;

    return {
      userId: member.user_id,
      profile: profileMap.get(member.user_id) ?? null,
      month: memberMonth,
      tasks: tasks.filter((task) => task.user_id === member.user_id),
      plans: memberMonth ? plans.filter((plan) => plan.month_id === memberMonth.id) : [],
      facts: memberMonth ? facts.filter((fact) => fact.month_id === memberMonth.id) : []
    };
  });

  const stats = calculateTeamStats(snapshots);
  const ownMembership = members.find((member) => member.user_id === user.id) ?? null;
  const isOwner = selectedTeam.owner_id === user.id;
  const canManage = isOwner || ownMembership?.role === "owner" || ownMembership?.role === "admin";
  const inviteLink = params.invite ? `${await getOrigin()}/team/invite/${params.invite}` : null;
  const goals = toInitiativeProgress(teamGoals, teamGoalContributions, "goal_id");
  const challenges = toInitiativeProgress(teamChallenges, teamChallengeCheckins, "challenge_id");
  const activity = members.map((member) => ({
    name: profileMap.get(member.user_id)?.name || profileMap.get(member.user_id)?.email || "Участник",
    goalValue: sumByUser(teamGoalContributions, member.user_id),
    challengeValue: sumByUser(teamChallengeCheckins, member.user_id)
  }));
  const tempo = stats.memberStats.map((member) => ({
    name: member.name,
    forecastPercent: member.forecastPercent,
    factScore: member.factScore
  }));

  return (
    <div className="app-page team-page">
      <header className="workspace-header">
        <div>
          <div className="page-kicker">Командный контур</div>
          <div className="mt-1 flex flex-wrap items-center gap-3">
            <h1 className="workspace-title">{selectedTeam.name}</h1>
            <Badge variant="info">{getMonthTitle(year, month)}</Badge>
          </div>
          <p className="workspace-subtitle">
            {members.length} {pluralizeMembers(members.length)} · общий ритм, инициативы и вклад каждого без доступа к чужому редактированию.
          </p>
        </div>
        <TeamPeriodSelector teams={teams} selectedTeamId={selectedTeam.id} year={year} month={month} />
      </header>

      {inviteLink ? (
        <section className="signal-panel flex flex-col gap-3 border-info/35 bg-info/10 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="font-semibold">Ссылка приглашения готова</div>
            <p className="mt-1 text-sm text-muted-foreground">
              Скопируйте её и отправьте человеку. Открывать ссылку самому не нужно.
            </p>
          </div>
          <CopyInviteLink inviteLink={inviteLink} />
        </section>
      ) : null}

      <section className="team-scoreboard" aria-label="Сводка команды за выбранный месяц">
        <div className="team-scoreboard-main">
          <div className="page-kicker">Темп команды за {getMonthTitle(year, month)}</div>
          <div className="mt-4 flex flex-wrap items-end justify-between gap-4">
            <div>
              <div className="text-5xl font-semibold tracking-tight md:text-6xl">{formatPercent(stats.forecastPercent)}</div>
              <div className="mt-2 text-sm text-muted-foreground">
                прогноз по ритму · факт {formatScore(stats.factScore)} из {formatScore(stats.planScore)} баллов
              </div>
            </div>
            <Badge variant={stats.forecastPercent >= 0.8 ? "success" : stats.forecastPercent >= 0.6 ? "warning" : "destructive"}>
              {stats.forecastPercent >= 0.8 ? "Темп достаточный" : "Нужен общий фокус"}
            </Badge>
          </div>
          <Progress className="mt-6" value={Math.min(stats.forecastPercent, 1.2) * 100} />
        </div>
        <div className="team-scoreboard-side grid gap-4 sm:grid-cols-3 md:grid-cols-1">
          <Metric label="Факт месяца" value={formatPercent(stats.completion)} />
          <Metric label="Нужно в день" value={formatScore(stats.requiredPerDay)} />
          <Metric label="Участники с планом" value={`${stats.membersWithPlan} / ${stats.activeMembers}`} />
        </div>
      </section>

      {stats.focusMember ? (
        <section className="signal-panel flex gap-3 border-warning/35 bg-warning/10">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-warning" />
          <div>
            <div className="font-semibold">Главный общий фокус</div>
            <p className="mt-1 text-sm text-muted-foreground">
              Чтобы команда удержала темп, сейчас больше всего поможет поддержка {stats.focusMember.name}: {formatScore(stats.focusMember.requiredPerDay)} балла в день до конца периода.
            </p>
          </div>
        </section>
      ) : (
        <section className="signal-panel flex gap-3 border-success/35 bg-success/10">
          <Sparkles className="mt-0.5 h-5 w-5 shrink-0 text-success" />
          <div>
            <div className="font-semibold">Команда держит ритм</div>
            <p className="mt-1 text-sm text-muted-foreground">Сейчас нет участников с прогнозом ниже целевого темпа 80%.</p>
          </div>
        </section>
      )}

      <section className="grid gap-4 xl:grid-cols-[1.25fr_0.75fr]">
        <Card className="section-panel">
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Gauge className="h-5 w-5 text-primary" /> Темп участников</CardTitle>
            <CardDescription>Прогноз показывает, успеет ли участник к цели, с учётом уже запланированных дней.</CardDescription>
          </CardHeader>
          <CardContent><TeamTempoChart data={tempo} /></CardContent>
        </Card>
        <Card className="section-panel">
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Activity className="h-5 w-5 text-accent" /> Вклад в инициативы</CardTitle>
            <CardDescription>Отдельный командный прогресс: он не смешивается с личными планами.</CardDescription>
          </CardHeader>
          <CardContent><TeamInitiativeActivityChart data={activity} /></CardContent>
        </Card>
      </section>

      <section className="space-y-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="page-kicker">Общее дело</div>
            <h2 className="mt-1 text-2xl font-semibold tracking-normal">Цели и челленджи команды</h2>
          </div>
          <p className="max-w-xl text-sm text-muted-foreground">Это самостоятельные инициативы: личные привычки и факты в них не копируются.</p>
        </div>
        <div className="grid gap-4 xl:grid-cols-2">
          <InitiativePanel
            icon={<Target className="h-5 w-5 text-primary" />}
            title="Командные цели"
            description="Общий измеримый результат: километры, встречи, полезные действия или любая своя единица."
            empty="Пока нет общей цели. Создайте первую и добавляйте вклад вместе."
            items={goals}
            teamId={selectedTeam.id}
            canManage={canManage}
            kind="goal"
          />
          <InitiativePanel
            icon={<Trophy className="h-5 w-5 text-signal" />}
            title="Челленджи"
            description="Короткий совместный спринт с понятной планкой и добровольным вкладом."
            empty="Челленджей пока нет. Запустите короткий ритм на неделю или месяц."
            items={challenges}
            teamId={selectedTeam.id}
            canManage={canManage}
            kind="challenge"
          />
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
        <Card className="section-panel">
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Users className="h-5 w-5 text-primary" /> Участники</CardTitle>
            <CardDescription>Личные планы остаются личными: команда видит только разрешённый аналитический срез.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {stats.memberStats.map((member) => (
              <article key={member.userId} className="list-row">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <div className="font-semibold">{member.name}</div>
                    <div className="mt-1 text-xs text-muted-foreground">
                      {member.month ? member.month.title : "Нет личного месяца на этот период"}
                    </div>
                  </div>
                  <Badge variant={member.forecastPercent >= 0.8 ? "success" : member.forecastPercent >= 0.6 ? "warning" : "destructive"}>
                    Прогноз {formatPercent(member.forecastPercent)}
                  </Badge>
                </div>
                <Progress className="mt-3" value={Math.min(member.forecastPercent, 1.2) * 100} />
                <div className="mt-3 grid gap-2 text-sm text-muted-foreground sm:grid-cols-3">
                  <span>Факт: {formatScore(member.factScore)}</span>
                  <span>План: {formatScore(member.planScore)}</span>
                  <span>Нужно/день: {formatScore(member.requiredPerDay)}</span>
                </div>
              </article>
            ))}
          </CardContent>
        </Card>

        <Card className="section-panel">
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Flag className="h-5 w-5 text-warning" /> Точки внимания</CardTitle>
            <CardDescription>Только задачи с прогнозом ниже целевого темпа, а не обычное отставание начала месяца.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {stats.riskTasks.length ? stats.riskTasks.map((task) => (
              <article key={`${task.userId}-${task.title}`} className="list-row">
                <div className="text-sm font-semibold">{task.title}</div>
                <div className="mt-1 text-xs text-muted-foreground">{task.memberName}</div>
                <div className="mt-3 flex items-center justify-between gap-3 text-sm">
                  <span>Прогноз {formatPercent(task.forecastPercent)}</span>
                  <span>{formatScore(task.requiredPerDay)} в день</span>
                </div>
              </article>
            )) : (
              <div className="rounded-md border border-dashed border-success/35 bg-success/10 p-4 text-sm text-muted-foreground">
                Сейчас нет задач с риском по прогнозу. Это здоровый сигнал: команда не путает будущий план с сегодняшним отставанием.
              </div>
            )}
          </CardContent>
        </Card>
      </section>

      <details className="section-panel overflow-hidden">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-4 p-5 transition-colors hover:bg-fog">
          <div>
            <div className="flex items-center gap-2 font-semibold"><Settings2 className="h-5 w-5 text-muted-foreground" /> Управление командой</div>
            <p className="mt-1 text-sm text-muted-foreground">Приглашения, приватность, выход и создание другой команды.</p>
          </div>
          <span className="text-sm text-muted-foreground">Открыть</span>
        </summary>
        <div className="grid gap-4 border-t border-border p-5 xl:grid-cols-2">
          <Card className="border-border/80 shadow-none">
            <CardHeader>
              <CardTitle>Приглашения</CardTitle>
              <CardDescription>Создавать ссылки могут владелец и администратор.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {canManage ? (
                <form action={createTeamInviteAction} className="grid gap-3 sm:grid-cols-[1fr_160px_auto] sm:items-end">
                  <input type="hidden" name="teamId" value={selectedTeam.id} />
                  <div className="space-y-2"><Label htmlFor="invite-email">Email, если ссылка адресная</Label><Input id="invite-email" name="email" type="email" placeholder="friend@example.com" /></div>
                  <div className="space-y-2"><Label htmlFor="invite-role">Роль</Label><Select id="invite-role" name="role" defaultValue="member"><option value="member">Участник</option><option value="admin">Администратор</option></Select></div>
                  <Button type="submit"><Plus className="h-4 w-4" /> Создать ссылку</Button>
                </form>
              ) : <p className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">Приглашения создаёт владелец или администратор команды.</p>}
              {invites.length ? (
                <div className="space-y-2">
                  {invites.slice(0, 5).map((invite) => (
                    <div key={invite.id} className="list-row text-sm"><div className="font-medium">{invite.email || "Ссылка без email"}</div><div className="mt-1 text-xs text-muted-foreground">{invite.role === "admin" ? "Администратор" : "Участник"} · действует до {formatDate(invite.expires_at)}</div></div>
                  ))}
                </div>
              ) : null}
            </CardContent>
          </Card>

          <div className="space-y-4">
            <Card className="border-border/80 shadow-none">
              <CardHeader><CardTitle>Приватность</CardTitle><CardDescription>Вы сами решаете, показывать ли команде детали личных задач.</CardDescription></CardHeader>
              <CardContent>
                <form action={updateTeamPrivacyAction} className="space-y-4">
                  <input type="hidden" name="teamId" value={selectedTeam.id} />
                  <label className="flex items-start gap-3 text-sm"><input type="checkbox" name="shareTaskDetails" className="mt-1 h-4 w-4" defaultChecked={shareTaskDetails} /><span>Показывать названия задач, план и факт в подробной аналитике команды.</span></label>
                  <Button type="submit" variant="outline">Сохранить приватность</Button>
                </form>
              </CardContent>
            </Card>
            {!isOwner && ownMembership?.role !== "owner" ? (
              <form action={leaveTeamAction}><input type="hidden" name="teamId" value={selectedTeam.id} /><ConfirmSubmitButton type="submit" variant="destructive" message="Выйти из команды? Личные данные и месяцы останутся только у вас.">Выйти из команды</ConfirmSubmitButton></form>
            ) : null}
            <details className="rounded-lg border border-border bg-fog p-4"><summary className="cursor-pointer text-sm font-medium">Создать ещё одну команду</summary><div className="mt-4"><CreateTeamForm /></div></details>
          </div>
        </div>
      </details>
    </div>
  );
}

function EmptyTeamState() {
  return (
    <div className="app-page">
      <header className="workspace-header"><div><div className="page-kicker">Командный контур</div><h1 className="workspace-title mt-1">Команда</h1><p className="workspace-subtitle">Соберите небольшую группу, чтобы видеть общий темп и вести отдельные общие инициативы.</p></div></header>
      <div className="grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
        <Card className="section-panel"><CardHeader><CardTitle className="flex items-center gap-2"><Users className="h-5 w-5 text-primary" /> Как это работает</CardTitle></CardHeader><CardContent className="space-y-4 text-sm text-muted-foreground"><p>Каждый ведёт собственный месяц и вносит факты только за себя.</p><p>Команда видит прогнозный темп, а не ложное «отставание» от будущих дней.</p><p>Общие цели и челленджи существуют отдельно и заполняются добровольными вкладами.</p></CardContent></Card>
        <Card className="section-panel"><CardHeader><CardTitle>Новая команда</CardTitle><CardDescription>Например, друзья, семья или группа совместного роста.</CardDescription></CardHeader><CardContent><CreateTeamForm /></CardContent></Card>
      </div>
    </div>
  );
}

function TeamPeriodSelector({ teams, selectedTeamId, year, month }: { teams: { id: string; name: string }[]; selectedTeamId: string; year: number; month: number }) {
  return <form className="grid w-full gap-2 sm:grid-cols-[minmax(0,1fr)_100px_100px_auto] lg:w-auto lg:grid-cols-[220px_110px_110px_auto]" action="/team"><div className="space-y-1"><Label>Команда</Label><Select name="team" defaultValue={selectedTeamId}>{teams.map((team) => <option key={team.id} value={team.id}>{team.name}</option>)}</Select></div><div className="space-y-1"><Label>Год</Label><Input name="year" type="number" min={2020} max={2100} defaultValue={year} /></div><div className="space-y-1"><Label>Месяц</Label><Input name="month" type="number" min={1} max={12} defaultValue={month} /></div><Button type="submit" className="self-end">Открыть</Button></form>;
}

function InitiativePanel({ icon, title, description, empty, items, teamId, canManage, kind }: { icon: React.ReactNode; title: string; description: string; empty: string; items: InitiativeProgress[]; teamId: string; canManage: boolean; kind: "goal" | "challenge" }) {
  const isGoal = kind === "goal";
  const contributionAction = isGoal ? addTeamGoalContributionAction : addTeamChallengeCheckinAction;
  const createAction = isGoal ? createTeamGoalAction : createTeamChallengeAction;

  return <Card className="section-panel"><CardHeader><div className="flex items-start justify-between gap-3"><div><CardTitle className="flex items-center gap-2">{icon}{title}</CardTitle><CardDescription className="mt-2">{description}</CardDescription></div>{canManage ? <Badge variant="outline">Управление</Badge> : null}</div></CardHeader><CardContent className="space-y-3">{items.length ? items.map((item) => <article key={item.id} className="list-row"><div className="flex flex-wrap items-start justify-between gap-3"><div><div className="font-semibold">{item.title}</div><div className="mt-1 text-xs text-muted-foreground">{item.description || "Описание не добавлено"}</div></div><Badge variant={item.percent >= 1 ? "success" : item.status === "archived" ? "secondary" : "info"}>{item.percent >= 1 ? "Достигнута" : `${formatPercent(item.percent)}`}</Badge></div><Progress className="mt-3" value={Math.min(item.percent, 1) * 100} /><div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-sm text-muted-foreground"><span>{formatScore(item.value)} из {formatScore(item.target)} {item.unit}</span><span>{item.dueDate ? `до ${formatDate(item.dueDate)}` : "без дедлайна"}</span></div>{item.status === "active" ? <form action={contributionAction} className="mt-3 flex flex-col gap-2 sm:flex-row"><input type="hidden" name="teamId" value={teamId} /><input type="hidden" name="initiativeId" value={item.id} /><Input name="value" type="number" min="0.01" step="0.01" required placeholder={`Вклад, ${item.unit}`} aria-label={`Вклад в инициативу ${item.title}`} /><Input name="note" maxLength={500} placeholder="Короткий комментарий, необязательно" aria-label={`Комментарий к инициативе ${item.title}`} /><Button type="submit" variant="outline">Добавить вклад</Button></form> : null}</article>) : <div className="rounded-md border border-dashed p-5 text-sm text-muted-foreground">{empty}</div>}{canManage ? <details className="rounded-md border border-border bg-fog"><summary className="cursor-pointer px-3 py-2 text-sm font-medium">Создать {isGoal ? "цель" : "челлендж"}</summary><form action={createAction} className="grid gap-3 border-t border-border p-3"><input type="hidden" name="teamId" value={teamId} />{!isGoal ? <input type="hidden" name="status" value="active" /> : null}<div className="grid gap-3 sm:grid-cols-2"><div className="space-y-2"><Label>Название</Label><Input name="title" required placeholder={isGoal ? "Например, 300 км вместе" : "Например, 7 дней без пропусков"} /></div><div className="space-y-2"><Label>Единица</Label><Input name="unit" required defaultValue={isGoal ? "км" : "раз"} /></div></div><div className="grid gap-3 sm:grid-cols-2"><div className="space-y-2"><Label>Целевое значение</Label><Input name="targetValue" type="number" min="0.01" step="0.01" required /></div><div className="space-y-2"><Label>Дедлайн</Label><Input name="dueDate" type="date" /></div></div><div className="space-y-2"><Label>Описание</Label><Textarea name="description" className="min-h-20" placeholder="Зачем это команде и как считаем вклад" /></div><Button type="submit"><Plus className="h-4 w-4" /> Создать</Button></form></details> : null}</CardContent></Card>;
}

function Metric({ label, value }: { label: string; value: string }) { return <div><div className="text-sm text-muted-foreground">{label}</div><div className="mt-1 text-2xl font-semibold tracking-tight">{value}</div></div>; }

function CreateTeamForm() { return <form action={createTeamAction} className="grid gap-3"><div className="space-y-2"><Label htmlFor="team-name">Название</Label><Input id="team-name" name="name" required placeholder="Например, Команда роста" /></div><div className="space-y-2"><Label htmlFor="team-description">Описание</Label><Textarea id="team-description" name="description" placeholder="Для чего собираемся и какой ритм держим" /></div><Button type="submit"><Users className="h-4 w-4" /> Создать команду</Button></form>; }

function toInitiativeProgress<T extends { id: string; title: string; description: string | null; unit: string; target_value: number; due_date: string | null; status: string }, C extends { value: number }>(items: T[], contributions: C[], relationKey: "goal_id" | "challenge_id"): InitiativeProgress[] { return items.map((item) => { const value = contributions.filter((contribution) => (contribution as C & Record<string, string>)[relationKey] === item.id).reduce((sum, contribution) => sum + contribution.value, 0); return { id: item.id, title: item.title, description: item.description, unit: item.unit, target: item.target_value, value, percent: item.target_value > 0 ? value / item.target_value : 0, dueDate: item.due_date, status: item.status }; }); }

function sumByUser(items: { user_id: string; value: number }[], userId: string) { return items.filter((item) => item.user_id === userId).reduce((sum, item) => sum + item.value, 0); }
function formatDate(value: string) { return new Intl.DateTimeFormat("ru-RU", { timeZone: "UTC", day: "numeric", month: "short" }).format(new Date(`${value.slice(0, 10)}T00:00:00Z`)); }
function pluralizeMembers(value: number) { const remainder = value % 100; if (remainder >= 11 && remainder <= 14) return "участников"; const last = value % 10; return last === 1 ? "участник" : last >= 2 && last <= 4 ? "участника" : "участников"; }
async function getOrigin() { const headersList = await headers(); const host = headersList.get("host") ?? "localhost:3000"; const protocol = host.includes("localhost") ? "http" : "https"; return `${protocol}://${host}`; }
