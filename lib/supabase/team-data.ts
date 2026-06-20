import type { User } from "@supabase/supabase-js";
import { unstable_noStore as noStore } from "next/cache";
import type {
  DailyFact,
  DailyPlan,
  Month,
  Task,
  Team,
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
        facts: []
      },
      error: null
    };
  }

  const [membersResult, invitesResult, preferenceResult] = await Promise.all([
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
  ]);

  const teamError =
    membersResult.error?.message ??
    invitesResult.error?.message ??
    preferenceResult.error?.message ??
    null;

  if (teamError) {
    return { configured: true, user, data: null, error: teamError };
  }

  const members = (membersResult.data ?? []) as TeamMember[];
  const userIds = Array.from(new Set(members.map((member) => member.user_id)));

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

  const [plansResult, factsResult] = monthIds.length
    ? await Promise.all([
        supabase.from("daily_plans").select("*").in("month_id", monthIds),
        supabase.from("daily_facts").select("*").in("month_id", monthIds)
      ])
    : [
        { data: [], error: null },
        { data: [], error: null }
      ];

  const monthDataError = plansResult.error?.message ?? factsResult.error?.message ?? null;

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
      facts: (factsResult.data ?? []).map(normalizeDailyFact)
    },
    error: null
  };
}
