import Link from "next/link";
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
import { getMonthDates, getMonthTitle, getTodayKey, toDateKey } from "@/lib/dates/month";
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

type TeamActivityFeedItem = {
  id: string;
  name: string;
  title: string;
  value: number;
  unit: string;
  date: string;
  note: string | null;
};

type MemberRhythm = {
  currentStreak: number;
  bestStreak: number;
  rhythmDays: number;
  plannedDaysToDate: number;
  hasComeback: boolean;
};

type MemberRole = {
  title: string;
  detail: string;
};

type TeamSeasonSnapshot = {
  label: string;
  progressPercent: number;
  elapsedDays: number;
  totalDays: number;
  bestWeekday: string | null;
  weakWeekday: string | null;
  zeroFactDays: number;
  completedInitiatives: number;
  closestChallenge: InitiativeProgress | null;
  growingMembers: string[];
  weeklyRisk: string;
  bestMoment: string;
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
  const closestWin = getClosestTeamWin(goals, challenges);
  const memberRhythms = new Map(snapshots.map((snapshot) => [snapshot.userId, getMemberRhythm(snapshot, year, month)]));
  const memberRoles = new Map(
    stats.memberStats.map((member) => [
      member.userId,
      getMemberRole({
        member,
        rhythm: memberRhythms.get(member.userId),
        goalValue: sumByUser(teamGoalContributions, member.userId),
        challengeValue: sumByUser(teamChallengeCheckins, member.userId)
      })
    ])
  );
  const season = getTeamSeasonSnapshot({
    stats,
    snapshots,
    year,
    month,
    goals,
    challenges,
    memberRhythms
  });
  const teamBadges = getTeamBadges({
    forecastPercent: stats.forecastPercent,
    activeMembers: stats.activeMembers,
    membersWithPlan: stats.membersWithPlan,
    goals,
    challenges,
    memberRhythms: [...memberRhythms.values()],
    season
  });
  const feed = getTeamActivityFeed({
    goals: teamGoals,
    challenges: teamChallenges,
    goalContributions: teamGoalContributions,
    challengeCheckins: teamChallengeCheckins,
    profileMap
  });

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
        <div className="flex w-full flex-col gap-2 lg:w-auto lg:items-end">
          <Button asChild variant="outline" size="sm">
            <Link href={`/team/board?team=${selectedTeam.id}`}>Доска задач</Link>
          </Button>
          <TeamPeriodSelector teams={teams} selectedTeamId={selectedTeam.id} year={year} month={month} />
        </div>
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

      <section className="grid gap-4 xl:grid-cols-[0.9fr_1.1fr]" aria-label="Командный сезон">
        <Card className="section-panel">
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Trophy className="h-5 w-5 text-signal" /> Сезон месяца</CardTitle>
            <CardDescription>{season.label}: общий ритм, завершенные инициативы и ближайшая командная планка.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <div className="flex items-center justify-between gap-3 text-sm">
                <span className="text-muted-foreground">Пройдено дней</span>
                <span className="font-medium">{season.elapsedDays} / {season.totalDays}</span>
              </div>
              <Progress className="mt-2" value={season.progressPercent * 100} />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <Metric label="Закрыто инициатив" value={String(season.completedInitiatives)} />
              <Metric label="Дней без факта" value={String(season.zeroFactDays)} />
            </div>
            <div className="rounded-md border border-border/75 bg-card/70 p-3">
              <div className="text-sm font-medium">Лучший момент</div>
              <p className="mt-1 text-sm text-muted-foreground">{season.bestMoment}</p>
            </div>
            {season.closestChallenge ? (
              <div className="rounded-md border border-over/35 bg-over/10 p-3">
                <div className="text-sm font-medium">Ближайший челлендж</div>
                <p className="mt-1 text-sm text-muted-foreground">
                  {season.closestChallenge.title}: осталось {formatScore(Math.max(0, season.closestChallenge.target - season.closestChallenge.value))} {season.closestChallenge.unit}.
                </p>
              </div>
            ) : null}
          </CardContent>
        </Card>

        <Card className="section-panel">
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Activity className="h-5 w-5 text-primary" /> Командная аналитика</CardTitle>
            <CardDescription>Сигналы по дням недели, росту темпа и ближайшему риску.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-md border border-border/75 bg-card/70 p-3">
              <div className="text-xs text-muted-foreground">Лучший день недели</div>
              <div className="mt-1 font-semibold">{season.bestWeekday ?? "Недостаточно данных"}</div>
            </div>
            <div className="rounded-md border border-border/75 bg-card/70 p-3">
              <div className="text-xs text-muted-foreground">Слабый день недели</div>
              <div className="mt-1 font-semibold">{season.weakWeekday ?? "Недостаточно данных"}</div>
            </div>
            <div className="rounded-md border border-border/75 bg-card/70 p-3 sm:col-span-2">
              <div className="text-xs text-muted-foreground">Кто набирает темп</div>
              <div className="mt-1 font-semibold">
                {season.growingMembers.length ? season.growingMembers.join(", ") : "Пока нет устойчивого роста"}
              </div>
            </div>
            <div className="rounded-md border border-warning/35 bg-warning/10 p-3 sm:col-span-2">
              <div className="text-xs text-muted-foreground">Риск недели</div>
              <div className="mt-1 font-semibold">{season.weeklyRisk}</div>
            </div>
          </CardContent>
        </Card>
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

      <section className="grid gap-4 xl:grid-cols-[1.05fr_0.95fr]" aria-label="Командная мотивация">
        <Card className="section-panel">
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Trophy className="h-5 w-5 text-signal" /> До следующей победы</CardTitle>
            <CardDescription>Ближайшая общая планка, которую можно закрыть без смешивания с личными планами.</CardDescription>
          </CardHeader>
          <CardContent>
            {closestWin ? (
              <div className="space-y-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="text-lg font-semibold">{closestWin.title}</div>
                    <div className="mt-1 text-sm text-muted-foreground">
                      Осталось {formatScore(closestWin.remaining)} {closestWin.unit}
                    </div>
                  </div>
                  <Badge variant={closestWin.kind === "challenge" ? "over" : "info"}>
                    {closestWin.kind === "challenge" ? "Челлендж" : "Цель"}
                  </Badge>
                </div>
                <Progress value={Math.min(closestWin.percent, 1) * 100} />
                <div className="text-sm text-muted-foreground">
                  Уже сделано {formatScore(closestWin.value)} из {formatScore(closestWin.target)} {closestWin.unit}.
                </div>
              </div>
            ) : (
              <div className="rounded-md border border-dashed p-5 text-sm text-muted-foreground">
                Нет активной командной планки. Создайте челлендж на неделю или общую цель месяца.
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="section-panel">
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Sparkles className="h-5 w-5 text-primary" /> Бейджи команды</CardTitle>
            <CardDescription>Легкие статусы по текущему месяцу. Без штрафов и рейтинга людей.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-2 sm:grid-cols-2">
            {teamBadges.map((badge) => (
              <div key={badge.title} className="rounded-md border border-border/75 bg-card/70 p-3">
                <div className="font-medium">{badge.title}</div>
                <p className="mt-1 text-xs text-muted-foreground">{badge.detail}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      </section>

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
            {stats.memberStats.map((member) => {
              const rhythm = memberRhythms.get(member.userId);
              const role = memberRoles.get(member.userId) ?? { title: "Собирает ритм", detail: "Данных пока мало, роль уточнится по факту месяца." };

              return (
              <article key={member.userId} className="list-row">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <div className="font-semibold">{member.name}</div>
                    <div className="mt-1 text-xs text-muted-foreground">
                      {member.month ? member.month.title : "Нет личного месяца на этот период"}
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Badge variant="info">{role.title}</Badge>
                    <Badge variant={member.forecastPercent >= 0.8 ? "success" : member.forecastPercent >= 0.6 ? "warning" : "destructive"}>
                      Прогноз {formatPercent(member.forecastPercent)}
                    </Badge>
                  </div>
                </div>
                <p className="mt-3 text-sm text-muted-foreground">{role.detail}</p>
                <Progress className="mt-3" value={Math.min(member.forecastPercent, 1.2) * 100} />
                <div className="mt-3 grid gap-2 text-sm text-muted-foreground sm:grid-cols-3">
                  <span>Факт: {formatScore(member.factScore)}</span>
                  <span>План: {formatScore(member.planScore)}</span>
                  <span>Нужно/день: {formatScore(member.requiredPerDay)}</span>
                </div>
                <div className="mt-3 grid gap-2 rounded-md border border-border/75 bg-card/60 p-3 text-xs text-muted-foreground sm:grid-cols-4">
                  <span>Серия: {rhythm?.currentStreak ?? 0} дн.</span>
                  <span>Лучшая: {rhythm?.bestStreak ?? 0} дн.</span>
                  <span>В ритме: {rhythm?.rhythmDays ?? 0} / {rhythm?.plannedDaysToDate ?? 0}</span>
                  <span>{rhythm?.hasComeback ? "Вернулся после пропуска" : "Без камбэка"}</span>
                </div>
              </article>
            );
            })}
          </CardContent>
        </Card>

        <div className="space-y-4">
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

          <Card className="section-panel">
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Activity className="h-5 w-5 text-primary" /> Лента активности</CardTitle>
              <CardDescription>Последние вклады в общие цели и челленджи.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {feed.length ? feed.map((item) => (
                <article key={item.id} className="rounded-md border border-border/75 bg-card/70 p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-sm font-medium">{item.name}</div>
                      <div className="mt-1 text-xs text-muted-foreground">{item.title}</div>
                    </div>
                    <Badge variant="outline">{formatScore(item.value)} {item.unit}</Badge>
                  </div>
                  {item.note ? <p className="mt-2 text-xs text-muted-foreground">{item.note}</p> : null}
                  <div className="mt-2 text-[11px] text-muted-foreground">{formatDate(item.date)}</div>
                </article>
              )) : (
                <div className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
                  Вкладов пока нет. Добавьте первый вклад в цель или челлендж.
                </div>
              )}
            </CardContent>
          </Card>
        </div>
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

function getClosestTeamWin(goals: InitiativeProgress[], challenges: InitiativeProgress[]) {
  return [
    ...goals.map((item) => ({ ...item, kind: "goal" as const })),
    ...challenges.map((item) => ({ ...item, kind: "challenge" as const }))
  ]
    .filter((item) => item.status === "active" && item.target > 0 && item.value < item.target)
    .map((item) => ({ ...item, remaining: Math.max(0, item.target - item.value) }))
    .sort((a, b) => a.remaining - b.remaining || b.percent - a.percent)[0] ?? null;
}

function getMemberRhythm(snapshot: TeamMemberSnapshot, year: number, month: number): MemberRhythm {
  const monthDates = getMonthDates(year, month).map(toDateKey);
  const todayKey = getTodayKey();
  const lastVisibleDate = monthDates.includes(todayKey)
    ? todayKey
    : todayKey < monthDates[0]
      ? monthDates[0]
      : monthDates.at(-1) ?? todayKey;
  const factsByDate = new Map<string, number>();
  const plansByDate = new Map<string, number>();

  for (const plan of snapshot.plans) {
    if (plan.planned_score <= 0) continue;
    plansByDate.set(plan.date, (plansByDate.get(plan.date) ?? 0) + plan.planned_score);
  }

  for (const fact of snapshot.facts) {
    factsByDate.set(fact.date, (factsByDate.get(fact.date) ?? 0) + fact.actual_score);
  }

  const plannedDays = monthDates
    .filter((date) => date <= lastVisibleDate)
    .map((date) => ({
      date,
      planScore: plansByDate.get(date) ?? 0,
      factScore: factsByDate.get(date) ?? 0
    }))
    .filter((day) => day.planScore > 0);

  let currentStreak = 0;
  for (const day of [...plannedDays].reverse()) {
    if (day.factScore > 0) {
      currentStreak += 1;
      continue;
    }
    break;
  }

  let bestStreak = 0;
  let running = 0;
  for (const day of plannedDays) {
    if (day.factScore > 0) {
      running += 1;
      bestStreak = Math.max(bestStreak, running);
    } else {
      running = 0;
    }
  }

  const rhythmDays = plannedDays.filter((day) => day.factScore >= day.planScore * 0.8).length;
  const lastFactIndex = plannedDays.map((day) => day.factScore > 0).lastIndexOf(true);
  const hasComeback =
    lastFactIndex > 0 &&
    plannedDays[lastFactIndex].factScore > 0 &&
    plannedDays.slice(0, lastFactIndex).some((day) => day.factScore === 0);

  return {
    currentStreak,
    bestStreak,
    rhythmDays,
    plannedDaysToDate: plannedDays.length,
    hasComeback
  };
}

function getMemberRole({
  member,
  rhythm,
  goalValue,
  challengeValue
}: {
  member: { forecastPercent: number; factScore: number; planScore: number; riskTasks: unknown[] };
  rhythm?: MemberRhythm;
  goalValue: number;
  challengeValue: number;
}): MemberRole {
  if (challengeValue > 0 && challengeValue >= goalValue) {
    return {
      title: "Поддержка",
      detail: "Активно добавляет вклад в общие челленджи и помогает команде держать общий режим."
    };
  }

  if (rhythm?.hasComeback) {
    return {
      title: "Возвращающийся",
      detail: "Был пропуск, но участник снова вернулся в факт. Это важный командный сигнал."
    };
  }

  if (member.planScore > 0 && member.forecastPercent >= 1.05) {
    return {
      title: "Спринтер",
      detail: "Темп выше плана: участник дает сильный вклад в общий прогноз месяца."
    };
  }

  if (member.planScore > 0 && member.riskTasks.length === 0) {
    return {
      title: "Фокусник",
      detail: "Главные задачи не провисают по прогнозу. Можно брать пример с структуры фокуса."
    };
  }

  if ((rhythm?.currentStreak ?? 0) >= 3 || (rhythm?.rhythmDays ?? 0) >= 5) {
    return {
      title: "Стабилизатор",
      detail: "Регулярно закрывает факт и поддерживает спокойный командный ритм."
    };
  }

  return {
    title: "Собирает ритм",
    detail: "Данных пока мало. Роль уточнится, когда накопится несколько плановых дней."
  };
}

function getTeamSeasonSnapshot({
  stats,
  snapshots,
  year,
  month,
  goals,
  challenges,
  memberRhythms
}: {
  stats: ReturnType<typeof calculateTeamStats>;
  snapshots: TeamMemberSnapshot[];
  year: number;
  month: number;
  goals: InitiativeProgress[];
  challenges: InitiativeProgress[];
  memberRhythms: Map<string, MemberRhythm>;
}): TeamSeasonSnapshot {
  const dates = getMonthDates(year, month).map(toDateKey);
  const todayKey = getTodayKey();
  const elapsedDays = todayKey < dates[0]
    ? 0
    : todayKey > (dates.at(-1) ?? todayKey)
      ? dates.length
      : dates.findIndex((date) => date === todayKey) + 1;
  const weekdaySignals = getTeamWeekdaySignals(snapshots);
  const bestWeekday = weekdaySignals.at(-1)?.label ?? null;
  const weakWeekday = weekdaySignals[0]?.label ?? null;
  const completedInitiatives = [...goals, ...challenges].filter((item) => item.percent >= 1).length;
  const closestChallenge =
    challenges
      .filter((item) => item.status === "active" && item.target > 0 && item.value < item.target)
      .sort((a, b) => (a.target - a.value) - (b.target - b.value))[0] ?? null;
  const growingMembers = stats.memberStats
    .filter((member) => member.planScore > 0 && member.forecastPercent >= Math.max(member.completion, 0.8))
    .sort((a, b) => b.forecastPercent - a.forecastPercent)
    .slice(0, 3)
    .map((member) => member.name);
  const zeroFactDays = countTeamZeroFactDays(snapshots);
  const bestRhythm = [...memberRhythms.entries()].sort((a, b) => b[1].bestStreak - a[1].bestStreak)[0] ?? null;
  const bestRhythmMember = bestRhythm
    ? stats.memberStats.find((member) => member.userId === bestRhythm[0])?.name ?? "участника"
    : null;

  return {
    label: getMonthTitle(year, month),
    progressPercent: dates.length ? Math.min(1, elapsedDays / dates.length) : 0,
    elapsedDays,
    totalDays: dates.length,
    bestWeekday,
    weakWeekday,
    zeroFactDays,
    completedInitiatives,
    closestChallenge,
    growingMembers,
    weeklyRisk: stats.focusMember
      ? `${stats.focusMember.name}: нужно ${formatScore(stats.focusMember.requiredPerDay)} балла в день`
      : "Нет участника с критичным прогнозом недели",
    bestMoment: completedInitiatives > 0
      ? `${completedInitiatives} инициатив уже закрыты`
      : bestRhythmMember
        ? `Лучшая серия у ${bestRhythmMember}: ${bestRhythm?.[1].bestStreak ?? 0} дней`
        : "Лучший момент появится после первых вкладов"
  };
}

function getTeamWeekdaySignals(snapshots: TeamMemberSnapshot[]) {
  const labels = ["воскресенье", "понедельник", "вторник", "среда", "четверг", "пятница", "суббота"];
  const stats = new Map<number, { plan: number; fact: number }>();
  const todayKey = getTodayKey();

  for (const snapshot of snapshots) {
    const factsByDate = new Map<string, number>();
    for (const fact of snapshot.facts) {
      factsByDate.set(fact.date, (factsByDate.get(fact.date) ?? 0) + fact.actual_score);
    }

    for (const plan of snapshot.plans) {
      if (plan.planned_score <= 0 || plan.date > todayKey) continue;
      const dayIndex = new Date(`${plan.date}T00:00:00Z`).getUTCDay();
      const item = stats.get(dayIndex) ?? { plan: 0, fact: 0 };
      item.plan += plan.planned_score;
      item.fact += factsByDate.get(plan.date) ?? 0;
      stats.set(dayIndex, item);
    }
  }

  return [...stats.entries()]
    .filter(([, value]) => value.plan > 0)
    .map(([dayIndex, value]) => ({
      label: labels[dayIndex],
      completion: value.fact / value.plan
    }))
    .sort((a, b) => a.completion - b.completion);
}

function countTeamZeroFactDays(snapshots: TeamMemberSnapshot[]) {
  const byDate = new Map<string, { plan: number; fact: number }>();
  const todayKey = getTodayKey();

  for (const snapshot of snapshots) {
    for (const plan of snapshot.plans) {
      if (plan.planned_score <= 0 || plan.date > todayKey) continue;
      const item = byDate.get(plan.date) ?? { plan: 0, fact: 0 };
      item.plan += plan.planned_score;
      byDate.set(plan.date, item);
    }
    for (const fact of snapshot.facts) {
      const item = byDate.get(fact.date);
      if (!item) continue;
      item.fact += fact.actual_score;
    }
  }

  return [...byDate.values()].filter((item) => item.plan > 0 && item.fact === 0).length;
}

function getTeamBadges({
  forecastPercent,
  activeMembers,
  membersWithPlan,
  goals,
  challenges,
  memberRhythms,
  season
}: {
  forecastPercent: number;
  activeMembers: number;
  membersWithPlan: number;
  goals: InitiativeProgress[];
  challenges: InitiativeProgress[];
  memberRhythms: MemberRhythm[];
  season: TeamSeasonSnapshot;
}) {
  const completed = [...goals, ...challenges].filter((item) => item.percent >= 1).length;
  const hasContribution = [...goals, ...challenges].some((item) => item.value > 0);
  const maxStreak = Math.max(0, ...memberRhythms.map((rhythm) => rhythm.currentStreak));
  const hasComeback = memberRhythms.some((rhythm) => rhythm.hasComeback);

  return [
    forecastPercent >= 1
      ? { title: "Командный рывок", detail: "Общий прогноз выше 100%: сезон идет быстрее плана." }
      : { title: "Командный рывок", detail: "В пути: для рывка нужен прогноз выше 100%." },
    maxStreak >= 7
      ? { title: "Стабильная неделя", detail: `Есть серия ${maxStreak} дней с фактом.` }
      : { title: "Стабильная неделя", detail: "В пути: нужна серия 7 дней с фактом." },
    completed
      ? { title: "Финишировали вместе", detail: `${completed} общих инициатив уже закрыты.` }
      : { title: "Финишировали вместе", detail: "В пути: закройте первую общую инициативу." },
    season.zeroFactDays === 0 && statsReady(activeMembers, membersWithPlan)
      ? { title: "Без нулевых дней", detail: "В выбранном периоде нет командных дней с нулевым фактом." }
      : { title: "Без нулевых дней", detail: `Нулевых дней: ${season.zeroFactDays}.` },
    hasComeback
      ? { title: "Возвращение в ритм", detail: "Кто-то восстановил факт после пропуска." }
      : { title: "Возвращение в ритм", detail: "Появится, когда участник вернется после пропуска." },
    hasContribution
      ? { title: "Первый вклад", detail: "В командные инициативы уже добавлен вклад." }
      : { title: "Первый вклад", detail: "Добавьте первый вклад в цель или челлендж." },
    challenges.length
      ? { title: "Первый челлендж", detail: "Команда уже запустила челлендж." }
      : { title: "Первый челлендж", detail: "Создайте короткий челлендж на неделю." },
    activeMembers > 0 && membersWithPlan === activeMembers
      ? { title: "Все подключились", detail: "У каждого участника есть личный месяц на этот период." }
      : { title: "Все подключились", detail: "Часть участников пока без плана на этот месяц." }
  ];
}

function getTeamActivityFeed({
  goals,
  challenges,
  goalContributions,
  challengeCheckins,
  profileMap
}: {
  goals: Array<{ id: string; title: string; unit: string }>;
  challenges: Array<{ id: string; title: string; unit: string }>;
  goalContributions: Array<{ id: string; goal_id: string; user_id: string; value: number; note: string | null; date: string; created_at: string }>;
  challengeCheckins: Array<{ id: string; challenge_id: string; user_id: string; value: number; note: string | null; date: string; created_at: string }>;
  profileMap: Map<string, { name?: string | null; email?: string | null }>;
}): TeamActivityFeedItem[] {
  const goalById = new Map(goals.map((goal) => [goal.id, goal]));
  const challengeById = new Map(challenges.map((challenge) => [challenge.id, challenge]));
  const nameOf = (userId: string) => profileMap.get(userId)?.name || profileMap.get(userId)?.email || "Участник";

  return [
    ...goalContributions.map((item) => {
      const goal = goalById.get(item.goal_id);
      return {
        id: `goal-${item.id}`,
        name: nameOf(item.user_id),
        title: goal ? `Цель: ${goal.title}` : "Командная цель",
        value: item.value,
        unit: goal?.unit ?? "ед.",
        date: item.date,
        note: item.note
      };
    }),
    ...challengeCheckins.map((item) => {
      const challenge = challengeById.get(item.challenge_id);
      return {
        id: `challenge-${item.id}`,
        name: nameOf(item.user_id),
        title: challenge ? `Челлендж: ${challenge.title}` : "Командный челлендж",
        value: item.value,
        unit: challenge?.unit ?? "ед.",
        date: item.date,
        note: item.note
      };
    })
  ]
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 6);
}

function sumByUser(items: { user_id: string; value: number }[], userId: string) { return items.filter((item) => item.user_id === userId).reduce((sum, item) => sum + item.value, 0); }
function statsReady(activeMembers: number, membersWithPlan: number) { return activeMembers > 0 && membersWithPlan > 0; }
function formatDate(value: string) { return new Intl.DateTimeFormat("ru-RU", { timeZone: "UTC", day: "numeric", month: "short" }).format(new Date(`${value.slice(0, 10)}T00:00:00Z`)); }
function pluralizeMembers(value: number) { const remainder = value % 100; if (remainder >= 11 && remainder <= 14) return "участников"; const last = value % 10; return last === 1 ? "участник" : last >= 2 && last <= 4 ? "участника" : "участников"; }
async function getOrigin() { const headersList = await headers(); const host = headersList.get("host") ?? "localhost:3000"; const protocol = host.includes("localhost") ? "http" : "https"; return `${protocol}://${host}`; }
