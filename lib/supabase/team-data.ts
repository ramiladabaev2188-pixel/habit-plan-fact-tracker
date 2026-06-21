import type { User } from "@supabase/supabase-js";
import { unstable_noStore as noStore } from "next/cache";
import type {
  DailyFact,
  DailyPlan,
  Month,
  Task,
  Team,
  TeamBoard,
  TeamBoardColumn,
  TeamBoardComment,
  TeamBoardTask,
  TeamChallenge,
  TeamChallengeCheckin,
  TeamGoal,
  TeamGoalContribution,
  TeamInvite,
  TeamMember
} from "@/types/domain";
import { isSupabaseConfigured } from "./env";
import { createClient } from "./server";
import {
  normalizeDailyFact,
  normalizeDailyPlan,
  normalizeMonth,
  normalizeTask
} from "./data";

export type TeamMemberProfile = {
  id: string;
  name: string;
  email?: string | null;
  timezone?: string | null;
  created_at?: string;
};

export type TeamDashboardData = {
  user: User;
  teams: Team[];
  selectedTeam: Team | null;
  members: TeamMember[];
  profiles: TeamMemberProfile[];
  shareTaskDetails: boolean;
  invites: TeamInvite[];
  year: number;
  month: number;
  months: Month[];
  tasks: Task[];
  plans: DailyPlan[];
  facts: DailyFact[];
  teamGoals: TeamGoal[];
  teamGoalContributions: TeamGoalContribution[];
  teamChallenges: TeamChallenge[];
  teamChallengeCheckins: TeamChallengeCheckin[];
};

export type TeamDashboardResult =
  | {
      configured: false;
      user: null;
      data: null;
      error: null;
    }
  | {
      configured: true;
      user: User | null;
      data: TeamDashboardData | null;
      error: string | null;
    };

export type TeamBoardData = {
  user: User;
  teams: Team[];
  selectedTeam: Team | null;
  members: TeamMember[];
  profiles: TeamMemberProfile[];
  boards: TeamBoard[];
  selectedBoard: TeamBoard | null;
  columns: TeamBoardColumn[];
  tasks: TeamBoardTask[];
  comments: TeamBoardComment[];
};

export type TeamBoardResult =
  | { configured: false; user: null; data: null; error: null }
  | { configured: true; user: User | null; data: TeamBoardData | null; error: string | null };

export async function loadTeamDashboardData({
  teamId,
  year,
  month
}: {
  teamId?: string;
  year?: number;
  month?: number;
}): Promise<TeamDashboardResult> {
  noStore();

  if (!isSupabaseConfigured()) {
    return { configured: false, user: null, data: null, error: null };
  }

  const supabase = await createClient();
  const {
    data: { user },
    error: userError
  } = await supabase.auth.getUser();

  if (userError) {
    return { configured: true, user: null, data: null, error: userError.message };
  }

  if (!user) {
    return { configured: true, user: null, data: null, error: null };
  }

  await supabase.from("profiles").upsert({
    id: user.id,
    email: user.email ?? null,
    name: user.user_metadata?.name ?? user.email?.split("@")[0] ?? "Пользователь",
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone
  });

  const now = new Date();
  const selectedYear = year ?? now.getFullYear();
  const selectedMonthNumber = month ?? now.getMonth() + 1;

  const { data: ownMemberships, error: ownMembershipsError } = await supabase
    .from("team_members")
    .select("*")
    .eq("user_id", user.id)
    .eq("status", "active")
    .order("created_at", { ascending: false });

  if (ownMembershipsError) {
    return { configured: true, user, data: null, error: ownMembershipsError.message };
  }

  const teamIds = Array.from(new Set((ownMemberships ?? []).map((member) => member.team_id)));

  const teamsResult = teamIds.length
    ? await supabase.from("teams").select("*").in("id", teamIds).order("created_at", { ascending: false })
    : { data: [], error: null };

  if (teamsResult.error) {
    return { configured: true, user, data: null, error: teamsResult.error.message };
  }

  const teams = (teamsResult.data ?? []) as Team[];
  const selectedTeam = teams.find((team) => team.id === teamId) ?? teams[0] ?? null;

  if (!selectedTeam) {
    return {
      configured: true,
      user,
      data: {
        user,
        teams,
        selectedTeam: null,
        members: [],
        profiles: [],
        shareTaskDetails: true,
        invites: [],
        year: selectedYear,
        month: selectedMonthNumber,
        months: [],
        tasks: [],
        plans: [],
        facts: [],
        teamGoals: [],
        teamGoalContributions: [],
        teamChallenges: [],
        teamChallengeCheckins: []
      },
      error: null
    };
  }

  const [membersResult, invitesResult, preferenceResult, teamGoalsResult, teamChallengesResult] = await Promise.all([
    supabase
      .from("team_members")
      .select("*")
      .eq("team_id", selectedTeam.id)
      .eq("status", "active")
      .order("created_at"),
    supabase
      .from("team_invites")
      .select("*")
      .eq("team_id", selectedTeam.id)
      .is("accepted_at", null)
      .order("created_at", { ascending: false }),
    supabase
      .from("team_member_preferences")
      .select("share_task_details")
      .eq("team_id", selectedTeam.id)
      .eq("user_id", user.id)
      .maybeSingle()
    ,
    supabase
      .from("team_goals")
      .select("*")
      .eq("team_id", selectedTeam.id)
      .order("created_at", { ascending: false }),
    supabase
      .from("team_challenges")
      .select("*")
      .eq("team_id", selectedTeam.id)
      .order("created_at", { ascending: false })
  ]);

  const teamError =
    membersResult.error?.message ??
    invitesResult.error?.message ??
    preferenceResult.error?.message ??
    teamGoalsResult.error?.message ??
    teamChallengesResult.error?.message ??
    null;

  if (teamError) {
    return { configured: true, user, data: null, error: teamError };
  }

  const members = (membersResult.data ?? []) as TeamMember[];
  const userIds = Array.from(new Set(members.map((member) => member.user_id)));
  const teamGoals = (teamGoalsResult.data ?? []).map(normalizeTeamGoal);
  const teamChallenges = (teamChallengesResult.data ?? []).map(normalizeTeamChallenge);
  const teamGoalIds = teamGoals.map((goal) => goal.id);
  const teamChallengeIds = teamChallenges.map((challenge) => challenge.id);

  const [profilesResult, monthsResult, tasksResult] = userIds.length
    ? await Promise.all([
        supabase.rpc("get_team_member_profiles", { checked_team_id: selectedTeam.id }),
        supabase
          .from("months")
          .select("*")
          .in("user_id", userIds)
          .eq("year", selectedYear)
          .eq("month", selectedMonthNumber),
        supabase.from("tasks").select("*").in("user_id", userIds)
      ])
    : [
        { data: [], error: null },
        { data: [], error: null },
        { data: [], error: null }
      ];

  const baseError =
    profilesResult.error?.message ??
    monthsResult.error?.message ??
    tasksResult.error?.message ??
    null;

  if (baseError) {
    return { configured: true, user, data: null, error: baseError };
  }

  const months = (monthsResult.data ?? []).map(normalizeMonth);
  const monthIds = months.map((item) => item.id);

  const [plansResult, factsResult, goalContributionsResult, challengeCheckinsResult] = await Promise.all([
    monthIds.length
      ? supabase.from("daily_plans").select("*").in("month_id", monthIds)
      : Promise.resolve({ data: [], error: null }),
    monthIds.length
      ? supabase.from("daily_facts").select("*").in("month_id", monthIds)
      : Promise.resolve({ data: [], error: null }),
    teamGoalIds.length
      ? supabase.from("team_goal_contributions").select("*").in("goal_id", teamGoalIds).order("date", { ascending: false })
      : Promise.resolve({ data: [], error: null }),
    teamChallengeIds.length
      ? supabase.from("team_challenge_checkins").select("*").in("challenge_id", teamChallengeIds).order("date", { ascending: false })
      : Promise.resolve({ data: [], error: null })
  ]);

  const monthDataError =
    plansResult.error?.message ??
    factsResult.error?.message ??
    goalContributionsResult.error?.message ??
    challengeCheckinsResult.error?.message ??
    null;

  if (monthDataError) {
    return { configured: true, user, data: null, error: monthDataError };
  }

  return {
    configured: true,
    user,
    data: {
      user,
      teams,
      selectedTeam,
      members,
      profiles: (profilesResult.data ?? []) as TeamMemberProfile[],
      shareTaskDetails: preferenceResult.data?.share_task_details ?? true,
      invites: (invitesResult.data ?? []) as TeamInvite[],
      year: selectedYear,
      month: selectedMonthNumber,
      months,
      tasks: (tasksResult.data ?? []).map(normalizeTask),
      plans: (plansResult.data ?? []).map(normalizeDailyPlan),
      facts: (factsResult.data ?? []).map(normalizeDailyFact),
      teamGoals,
      teamGoalContributions: (goalContributionsResult.data ?? []).map(normalizeTeamGoalContribution),
      teamChallenges,
      teamChallengeCheckins: (challengeCheckinsResult.data ?? []).map(normalizeTeamChallengeCheckin)
    },
    error: null
  };
}

export async function loadTeamBoardData({
  teamId,
  boardId
}: {
  teamId?: string;
  boardId?: string;
}): Promise<TeamBoardResult> {
  noStore();

  if (!isSupabaseConfigured()) {
    return { configured: false, user: null, data: null, error: null };
  }

  const supabase = await createClient();
  const {
    data: { user },
    error: userError
  } = await supabase.auth.getUser();

  if (userError) {
    return { configured: true, user: null, data: null, error: userError.message };
  }
  if (!user) {
    return { configured: true, user: null, data: null, error: null };
  }

  const { data: memberships, error: membershipsError } = await supabase
    .from("team_members")
    .select("*")
    .eq("user_id", user.id)
    .eq("status", "active")
    .order("created_at", { ascending: false });

  if (membershipsError) {
    return { configured: true, user, data: null, error: membershipsError.message };
  }

  const teamIds = Array.from(new Set((memberships ?? []).map((membership) => membership.team_id)));
  const { data: teamsData, error: teamsError } = teamIds.length
    ? await supabase.from("teams").select("*").in("id", teamIds).order("created_at", { ascending: false })
    : { data: [], error: null };

  if (teamsError) {
    return { configured: true, user, data: null, error: teamsError.message };
  }

  const teams = (teamsData ?? []) as Team[];
  const selectedTeam = teams.find((team) => team.id === teamId) ?? teams[0] ?? null;

  if (!selectedTeam) {
    return {
      configured: true,
      user,
      data: {
        user,
        teams,
        selectedTeam: null,
        members: [],
        profiles: [],
        boards: [],
        selectedBoard: null,
        columns: [],
        tasks: [],
        comments: []
      },
      error: null
    };
  }

  const [membersResult, profilesResult, boardsResult] = await Promise.all([
    supabase
      .from("team_members")
      .select("*")
      .eq("team_id", selectedTeam.id)
      .eq("status", "active")
      .order("created_at"),
    supabase.rpc("get_team_member_profiles", { checked_team_id: selectedTeam.id }),
    supabase
      .from("team_boards")
      .select("*")
      .eq("team_id", selectedTeam.id)
      .eq("is_archived", false)
      .order("created_at", { ascending: false })
  ]);

  const baseError = membersResult.error?.message ?? profilesResult.error?.message ?? boardsResult.error?.message ?? null;
  if (baseError) {
    return { configured: true, user, data: null, error: baseError };
  }

  const boards = (boardsResult.data ?? []) as TeamBoard[];
  const selectedBoard = boards.find((board) => board.id === boardId) ?? boards[0] ?? null;

  if (!selectedBoard) {
    return {
      configured: true,
      user,
      data: {
        user,
        teams,
        selectedTeam,
        members: (membersResult.data ?? []) as TeamMember[],
        profiles: (profilesResult.data ?? []) as TeamMemberProfile[],
        boards,
        selectedBoard: null,
        columns: [],
        tasks: [],
        comments: []
      },
      error: null
    };
  }

  const [columnsResult, tasksResult] = await Promise.all([
    supabase.from("team_board_columns").select("*").eq("board_id", selectedBoard.id).order("sort_order"),
    supabase.from("team_board_tasks").select("*").eq("board_id", selectedBoard.id).order("sort_order")
  ]);

  const boardError = columnsResult.error?.message ?? tasksResult.error?.message ?? null;
  if (boardError) {
    return { configured: true, user, data: null, error: boardError };
  }

  const tasks = (tasksResult.data ?? []).map(normalizeTeamBoardTask);
  const taskIds = tasks.map((task) => task.id);
  const { data: commentsData, error: commentsError } = taskIds.length
    ? await supabase.from("team_board_comments").select("*").in("task_id", taskIds).order("created_at")
    : { data: [], error: null };

  if (commentsError) {
    return { configured: true, user, data: null, error: commentsError.message };
  }

  return {
    configured: true,
    user,
    data: {
      user,
      teams,
      selectedTeam,
      members: (membersResult.data ?? []) as TeamMember[],
      profiles: (profilesResult.data ?? []) as TeamMemberProfile[],
      boards,
      selectedBoard,
      columns: (columnsResult.data ?? []).map(normalizeTeamBoardColumn),
      tasks,
      comments: (commentsData ?? []) as TeamBoardComment[]
    },
    error: null
  };
}

function normalizeTeamGoal(row: TeamGoal): TeamGoal {
  return { ...row, target_value: Number(row.target_value) };
}

function normalizeTeamGoalContribution(row: TeamGoalContribution): TeamGoalContribution {
  return { ...row, value: Number(row.value) };
}

function normalizeTeamChallenge(row: TeamChallenge): TeamChallenge {
  return { ...row, target_value: Number(row.target_value) };
}

function normalizeTeamChallengeCheckin(row: TeamChallengeCheckin): TeamChallengeCheckin {
  return { ...row, value: Number(row.value) };
}

function normalizeTeamBoardColumn(row: TeamBoardColumn): TeamBoardColumn {
  return { ...row, sort_order: Number(row.sort_order) };
}

function normalizeTeamBoardTask(row: TeamBoardTask): TeamBoardTask {
  return { ...row, sort_order: Number(row.sort_order) };
}
