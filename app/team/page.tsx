import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { AlertTriangle, Copy, Users } from "lucide-react";
import { createTeamAction, createTeamInviteAction, leaveTeamAction } from "@/app/actions";
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
    return <ErrorState message={result.error ?? "Неизвестная ошибка"} />;
  }

  const {
    user,
    teams,
    selectedTeam,
    members,
    profiles,
    invites,
    year,
    month,
    months,
    tasks,
    plans,
    facts
  } = result.data;

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
  const isOwner = selectedTeam?.owner_id === user.id;
  const canInvite = isOwner || ownMembership?.role === "owner" || ownMembership?.role === "admin";
  const inviteLink = params.invite ? `${await getOrigin()}/team/invite/${params.invite}` : null;

  if (!selectedTeam) {
    return (
      <div className="app-page app-page-with-rail team-page">
        <div className="workspace-header">
          <div>
            <div className="page-kicker">Совместный ритм</div>
            <h1 className="workspace-title mt-1">Команда</h1>
            <p className="workspace-subtitle">
            Создайте команду, пригласите друзей и смотрите общий прогресс без доступа к чужому редактированию.
            </p>
          </div>
        </div>
        <CreateTeamCard />
      </div>
    );
  }

  return (
    <div className="app-page app-page-with-rail team-page">
      <div className="workspace-header">
        <div>
          <div className="page-kicker">Совместный ритм</div>
          <h1 className="workspace-title mt-1">Команда</h1>
          <p className="workspace-subtitle">
            {selectedTeam.name} · {getMonthTitle(year, month)}
          </p>
        </div>
        <form className="grid w-full gap-2 sm:grid-cols-[minmax(0,1fr)_100px_100px_auto] lg:w-auto lg:grid-cols-[220px_110px_110px_auto]" action="/team">
          <div className="space-y-1">
            <Label>Команда</Label>
            <Select name="team" defaultValue={selectedTeam.id}>
              {teams.map((team) => (
                <option key={team.id} value={team.id}>
                  {team.name}
                </option>
              ))}
            </Select>
          </div>
          <div className="space-y-1">
            <Label>Год</Label>
            <Input name="year" type="number" min={2020} max={2100} defaultValue={year} />
          </div>
          <div className="space-y-1">
            <Label>Месяц</Label>
            <Input name="month" type="number" min={1} max={12} defaultValue={month} />
          </div>
          <Button type="submit" className="self-end">Открыть</Button>
        </form>
      </div>

      {inviteLink ? (
        <div className="signal-panel flex flex-col gap-3 border-primary/25 bg-primary/[0.055] lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="font-semibold">Ссылка приглашения создана</div>
              <p className="text-sm text-muted-foreground">
                Скопируйте ее и отправьте другу. Открывать ссылку со своего аккаунта не нужно.
              </p>
              <p className="break-all text-sm text-muted-foreground">{inviteLink}</p>
            </div>
            <CopyInviteLink inviteLink={inviteLink} />
        </div>
      ) : null}

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-[1.15fr_1fr_.85fr_.85fr]">
        <KpiCard title="Командное выполнение" value={formatPercent(stats.completion)} detail={`${formatScore(stats.factScore)} / ${formatScore(stats.planScore)} баллов`} />
        <KpiCard title="Прогноз" value={formatPercent(stats.forecastPercent)} detail="если сохранять текущий темп" />
        <KpiCard title="Нужно в день" value={formatScore(stats.requiredPerDay)} detail="суммарно по команде" />
        <KpiCard title="Участники с планом" value={`${stats.membersWithPlan} / ${stats.activeMembers}`} detail="за выбранный месяц" />
      </div>

      {stats.focusMember ? (
        <Card className="focus-panel">
          <CardContent className="flex gap-3 p-4">
            <AlertTriangle className="mt-1 h-5 w-5 shrink-0 text-warning" />
            <div>
              <div className="font-semibold">Главный командный фокус</div>
              <p className="text-sm text-muted-foreground">
                Сейчас больше всего нужно подтянуть участника: {stats.focusMember.name}, {formatScore(stats.focusMember.requiredPerDay)} балла/день.
              </p>
            </div>
          </CardContent>
        </Card>
      ) : null}

      <div className="grid gap-3 xl:grid-cols-[1.2fr_0.8fr]">
        <Card className="section-panel">
          <CardHeader>
            <CardTitle>Участники</CardTitle>
            <CardDescription>Личные планы остаются личными, команда видит общий прогресс и вклад</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {stats.memberStats.map((member) => (
              <div key={member.userId} className="list-row">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <div className="font-semibold">{member.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {member.month ? member.month.title : "Нет месяца за выбранный период"}
                    </div>
                  </div>
                  <Badge variant={member.completion >= 0.8 ? "success" : member.completion >= 0.6 ? "warning" : "destructive"}>
                    {formatPercent(member.completion)}
                  </Badge>
                </div>
                <Progress className="mt-3" value={member.completion * 100} />
                <div className="mt-2 grid gap-2 text-sm text-muted-foreground sm:grid-cols-3">
                  <span>Факт: {formatScore(member.factScore)}</span>
                  <span>План: {formatScore(member.planScore)}</span>
                  <span>Нужно/день: {formatScore(member.requiredPerDay)}</span>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className="section-panel">
          <CardHeader>
            <CardTitle>Командные риски</CardTitle>
            <CardDescription>Задачи с самым большим отставанием</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {stats.riskTasks.length ? (
              stats.riskTasks.map((task) => (
                <div key={`${task.userId}-${task.title}`} className="list-row">
                  <div className="text-sm font-semibold">{task.title}</div>
                  <div className="mt-1 text-xs text-muted-foreground">{task.memberName}</div>
                  <div className="mt-2 flex items-center justify-between text-sm">
                    <span>{formatPercent(task.completion)}</span>
                    <span>{formatScore(task.requiredPerDay)} в день</span>
                  </div>
                </div>
              ))
            ) : (
              <p className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
                Пока нет задач с риском или у участников нет планов за выбранный месяц.
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-3 lg:grid-cols-[1fr_1fr]">
        <CreateTeamCard />

        <Card className="section-panel">
          <CardHeader>
            <CardTitle>Приглашения</CardTitle>
            <CardDescription>Отправьте ссылку другу, он войдет и присоединится к команде</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {canInvite ? (
              <form action={createTeamInviteAction} className="grid gap-3">
                <input type="hidden" name="teamId" value={selectedTeam.id} />
                <div className="space-y-2">
                  <Label htmlFor="invite-email">Email, необязательно</Label>
                  <Input id="invite-email" name="email" type="email" placeholder="friend@example.com" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="invite-role">Роль</Label>
                  <Select id="invite-role" name="role" defaultValue="member">
                    <option value="member">Участник</option>
                    <option value="admin">Администратор</option>
                  </Select>
                </div>
                <Button type="submit">
                  <Copy className="h-4 w-4" />
                  Создать ссылку
                </Button>
              </form>
            ) : (
              <p className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
                Приглашения создают владелец или администратор команды.
              </p>
            )}

            {invites.length ? (
              <div className="space-y-2">
                {invites.slice(0, 5).map((invite) => (
                  <div key={invite.id} className="list-row text-sm">
                    <div className="font-medium">{invite.email || "Ссылка без email"}</div>
                    <div className="text-xs text-muted-foreground">
                      Роль: {invite.role === "admin" ? "администратор" : "участник"} · до {new Date(invite.expires_at).toLocaleDateString("ru-RU")}
                    </div>
                  </div>
                ))}
              </div>
            ) : null}

            {!isOwner && ownMembership?.role !== "owner" ? (
              <form action={leaveTeamAction}>
                <input type="hidden" name="teamId" value={selectedTeam.id} />
                <ConfirmSubmitButton
                  type="submit"
                  variant="destructive"
                  message="Выйти из команды? Ваши личные данные останутся у вас."
                >
                  Выйти из команды
                </ConfirmSubmitButton>
              </form>
            ) : null}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function CreateTeamCard() {
  return (
    <Card className="section-panel">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Users className="h-5 w-5" />
          Новая команда
        </CardTitle>
        <CardDescription>Например, семья, друзья, рабочая группа или спортивный челлендж</CardDescription>
      </CardHeader>
      <CardContent>
        <form action={createTeamAction} className="grid gap-3">
          <div className="space-y-2">
            <Label htmlFor="team-name">Название</Label>
            <Input id="team-name" name="name" placeholder="Например, Команда роста" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="team-description">Описание</Label>
            <Textarea id="team-description" name="description" placeholder="Для чего собираемся и какой ритм держим" />
          </div>
          <Button type="submit">Создать команду</Button>
        </form>
      </CardContent>
    </Card>
  );
}

function KpiCard({ title, value, detail }: { title: string; value: string; detail: string }) {
  return (
    <Card className="metric-card">
      <CardContent className="relative p-0">
        <div className="text-sm font-medium text-muted-foreground">{title}</div>
        <div className="mt-3 text-3xl font-semibold tracking-tight md:text-4xl">{value}</div>
        <div className="mt-2 text-sm leading-5 text-muted-foreground">{detail}</div>
      </CardContent>
    </Card>
  );
}

async function getOrigin() {
  const headersList = await headers();
  const host = headersList.get("host") ?? "localhost:3000";
  const protocol = host.includes("localhost") ? "http" : "https";
  return `${protocol}://${host}`;
}
