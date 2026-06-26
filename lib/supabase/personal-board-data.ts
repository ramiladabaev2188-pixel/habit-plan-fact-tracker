import type { User } from "@supabase/supabase-js";
import { unstable_noStore as noStore } from "next/cache";
import type {
  Goal,
  Month,
  PersonalBoard,
  PersonalBoardColumn,
  PersonalBoardComment,
  PersonalBoardTask,
  Task
} from "@/types/domain";
import { isSupabaseConfigured } from "./env";
import { createClient } from "./server";
import { normalizeGoal, normalizeMonth, normalizeTask } from "./data";

export type PersonalBoardData = {
  user: User;
  boards: PersonalBoard[];
  selectedBoard: PersonalBoard | null;
  columns: PersonalBoardColumn[];
  boardTasks: PersonalBoardTask[];
  comments: PersonalBoardComment[];
  goals: Goal[];
  habitTasks: Task[];
  months: Month[];
};

export type PersonalBoardResult =
  | { configured: false; user: null; data: null; error: null }
  | { configured: true; user: User | null; data: PersonalBoardData | null; error: string | null };

export async function loadPersonalBoardData(boardId?: string): Promise<PersonalBoardResult> {
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

  const [boardsResult, goalsResult, habitTasksResult, monthsResult] = await Promise.all([
    supabase
      .from("personal_boards")
      .select("*")
      .eq("user_id", user.id)
      .eq("is_archived", false)
      .order("is_default", { ascending: false })
      .order("created_at", { ascending: false }),
    supabase
      .from("goals")
      .select("*")
      .eq("user_id", user.id)
      .neq("status", "archived")
      .order("created_at", { ascending: false }),
    supabase
      .from("tasks")
      .select("*")
      .eq("user_id", user.id)
      .eq("is_active", true)
      .order("created_at", { ascending: false }),
    supabase
      .from("months")
      .select("*")
      .eq("user_id", user.id)
      .order("year", { ascending: false })
      .order("month", { ascending: false })
  ]);

  const baseError =
    boardsResult.error?.message ??
    goalsResult.error?.message ??
    habitTasksResult.error?.message ??
    monthsResult.error?.message ??
    null;

  if (baseError) {
    return { configured: true, user, data: null, error: baseError };
  }

  const boards = (boardsResult.data ?? []).map(normalizePersonalBoard);
  const selectedBoard =
    boards.find((board) => board.id === boardId) ??
    boards.find((board) => board.is_default) ??
    boards[0] ??
    null;

  if (!selectedBoard) {
    return {
      configured: true,
      user,
      data: {
        user,
        boards,
        selectedBoard: null,
        columns: [],
        boardTasks: [],
        comments: [],
        goals: (goalsResult.data ?? []).map(normalizeGoal),
        habitTasks: (habitTasksResult.data ?? []).map(normalizeTask),
        months: (monthsResult.data ?? []).map(normalizeMonth)
      },
      error: null
    };
  }

  const [columnsResult, boardTasksResult] = await Promise.all([
    supabase
      .from("personal_board_columns")
      .select("*")
      .eq("user_id", user.id)
      .eq("board_id", selectedBoard.id)
      .order("sort_order"),
    supabase
      .from("personal_board_tasks")
      .select("*")
      .eq("user_id", user.id)
      .eq("board_id", selectedBoard.id)
      .eq("is_archived", false)
      .order("sort_order")
  ]);

  const boardError = columnsResult.error?.message ?? boardTasksResult.error?.message ?? null;
  if (boardError) {
    return { configured: true, user, data: null, error: boardError };
  }

  const boardTasks = (boardTasksResult.data ?? []).map(normalizePersonalBoardTask);
  const taskIds = boardTasks.map((task) => task.id);
  const { data: commentsData, error: commentsError } = taskIds.length
    ? await supabase
        .from("personal_board_comments")
        .select("*")
        .eq("user_id", user.id)
        .in("task_id", taskIds)
        .order("created_at")
    : { data: [], error: null };

  if (commentsError) {
    return { configured: true, user, data: null, error: commentsError.message };
  }

  return {
    configured: true,
    user,
    data: {
      user,
      boards,
      selectedBoard,
      columns: (columnsResult.data ?? []).map(normalizePersonalBoardColumn),
      boardTasks,
      comments: (commentsData ?? []) as PersonalBoardComment[],
      goals: (goalsResult.data ?? []).map(normalizeGoal),
      habitTasks: (habitTasksResult.data ?? []).map(normalizeTask),
      months: (monthsResult.data ?? []).map(normalizeMonth)
    },
    error: null
  };
}

function normalizePersonalBoard(row: PersonalBoard): PersonalBoard {
  return row;
}

function normalizePersonalBoardColumn(row: PersonalBoardColumn): PersonalBoardColumn {
  return { ...row, sort_order: Number(row.sort_order) };
}

function normalizePersonalBoardTask(row: PersonalBoardTask): PersonalBoardTask {
  return { ...row, sort_order: Number(row.sort_order) };
}
