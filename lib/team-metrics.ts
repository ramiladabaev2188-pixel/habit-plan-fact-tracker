import { calculateMonthStats, calculateTaskStats } from "@/lib/metrics";
import type { DailyFact, DailyPlan, Month, Profile, Task } from "@/types/domain";

export type TeamMemberSnapshot = {
  userId: string;
  profile: Profile | null;
  month: Month | null;
  tasks: Task[];
  plans: DailyPlan[];
  facts: DailyFact[];
};

export type TeamMemberStats = {
  userId: string;
  name: string;
  month: Month | null;
  planScore: number;
  factScore: number;
  completion: number;
  forecastPercent: number;
  requiredPerDay: number;
  plannedDays: number;
  riskTasks: Array<{
    title: string;
    completion: number;
    gapScore: number;
    requiredPerDay: number;
  }>;
};

export type TeamStats = {
  planScore: number;
  factScore: number;
  completion: number;
  forecastPercent: number;
  requiredPerDay: number;
  activeMembers: number;
  membersWithPlan: number;
  memberStats: TeamMemberStats[];
  focusMember: TeamMemberStats | null;
  riskTasks: Array<{
    userId: string;
    memberName: string;
    title: string;
    completion: number;
    gapScore: number;
    requiredPerDay: number;
  }>;
};

export function calculateTeamStats(snapshots: TeamMemberSnapshot[], today?: string): TeamStats {
  const memberStats = snapshots.map((snapshot) => {
    const stats = calculateMonthStats(snapshot.plans, snapshot.facts, snapshot.tasks, today);
    const taskStats = calculateTaskStats(snapshot.plans, snapshot.facts, snapshot.tasks, today)
      .filter((task) => task.planScore > 0)
      .sort((a, b) => b.gapScore - a.gapScore)
      .slice(0, 3)
      .map((task) => ({
        title: task.title,
        completion: task.completion,
        gapScore: task.gapScore,
        requiredPerDay: task.requiredPerDay
      }));

    return {
      userId: snapshot.userId,
      name: snapshot.profile?.name || snapshot.profile?.email || "Участник",
      month: snapshot.month,
      planScore: stats.totalPlanScore,
      factScore: stats.currentFactScore,
      completion: stats.monthCompletion,
      forecastPercent: stats.forecastPercent,
      requiredPerDay: stats.requiredPerDay,
      plannedDays: stats.totalPlannedDays,
      riskTasks: taskStats
    };
  });

  const planScore = sum(memberStats.map((member) => member.planScore));
  const factScore = sum(memberStats.map((member) => member.factScore));
  const forecastScore = sum(memberStats.map((member) => member.forecastPercent * member.planScore));
  const requiredPerDay = sum(memberStats.map((member) => member.requiredPerDay));
  const riskTasks = memberStats
    .flatMap((member) =>
      member.riskTasks.map((task) => ({
        ...task,
        userId: member.userId,
        memberName: member.name
      }))
    )
    .sort((a, b) => b.gapScore - a.gapScore)
    .slice(0, 8);

  const focusMember =
    [...memberStats]
      .filter((member) => member.planScore > 0)
      .sort((a, b) => b.requiredPerDay - a.requiredPerDay)[0] ?? null;

  return {
    planScore,
    factScore,
    completion: planScore > 0 ? factScore / planScore : 0,
    forecastPercent: planScore > 0 ? forecastScore / planScore : 0,
    requiredPerDay,
    activeMembers: memberStats.length,
    membersWithPlan: memberStats.filter((member) => member.planScore > 0).length,
    memberStats,
    focusMember,
    riskTasks
  };
}

function sum(values: number[]) {
  return values.reduce((total, value) => total + (Number.isFinite(value) ? value : 0), 0);
}
