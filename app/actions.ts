"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getMonthTitle, getTodayKey } from "@/lib/dates/month";
import { calculateScore } from "@/lib/metrics";
import {
  copyMonthTemplate,
  generatePlanFromRule,
  mergeApprovedPlanRows
} from "@/lib/planning";
import { consumeRateLimit } from "@/lib/security/rate-limit";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";
import {
  categorySchema,
  categoryUpdateSchema,
  copyMonthTemplateSchema,
  dateKeySchema,
  dailyNoteSchema,
  entityIdSchema,
  factValueSchema,
  goalSchema,
  importPreviewSchema,
  monthSchema,
  noteSchema,
  planGenerationSchema,
  planValueSchema,
  preferencesSchema,
  settingsSchema,
  signInSchema,
  signUpSchema,
  taskActiveSchema,
  taskSchema,
  taskUpdateSchema,
  teamInviteSchema,
  teamInviteTokenSchema,
  teamSchema,
  leaveTeamSchema,
  teamChallengeSchema,
  teamContributionSchema,
  teamGoalSchema,
  teamBoardCommentSchema,
  teamBoardSchema,
  teamBoardTaskMoveSchema,
  teamBoardTaskSchema
} from "@/lib/validators/tracker";
import {
  personalBoardCommentSchema,
  personalBoardSchema,
  personalBoardTaskArchiveSchema,
  personalBoardTaskMoveSchema,
  personalBoardTaskSchema,
  personalBoardTaskUpdateSchema
} from "@/lib/validators/personal-board";
import type { PlanningRuleMode } from "@/types/domain";

type DailyEntryInput = {
  taskId: string;
  actualValue: number | null;
  note?: string;
};

type SaveDailyFactsInput = {
  monthId: string;
  date: string;
  entries: DailyEntryInput[];
  dailyNote?: {
    content?: string;
    mood?: string;
    energy?: number | "";
  };
};

type SaveDailyFactsResult = {
  ok: boolean;
  error?: string;
};

type ImportedPayload = {
  categories?: Array<Record<string, unknown>>;
  tasks?: Array<Record<string, unknown>>;
  months?: Array<Record<string, unknown>>;
  daily_plans?: Array<Record<string, unknown>>;
  daily_facts?: Array<Record<string, unknown>>;
  goals?: Array<Record<string, unknown>>;
  goal_tasks?: Array<Record<string, unknown>>;
  notes?: Array<Record<string, unknown>>;
  task_planning_rules?: Array<Record<string, unknown>>;
  daily_notes?: Array<Record<string, unknown>>;
  user_preferences?: Record<string, unknown> | null;
};

export async function signInAction(formData: FormData) {
  const parsedCredentials = signInSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password")
  });

  if (!parsedCredentials.success) {
    redirect(`/login?message=${encodeURIComponent(parsedCredentials.error.issues[0]?.message ?? "Проверьте данные для входа")}`);
  }

  const rateLimit = await consumeRateLimit({
    scope: "auth-signin",
    identifier: parsedCredentials.data.email,
    maxRequests: 5,
    windowSeconds: 60
  });

  if (!rateLimit.allowed) {
    redirect(`/login?message=${encodeURIComponent(getRateLimitMessage(rateLimit.retryAfter))}`);
  }

  const supabase = await createClient();
  const next = getSafeNextPath(formData.get("next"));

  const { error } = await supabase.auth.signInWithPassword(parsedCredentials.data);

  if (error) {
    redirect(`/login?message=${encodeURIComponent(error.message)}`);
  }

  redirect(next ?? "/dashboard");
}

export async function signUpAction(formData: FormData) {
  const parsedCredentials = signUpSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    password: formData.get("password")
  });

  if (!parsedCredentials.success) {
    redirect(`/login?message=${encodeURIComponent(parsedCredentials.error.issues[0]?.message ?? "Проверьте данные регистрации")}`);
  }

  const rateLimit = await consumeRateLimit({
    scope: "auth-signup",
    identifier: parsedCredentials.data.email,
    maxRequests: 3,
    windowSeconds: 300
  });

  if (!rateLimit.allowed) {
    redirect(`/login?message=${encodeURIComponent(getRateLimitMessage(rateLimit.retryAfter))}`);
  }

  const supabase = await createClient();
  const origin = await getRequestOrigin();
  const next = getSafeNextPath(formData.get("next"));

  const { error } = await supabase.auth.signUp({
    email: parsedCredentials.data.email,
    password: parsedCredentials.data.password,
    options: {
      emailRedirectTo: `${origin}${next ?? "/dashboard"}`,
      data: { name: parsedCredentials.data.name }
    }
  });

  if (error) {
    redirect(`/login?message=${encodeURIComponent(error.message)}`);
  }

  redirect(next ?? "/dashboard");
}

export async function signOutAction() {
  if (!isSupabaseConfigured()) {
    redirect("/login");
  }

  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

export async function createMonthAction(formData: FormData) {
  const { supabase, userId } = await requireUser();
  const parsed = monthSchema.parse({
    year: formData.get("year"),
    month: formData.get("month"),
    title: formData.get("title")
  });

  const { data: preferences } = await supabase
    .from("user_preferences")
    .select("default_month_target")
    .eq("user_id", userId)
    .maybeSingle();

  const { error } = await supabase.from("months").upsert(
    {
      user_id: userId,
      year: parsed.year,
      month: parsed.month,
      title: parsed.title || getMonthTitle(parsed.year, parsed.month),
      target_percent: Number(preferences?.default_month_target ?? 0.8)
    },
    { onConflict: "user_id,year,month" }
  );

  if (error) {
    throw new Error(error.message);
  }

  revalidateTracker();
}

export async function copyMonthFromTemplateAction(formData: FormData) {
  const { supabase, userId } = await requireUser();
  const taskScope = formData.get("taskScope");
  const parsed = copyMonthTemplateSchema.parse({
    sourceMonthId: formData.get("sourceMonthId"),
    year: formData.get("year"),
    month: formData.get("month"),
    title: formData.get("title"),
    copyAllTasks: taskScope === "all",
    onlyActive: taskScope !== "all",
    excludeTasksWithoutPlan: formData.has("excludeTasksWithoutPlan"),
    keepCategories: true,
    keepGoalLinks: true
  });

  const { data: sourceMonth, error: sourceError } = await supabase
    .from("months")
    .select("*")
    .eq("id", parsed.sourceMonthId)
    .eq("user_id", userId)
    .single();

  if (sourceError || !sourceMonth) {
    throw new Error(sourceError?.message ?? "Месяц-шаблон не найден");
  }

  const { data: existingTarget, error: existingTargetError } = await supabase
    .from("months")
    .select("*")
    .eq("user_id", userId)
    .eq("year", parsed.year)
    .eq("month", parsed.month)
    .maybeSingle();

  if (existingTargetError) {
    throw new Error(existingTargetError.message);
  }

  if (existingTarget && existingTarget.status !== "draft") {
    throw new Error("Для этого периода уже есть утвержденный или закрытый месяц. Создайте другой период или разблокируйте его явно.");
  }

  if (existingTarget?.id === sourceMonth.id) {
    throw new Error("Выберите другой период для нового месяца.");
  }

  const targetMonthResult = existingTarget
    ? await supabase
        .from("months")
        .update({
          title: parsed.title,
          target_percent: Number(sourceMonth.target_percent)
        })
        .eq("id", existingTarget.id)
        .eq("user_id", userId)
        .select("*")
        .single()
    : await supabase
        .from("months")
        .insert({
          user_id: userId,
          year: parsed.year,
          month: parsed.month,
          title: parsed.title,
          status: "draft",
          target_percent: Number(sourceMonth.target_percent)
        })
        .select("*")
        .single();

  const { data: targetMonth, error: targetError } = targetMonthResult;

  if (targetError || !targetMonth) {
    throw new Error(targetError?.message ?? "Новый месяц не создан");
  }

  const [{ data: sourcePlans, error: plansError }, { data: tasks, error: tasksError }, { data: rules, error: rulesError }] =
    await Promise.all([
      supabase.from("daily_plans").select("*").eq("month_id", sourceMonth.id),
      supabase.from("tasks").select("*").eq("user_id", userId),
      supabase.from("task_planning_rules").select("*").eq("user_id", userId)
    ]);

  if (plansError || tasksError || rulesError) {
    throw new Error(plansError?.message ?? tasksError?.message ?? rulesError?.message ?? "Не удалось прочитать шаблон");
  }

  const copied = copyMonthTemplate({
    targetMonth,
    sourcePlans: sourcePlans ?? [],
    tasks: (tasks ?? []).map((task) => ({
      ...task,
      weight: Number(task.weight)
    })),
    rules: (rules ?? []).map((rule) => ({
      ...rule,
      default_planned_value: Number(rule.default_planned_value),
      times_per_month: rule.times_per_month === null ? null : Number(rule.times_per_month)
    })),
    options: parsed
  });

  if (copied.rows.length > 0) {
    const { error: insertPlansError } = await supabase
      .from("daily_plans")
      .upsert(copied.rows, { onConflict: "month_id,task_id,date" });

    if (insertPlansError) {
      throw new Error(insertPlansError.message);
    }
  }

  const copiedTaskIds = new Set(copied.tasks.map((task) => task.id));
  const copiedRules = (rules ?? [])
    .filter((rule) => copiedTaskIds.has(rule.task_id))
    .map((rule) => ({
      user_id: userId,
      task_id: rule.task_id,
      mode: rule.mode,
      weekdays: rule.weekdays,
      specific_dates: rule.specific_dates,
      times_per_month: rule.times_per_month,
      default_planned_value: rule.default_planned_value
    }));

  if (copiedRules.length > 0) {
    const { error: rulesCopyError } = await supabase
      .from("task_planning_rules")
      .upsert(copiedRules, { onConflict: "user_id,task_id" });

    if (rulesCopyError) {
      throw new Error(rulesCopyError.message);
    }
  }

  revalidateTracker();
  redirect(`/planner?month=${targetMonth.id}`);
}

export async function createCategoryAction(formData: FormData) {
  const { supabase, userId } = await requireUser();
  const parsed = categorySchema.parse({
    name: formData.get("name"),
    color: formData.get("color")
  });

  const { error } = await supabase.from("categories").upsert(
    {
      user_id: userId,
      name: parsed.name,
      color: parsed.color
    },
    { onConflict: "user_id,name" }
  );

  if (error) {
    throw new Error(error.message);
  }

  revalidateTracker();
}

export async function updateCategoryAction(formData: FormData) {
  const { supabase, userId } = await requireUser();
  const parsed = categoryUpdateSchema.parse({
    id: formData.get("id"),
    name: formData.get("name"),
    color: formData.get("color")
  });

  const { error } = await supabase
    .from("categories")
    .update({
      name: parsed.name,
      color: parsed.color
    })
    .eq("id", parsed.id)
    .eq("user_id", userId);

  if (error) {
    throw new Error(error.message);
  }

  revalidateTracker();
}

export async function deleteCategoryAction(formData: FormData) {
  const { supabase, userId } = await requireUser();
  const categoryId = entityIdSchema.parse(formData.get("id"));

  const { error } = await supabase
    .from("categories")
    .delete()
    .eq("id", categoryId)
    .eq("user_id", userId);

  if (error) {
    throw new Error(error.message);
  }

  revalidateTracker();
}

export async function createTaskAction(formData: FormData) {
  const { supabase, userId } = await requireUser();
  const parsed = taskSchema.parse({
    categoryId: formData.get("categoryId"),
    title: formData.get("title"),
    description: formData.get("description"),
    weight: formData.get("weight")
  });

  const { error } = await supabase.from("tasks").upsert(
    {
      user_id: userId,
      category_id: parsed.categoryId,
      title: parsed.title,
      description: parsed.description || null,
      weight: parsed.weight,
      is_active: true
    },
    { onConflict: "user_id,title" }
  );

  if (error) {
    throw new Error(error.message);
  }

  revalidateTracker();
}

export async function updateTaskAction(formData: FormData) {
  const { supabase, userId } = await requireUser();
  const parsed = taskUpdateSchema.parse({
    id: formData.get("id"),
    categoryId: formData.get("categoryId"),
    title: formData.get("title"),
    description: formData.get("description"),
    weight: formData.get("weight")
  });

  const { error } = await supabase
    .from("tasks")
    .update({
      category_id: parsed.categoryId,
      title: parsed.title,
      description: parsed.description || null,
      weight: parsed.weight
    })
    .eq("id", parsed.id)
    .eq("user_id", userId);

  if (error) {
    throw new Error(error.message);
  }

  revalidateTracker();
}

export async function setTaskActiveAction(formData: FormData) {
  const { supabase, userId } = await requireUser();
  const parsed = taskActiveSchema.parse({
    id: formData.get("id"),
    isActive: formData.get("isActive")
  });

  const { error } = await supabase
    .from("tasks")
    .update({ is_active: parsed.isActive })
    .eq("id", parsed.id)
    .eq("user_id", userId);

  if (error) {
    throw new Error(error.message);
  }

  revalidateTracker();
}

export async function deleteTaskAction(formData: FormData) {
  const { supabase, userId } = await requireUser();
  const taskId = entityIdSchema.parse(formData.get("id"));

  const { error } = await supabase
    .from("tasks")
    .delete()
    .eq("id", taskId)
    .eq("user_id", userId);

  if (error) {
    throw new Error(error.message);
  }

  revalidateTracker();
}

export async function generatePlanAction(formData: FormData) {
  const { supabase, userId } = await requireUser();
  const parsed = planGenerationSchema.parse({
    monthId: formData.get("monthId"),
    taskId: formData.get("taskId"),
    mode: formData.get("mode"),
    plannedValue: formData.get("plannedValue"),
    weekdays: formData.getAll("weekdays"),
    timesPerMonth: formData.get("timesPerMonth") || undefined,
    specificDates: String(formData.get("specificDates") ?? "")
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean)
  });

  const [{ data: month, error: monthError }, { data: task, error: taskError }] =
    await Promise.all([
      supabase.from("months").select("*").eq("id", parsed.monthId).eq("user_id", userId).single(),
      supabase.from("tasks").select("*").eq("id", parsed.taskId).eq("user_id", userId).single()
    ]);

  if (monthError || taskError || !month || !task) {
    throw new Error(monthError?.message ?? taskError?.message ?? "Месяц или задача не найдены");
  }

  if (month.status === "closed") {
    throw new Error("Закрытый месяц нельзя редактировать. Сначала разблокируйте месяц.");
  }

  const { data: existingPlans, error: existingError } = await supabase
    .from("daily_plans")
    .select("*")
    .eq("month_id", parsed.monthId)
    .eq("task_id", parsed.taskId);

  if (existingError) {
    throw new Error(existingError.message);
  }

  const rulePayload = {
    user_id: userId,
    task_id: parsed.taskId,
    mode: parsed.mode,
    weekdays: parsed.mode === "specific_weekdays" ? parsed.weekdays : null,
    specific_dates: parsed.mode === "specific_dates" ? parsed.specificDates : null,
    times_per_month: parsed.mode === "n_times_per_month" ? parsed.timesPerMonth ?? 1 : null,
    default_planned_value: parsed.plannedValue
  };
  const generatedRows = generatePlanFromRule(month, { id: task.id, weight: Number(task.weight) }, {
    taskId: parsed.taskId,
    mode: parsed.mode,
    weekdays: parsed.weekdays,
    specificDates: parsed.specificDates,
    timesPerMonth: parsed.timesPerMonth,
    defaultPlannedValue: parsed.plannedValue
  });
  const rows = mergeApprovedPlanRows(
    generatedRows,
    existingPlans ?? [],
    month.status === "approved"
  );

  if (rows.length > 0) {
    const { error } = await supabase
      .from("daily_plans")
      .upsert(rows, { onConflict: "month_id,task_id,date" });

    if (error) {
      throw new Error(error.message);
    }
  }

  const { error: ruleError } = await supabase
    .from("task_planning_rules")
    .upsert(rulePayload, { onConflict: "user_id,task_id" });

  if (ruleError) {
    throw new Error(ruleError.message);
  }

  revalidateTracker();
}

export async function savePlanGridAction(formData: FormData) {
  const { supabase, userId } = await requireUser();
  const monthId = String(formData.get("monthId") ?? "");

  const { data: month, error: monthError } = await supabase
    .from("months")
    .select("*")
    .eq("id", monthId)
    .eq("user_id", userId)
    .single();

  if (monthError || !month) {
    throw new Error(monthError?.message ?? "Месяц не найден");
  }

  if (month.status === "closed") {
    throw new Error("Закрытый месяц нельзя редактировать. Сначала разблокируйте месяц.");
  }

  const { data: tasks, error: tasksError } = await supabase
    .from("tasks")
    .select("id, weight")
    .eq("user_id", userId);

  if (tasksError) {
    throw new Error(tasksError.message);
  }

  const { data: existingPlans, error: plansError } = await supabase
    .from("daily_plans")
    .select("task_id, date, planned_value")
    .eq("month_id", monthId);

  if (plansError) {
    throw new Error(plansError.message);
  }

  const taskWeights = new Map((tasks ?? []).map((task) => [task.id, Number(task.weight)]));
  const existing = new Map(
    (existingPlans ?? []).map((plan) => [
      `${plan.task_id}:${plan.date}`,
      Number(plan.planned_value)
    ])
  );
  const rows: {
    month_id: string;
    task_id: string;
    date: string;
    planned_value: number;
    planned_score: number;
  }[] = [];

  for (const [key, value] of formData.entries()) {
    if (!key.startsWith("plan:")) {
      continue;
    }

    const [, taskId, date] = key.split(":");
    const plannedValue = planValueSchema.parse(Number(value));
    const currentValue = existing.get(`${taskId}:${date}`) ?? 0;
    const safeValue =
      month.status === "approved"
        ? Math.max(plannedValue, currentValue)
        : plannedValue;

    rows.push({
      month_id: monthId,
      task_id: taskId,
      date,
      planned_value: safeValue,
      planned_score: calculateScore(safeValue, taskWeights.get(taskId) ?? 0)
    });
  }

  if (rows.length === 0) {
    return;
  }

  const { error } = await supabase
    .from("daily_plans")
    .upsert(rows, { onConflict: "month_id,task_id,date" });

  if (error) {
    throw new Error(error.message);
  }

  revalidateTracker();
}

export async function approveMonthAction(formData: FormData) {
  const { supabase, userId } = await requireUser();
  const monthId = String(formData.get("monthId") ?? "");

  const { error } = await supabase
    .from("months")
    .update({ status: "approved" })
    .eq("id", monthId)
    .eq("user_id", userId);

  if (error) {
    throw new Error(error.message);
  }

  revalidateTracker();
}

export async function closeMonthAction(formData: FormData) {
  const { supabase, userId } = await requireUser();
  const monthId = String(formData.get("monthId") ?? "");

  const { error } = await supabase
    .from("months")
    .update({ status: "closed" })
    .eq("id", monthId)
    .eq("user_id", userId);

  if (error) {
    throw new Error(error.message);
  }

  revalidateTracker();
}

export async function unlockMonthAction(formData: FormData) {
  const { supabase, userId } = await requireUser();
  const monthId = String(formData.get("monthId") ?? "");

  const { error } = await supabase
    .from("months")
    .update({ status: "approved", closed_at: null })
    .eq("id", monthId)
    .eq("user_id", userId)
    .eq("status", "closed");

  if (error) {
    throw new Error(error.message);
  }

  revalidateTracker();
}

export async function lockApprovedPlansAction(formData: FormData) {
  const { supabase, userId } = await requireUser();
  const monthId = String(formData.get("monthId") ?? "");

  const { data: month, error: monthError } = await supabase
    .from("months")
    .select("id, status")
    .eq("id", monthId)
    .eq("user_id", userId)
    .single();

  if (monthError || !month) {
    throw new Error(monthError?.message ?? "Месяц не найден");
  }

  if (month.status === "draft") {
    throw new Error("Черновик не нужно блокировать");
  }

  const { error } = await supabase
    .from("daily_plans")
    .update({ locked: true })
    .eq("month_id", monthId);

  if (error) {
    throw new Error(error.message);
  }

  revalidateTracker();
}

export async function saveDailyFactsAction(input: SaveDailyFactsInput): Promise<SaveDailyFactsResult> {
  const { supabase, userId } = await requireUser();
  const parsedMonthId = entityIdSchema.safeParse(input.monthId);
  const parsedDate = dateKeySchema.safeParse(input.date);

  if (!parsedMonthId.success || !parsedDate.success) {
    return {
      ok: false,
      error: "Месяц или дата выбраны некорректно. Обновите страницу и повторите попытку."
    };
  }

  const { data: month, error: monthError } = await supabase
    .from("months")
    .select("id, status, year, month")
    .eq("id", parsedMonthId.data)
    .eq("user_id", userId)
    .maybeSingle();

  if (monthError || !month) {
    return {
      ok: false,
      error: monthError?.message ?? "Месяц не найден. Обновите страницу или создайте новый месяц."
    };
  }

  if (month.status === "closed") {
    return {
      ok: false,
      error: "Закрытый месяц нельзя редактировать. Сначала разблокируйте месяц."
    };
  }

  const expectedMonthPrefix = `${String(month.year).padStart(4, "0")}-${String(month.month).padStart(2, "0")}`;

  if (!parsedDate.data.startsWith(expectedMonthPrefix)) {
    return { ok: false, error: "Дата должна входить в выбранный месяц." };
  }

  const entries = input.entries;
  const taskIds = entries.map((entry) => entry.taskId);

  if (new Set(taskIds).size !== taskIds.length) {
    return { ok: false, error: "Одна задача передана несколько раз. Обновите страницу и повторите попытку." };
  }

  const [{ data: tasks, error: tasksError }, { data: plans, error: plansError }] = await Promise.all([
    taskIds.length
      ? supabase.from("tasks").select("id, weight").eq("user_id", userId).in("id", taskIds)
      : Promise.resolve({ data: [], error: null }),
    taskIds.length
      ? supabase
          .from("daily_plans")
          .select("task_id")
          .eq("month_id", month.id)
          .eq("date", parsedDate.data)
          .in("task_id", taskIds)
      : Promise.resolve({ data: [], error: null })
  ]);

  if (tasksError || plansError) {
    return { ok: false, error: tasksError?.message ?? plansError?.message ?? "Не удалось проверить задачи дня." };
  }

  const taskWeights = new Map((tasks ?? []).map((task) => [task.id, Number(task.weight)]));
  const plannedTaskIds = new Set((plans ?? []).map((plan) => plan.task_id));

  if (taskWeights.size !== taskIds.length || plannedTaskIds.size !== taskIds.length) {
    return { ok: false, error: "Факт можно внести только для задачи с планом на выбранный день." };
  }

  const rows = entries
    .filter((entry): entry is DailyEntryInput & { actualValue: number } => typeof entry.actualValue === "number")
    .map((entry) => {
    const actualValue = factValueSchema.parse(entry.actualValue);

    return {
      month_id: input.monthId,
      task_id: entry.taskId,
      date: parsedDate.data,
      actual_value: actualValue,
      actual_score: calculateScore(actualValue, taskWeights.get(entry.taskId) ?? 0),
      note: entry.note?.trim() || null
    };
    });

  const clearedTaskIds = entries
    .filter((entry) => entry.actualValue === null)
    .map((entry) => entry.taskId);

  if (rows.length > 0) {
    const { error } = await supabase
      .from("daily_facts")
      .upsert(rows, { onConflict: "month_id,task_id,date" });

    if (error) {
      return { ok: false, error: error.message };
    }
  }

  if (clearedTaskIds.length > 0) {
    const { error } = await supabase
      .from("daily_facts")
      .delete()
      .eq("month_id", input.monthId)
      .eq("date", parsedDate.data)
      .in("task_id", clearedTaskIds);

    if (error) {
      return { ok: false, error: error.message };
    }
  }

  if (input.dailyNote) {
    const parsedNote = dailyNoteSchema.parse(input.dailyNote);
    const { error: noteError } = await supabase
      .from("daily_notes")
      .upsert(
        {
          user_id: userId,
          month_id: input.monthId,
          date: input.date,
          content: parsedNote.content ?? "",
          mood: parsedNote.mood || null,
          energy: typeof parsedNote.energy === "number" ? parsedNote.energy : null
        },
        { onConflict: "user_id,date" }
      );

    if (noteError) {
      return { ok: false, error: noteError.message };
    }
  }

  revalidateTracker();
  return { ok: true };
}

export async function updateSettingsAction(formData: FormData) {
  const { supabase, userId } = await requireUser();
  const parsed = settingsSchema.parse({
    name: formData.get("name"),
    timezone: formData.get("timezone"),
    targetPercent: formData.get("targetPercent")
  });
  const monthId = String(formData.get("monthId") ?? "");

  const { error: profileError } = await supabase
    .from("profiles")
    .update({
      name: parsed.name,
      timezone: parsed.timezone
    })
    .eq("id", userId);

  if (profileError) {
    throw new Error(profileError.message);
  }

  if (monthId) {
    const { error: monthError } = await supabase
      .from("months")
      .update({ target_percent: parsed.targetPercent })
      .eq("id", monthId)
      .eq("user_id", userId);

    if (monthError) {
      throw new Error(monthError.message);
    }
  }

  revalidateTracker();
}

export async function updatePreferencesAction(formData: FormData) {
  const { supabase, userId } = await requireUser();
  const parsed = preferencesSchema.parse({
    dailyReminderEnabled: formData.has("dailyReminderEnabled"),
    dailyReminderTime: formData.get("dailyReminderTime"),
    riskAlertsEnabled: formData.has("riskAlertsEnabled"),
    theme: formData.get("theme"),
    defaultMonthTarget: formData.get("defaultMonthTarget")
  });

  const { error } = await supabase
    .from("user_preferences")
    .upsert(
      {
        user_id: userId,
        daily_reminder_enabled: parsed.dailyReminderEnabled,
        daily_reminder_time: parsed.dailyReminderTime,
        risk_alerts_enabled: parsed.riskAlertsEnabled,
        theme: parsed.theme,
        default_month_target: parsed.defaultMonthTarget
      },
      { onConflict: "user_id" }
    );

  if (error) {
    throw new Error(error.message);
  }

  revalidateTracker();
}

export async function createTeamAction(formData: FormData) {
  const { supabase, userId } = await requireUser();
  const parsed = teamSchema.parse({
    name: formData.get("name"),
    description: formData.get("description")
  });

  const { data: team, error: teamError } = await supabase
    .from("teams")
    .insert({
      owner_id: userId,
      name: parsed.name,
      description: parsed.description || null
    })
    .select("id")
    .single();

  if (teamError || !team) {
    throw new Error(teamError?.message ?? "Команда не создана");
  }

  const { error: memberError } = await supabase.from("team_members").insert({
    team_id: team.id,
    user_id: userId,
    role: "owner",
    status: "active",
    joined_at: new Date().toISOString()
  });

  if (memberError) {
    throw new Error(memberError.message);
  }

  revalidatePath("/team");
  redirect(`/team?team=${team.id}`);
}

export async function createTeamInviteAction(formData: FormData) {
  const { supabase, userId } = await requireUser();
  const parsed = teamInviteSchema.parse({
    teamId: formData.get("teamId"),
    email: formData.get("email"),
    role: formData.get("role") || "member"
  });

  const { data: membership, error: membershipError } = await supabase
    .from("team_members")
    .select("role")
    .eq("team_id", parsed.teamId)
    .eq("user_id", userId)
    .eq("status", "active")
    .maybeSingle();

  const { data: team, error: teamError } = await supabase
    .from("teams")
    .select("owner_id")
    .eq("id", parsed.teamId)
    .maybeSingle();

  const canInvite =
    team?.owner_id === userId ||
    (membership && ["owner", "admin"].includes(String(membership.role)));

  if (membershipError || teamError || !canInvite) {
    throw new Error(membershipError?.message ?? "Недостаточно прав для приглашения");
  }

  const rateLimit = await consumeRateLimit({
    scope: "team-invite",
    identifier: userId,
    maxRequests: 10,
    windowSeconds: 3600
  });

  if (!rateLimit.allowed) {
    throw new Error(getRateLimitMessage(rateLimit.retryAfter));
  }

  const token = crypto.randomUUID().replaceAll("-", "");
  const { error } = await supabase.from("team_invites").insert({
    team_id: parsed.teamId,
    created_by: userId,
    token,
    email: parsed.email || null,
    role: parsed.role
  });

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/team");
  redirect(`/team?team=${parsed.teamId}&invite=${token}`);
}

export async function acceptTeamInviteAction(formData: FormData) {
  const { supabase } = await requireUser();
  const token = teamInviteTokenSchema.parse(formData.get("token"));

  const { data, error } = await supabase.rpc("accept_team_invite_by_token", {
    invite_token: token
  });
  const result = data?.[0];

  if (error || !result) {
    throw new Error(getTeamInviteErrorMessage(error?.message));
  }

  revalidatePath("/team");
  redirect(`/team?team=${result.team_id}`);
}

function getTeamInviteErrorMessage(message?: string) {
  if (message?.includes("AUTH_REQUIRED")) {
    return "Войдите, чтобы принять приглашение";
  }

  if (message?.includes("INVITE_ALREADY_USED")) {
    return "Это приглашение уже использовано";
  }

  if (message?.includes("INVITE_EXPIRED")) {
    return "Срок действия приглашения истек";
  }

  if (message?.includes("INVITE_EMAIL_MISMATCH")) {
    return "Это приглашение создано для другого адреса электронной почты.";
  }

  return "Приглашение не найдено";
}

export async function leaveTeamAction(formData: FormData) {
  const { supabase } = await requireUser();
  const parsed = leaveTeamSchema.parse({
    teamId: formData.get("teamId")
  });

  const { error } = await supabase.rpc("leave_team", {
    checked_team_id: parsed.teamId
  });

  if (error) {
    throw new Error(getLeaveTeamErrorMessage(error.message));
  }

  revalidatePath("/team");
  redirect("/team");
}

export async function updateTeamPrivacyAction(formData: FormData) {
  const { supabase, userId } = await requireUser();
  const teamId = entityIdSchema.parse(formData.get("teamId"));
  const shareTaskDetails = formData.get("shareTaskDetails") === "on";

  const { data: membership, error: membershipError } = await supabase
    .from("team_members")
    .select("team_id")
    .eq("team_id", teamId)
    .eq("user_id", userId)
    .eq("status", "active")
    .maybeSingle();

  if (membershipError || !membership) {
    throw new Error(membershipError?.message ?? "Вы не состоите в этой команде.");
  }

  const { error } = await supabase.from("team_member_preferences").upsert(
    {
      team_id: teamId,
      user_id: userId,
      share_task_details: shareTaskDetails
    },
    { onConflict: "team_id,user_id" }
  );

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/team");
}

export async function createTeamGoalAction(formData: FormData) {
  const { supabase, userId } = await requireUser();
  const parsed = teamGoalSchema.parse({
    teamId: formData.get("teamId"),
    title: formData.get("title"),
    description: formData.get("description"),
    unit: formData.get("unit"),
    targetValue: formData.get("targetValue"),
    startDate: formData.get("startDate"),
    dueDate: formData.get("dueDate")
  });

  await requireTeamAdmin(supabase, userId, parsed.teamId);

  const { error } = await supabase.from("team_goals").insert({
    team_id: parsed.teamId,
    created_by: userId,
    title: parsed.title,
    description: parsed.description || null,
    unit: parsed.unit,
    target_value: parsed.targetValue,
    start_date: parsed.startDate || null,
    due_date: parsed.dueDate || null
  });

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/team");
}

export async function createTeamChallengeAction(formData: FormData) {
  const { supabase, userId } = await requireUser();
  const parsed = teamChallengeSchema.parse({
    teamId: formData.get("teamId"),
    title: formData.get("title"),
    description: formData.get("description"),
    unit: formData.get("unit"),
    targetValue: formData.get("targetValue"),
    startDate: formData.get("startDate"),
    dueDate: formData.get("dueDate"),
    status: formData.get("status") || "active"
  });

  await requireTeamAdmin(supabase, userId, parsed.teamId);

  const { error } = await supabase.from("team_challenges").insert({
    team_id: parsed.teamId,
    created_by: userId,
    title: parsed.title,
    description: parsed.description || null,
    unit: parsed.unit,
    target_value: parsed.targetValue,
    status: parsed.status,
    start_date: parsed.startDate || null,
    due_date: parsed.dueDate || null
  });

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/team");
}

export async function addTeamGoalContributionAction(formData: FormData) {
  const { supabase, userId } = await requireUser();
  const parsed = teamContributionSchema.parse({
    teamId: formData.get("teamId"),
    initiativeId: formData.get("initiativeId"),
    value: formData.get("value"),
    note: formData.get("note"),
    date: formData.get("date")
  });
  const date = parsed.date ? dateKeySchema.parse(parsed.date) : getTodayKey();

  const { data: goal, error: goalError } = await supabase
    .from("team_goals")
    .select("id, status")
    .eq("id", parsed.initiativeId)
    .eq("team_id", parsed.teamId)
    .maybeSingle();

  if (goalError || !goal || goal.status !== "active") {
    throw new Error(goalError?.message ?? "Командная цель недоступна для вклада.");
  }

  const { error } = await supabase.from("team_goal_contributions").insert({
    goal_id: goal.id,
    user_id: userId,
    value: parsed.value,
    note: parsed.note || null,
    date
  });

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/team");
}

export async function addTeamChallengeCheckinAction(formData: FormData) {
  const { supabase, userId } = await requireUser();
  const parsed = teamContributionSchema.parse({
    teamId: formData.get("teamId"),
    initiativeId: formData.get("initiativeId"),
    value: formData.get("value"),
    note: formData.get("note"),
    date: formData.get("date")
  });
  const date = parsed.date ? dateKeySchema.parse(parsed.date) : getTodayKey();

  const { data: challenge, error: challengeError } = await supabase
    .from("team_challenges")
    .select("id, status")
    .eq("id", parsed.initiativeId)
    .eq("team_id", parsed.teamId)
    .maybeSingle();

  if (challengeError || !challenge || challenge.status !== "active") {
    throw new Error(challengeError?.message ?? "Челлендж недоступен для вклада.");
  }

  const { error } = await supabase.from("team_challenge_checkins").insert({
    challenge_id: challenge.id,
    user_id: userId,
    value: parsed.value,
    note: parsed.note || null,
    date
  });

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/team");
}

const defaultPersonalBoardColumns = [
  { title: "Входящие", color: "#64748b" },
  { title: "В работе", color: "#3478d4" },
  { title: "На паузе", color: "#d9822b" },
  { title: "Готово", color: "#21835f" }
];

export async function createPersonalBoardAction(formData: FormData) {
  const { supabase, userId } = await requireUser();
  const parsed = personalBoardSchema.parse({
    title: formData.get("title"),
    description: formData.get("description")
  });

  const { count, error: countError } = await supabase
    .from("personal_boards")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("is_archived", false);

  if (countError) {
    throw new Error(countError.message);
  }

  const { data: board, error: boardError } = await supabase
    .from("personal_boards")
    .insert({
      user_id: userId,
      title: parsed.title,
      description: parsed.description || null,
      is_default: (count ?? 0) === 0
    })
    .select("id")
    .single();

  if (boardError || !board) {
    throw new Error(boardError?.message ?? "Не удалось создать личную доску");
  }

  const { error: columnsError } = await supabase.from("personal_board_columns").insert(
    defaultPersonalBoardColumns.map((column, index) => ({
      user_id: userId,
      board_id: board.id,
      title: column.title,
      color: column.color,
      sort_order: index
    }))
  );

  if (columnsError) {
    throw new Error(columnsError.message);
  }

  revalidatePath("/tasks");
  redirect(`/tasks?board=${board.id}`);
}

export async function createPersonalBoardTaskAction(formData: FormData) {
  const { supabase, userId } = await requireUser();
  const parsed = personalBoardTaskSchema.parse({
    boardId: formData.get("boardId"),
    columnId: formData.get("columnId"),
    title: formData.get("title"),
    description: formData.get("description"),
    priority: formData.get("priority") || "medium",
    dueDate: formData.get("dueDate"),
    goalId: formData.get("goalId"),
    habitTaskId: formData.get("habitTaskId"),
    monthId: formData.get("monthId")
  });

  await requirePersonalBoardAccess(supabase, userId, parsed.boardId);
  const column = await requirePersonalBoardColumn(supabase, userId, parsed.boardId, parsed.columnId);

  const { error } = await supabase.from("personal_board_tasks").insert({
    user_id: userId,
    board_id: parsed.boardId,
    column_id: parsed.columnId,
    title: parsed.title,
    description: parsed.description || null,
    priority: parsed.priority,
    due_date: parsed.dueDate ? dateKeySchema.parse(parsed.dueDate) : null,
    goal_id: parsed.goalId || null,
    habit_task_id: parsed.habitTaskId || null,
    month_id: parsed.monthId || null,
    sort_order: Date.now(),
    completed_at: isDoneColumn(column.title) ? new Date().toISOString() : null
  });

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/tasks");
}

export async function updatePersonalBoardTaskAction(formData: FormData) {
  const { supabase, userId } = await requireUser();
  const parsed = personalBoardTaskUpdateSchema.parse({
    boardId: formData.get("boardId"),
    taskId: formData.get("taskId"),
    columnId: formData.get("columnId"),
    title: formData.get("title"),
    description: formData.get("description"),
    priority: formData.get("priority") || "medium",
    dueDate: formData.get("dueDate"),
    goalId: formData.get("goalId"),
    habitTaskId: formData.get("habitTaskId"),
    monthId: formData.get("monthId")
  });

  await requirePersonalBoardAccess(supabase, userId, parsed.boardId);
  const column = await requirePersonalBoardColumn(supabase, userId, parsed.boardId, parsed.columnId);

  const { error } = await supabase
    .from("personal_board_tasks")
    .update({
      column_id: parsed.columnId,
      title: parsed.title,
      description: parsed.description || null,
      priority: parsed.priority,
      due_date: parsed.dueDate ? dateKeySchema.parse(parsed.dueDate) : null,
      goal_id: parsed.goalId || null,
      habit_task_id: parsed.habitTaskId || null,
      month_id: parsed.monthId || null,
      completed_at: isDoneColumn(column.title) ? new Date().toISOString() : null
    })
    .eq("id", parsed.taskId)
    .eq("board_id", parsed.boardId)
    .eq("user_id", userId);

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/tasks");
}

export async function movePersonalBoardTaskAction(formData: FormData) {
  const { supabase, userId } = await requireUser();
  const parsed = personalBoardTaskMoveSchema.parse({
    boardId: formData.get("boardId"),
    taskId: formData.get("taskId"),
    columnId: formData.get("columnId")
  });

  await requirePersonalBoardAccess(supabase, userId, parsed.boardId);
  const column = await requirePersonalBoardColumn(supabase, userId, parsed.boardId, parsed.columnId);

  const { error } = await supabase
    .from("personal_board_tasks")
    .update({
      column_id: parsed.columnId,
      sort_order: Date.now(),
      completed_at: isDoneColumn(column.title) ? new Date().toISOString() : null
    })
    .eq("id", parsed.taskId)
    .eq("board_id", parsed.boardId)
    .eq("user_id", userId);

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/tasks");
}

export async function archivePersonalBoardTaskAction(formData: FormData) {
  const { supabase, userId } = await requireUser();
  const parsed = personalBoardTaskArchiveSchema.parse({
    boardId: formData.get("boardId"),
    taskId: formData.get("taskId")
  });

  await requirePersonalBoardAccess(supabase, userId, parsed.boardId);

  const { error } = await supabase
    .from("personal_board_tasks")
    .update({ is_archived: true })
    .eq("id", parsed.taskId)
    .eq("board_id", parsed.boardId)
    .eq("user_id", userId);

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/tasks");
}

export async function addPersonalBoardCommentAction(formData: FormData) {
  const { supabase, userId } = await requireUser();
  const parsed = personalBoardCommentSchema.parse({
    taskId: formData.get("taskId"),
    content: formData.get("content")
  });

  const { data: task, error: taskError } = await supabase
    .from("personal_board_tasks")
    .select("id")
    .eq("id", parsed.taskId)
    .eq("user_id", userId)
    .eq("is_archived", false)
    .maybeSingle();

  if (taskError || !task) {
    throw new Error(taskError?.message ?? "Личная задача не найдена");
  }

  const { error } = await supabase.from("personal_board_comments").insert({
    user_id: userId,
    task_id: parsed.taskId,
    content: parsed.content
  });

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/tasks");
}

const defaultTeamBoardColumns = [
  { title: "Идеи", color: "#64748b" },
  { title: "В работе", color: "#3478d4" },
  { title: "Ждёт", color: "#d9822b" },
  { title: "Готово", color: "#21835f" }
];

export async function createTeamBoardAction(formData: FormData) {
  const { supabase, userId } = await requireUser();
  const parsed = teamBoardSchema.parse({
    teamId: formData.get("teamId"),
    title: formData.get("title"),
    description: formData.get("description")
  });

  await requireTeamAdmin(supabase, userId, parsed.teamId);

  const { data: board, error: boardError } = await supabase
    .from("team_boards")
    .insert({
      team_id: parsed.teamId,
      created_by: userId,
      title: parsed.title,
      description: parsed.description || null
    })
    .select("id")
    .single();

  if (boardError || !board) {
    throw new Error(boardError?.message ?? "Не удалось создать доску");
  }

  const { error: columnsError } = await supabase.from("team_board_columns").insert(
    defaultTeamBoardColumns.map((column, index) => ({
      board_id: board.id,
      title: column.title,
      color: column.color,
      sort_order: index
    }))
  );

  if (columnsError) {
    throw new Error(columnsError.message);
  }

  revalidatePath("/team");
  revalidatePath("/team/board");
  redirect(`/team/board?team=${parsed.teamId}&board=${board.id}`);
}

export async function createTeamBoardTaskAction(formData: FormData) {
  const { supabase, userId } = await requireUser();
  const parsed = teamBoardTaskSchema.parse({
    teamId: formData.get("teamId"),
    boardId: formData.get("boardId"),
    columnId: formData.get("columnId"),
    title: formData.get("title"),
    description: formData.get("description"),
    priority: formData.get("priority") || "medium",
    assigneeId: formData.get("assigneeId"),
    dueDate: formData.get("dueDate")
  });

  await requireTeamBoardMember(supabase, userId, parsed.teamId, parsed.boardId);

  const { data: column, error: columnError } = await supabase
    .from("team_board_columns")
    .select("id")
    .eq("id", parsed.columnId)
    .eq("board_id", parsed.boardId)
    .maybeSingle();

  if (columnError || !column) {
    throw new Error(columnError?.message ?? "Колонка не найдена на этой доске.");
  }

  const assigneeId = parsed.assigneeId || null;
  if (assigneeId) {
    const { data: assignee, error: assigneeError } = await supabase
      .from("team_members")
      .select("user_id")
      .eq("team_id", parsed.teamId)
      .eq("user_id", assigneeId)
      .eq("status", "active")
      .maybeSingle();

    if (assigneeError || !assignee) {
      throw new Error(assigneeError?.message ?? "Исполнителя нет в этой команде.");
    }
  }

  const { error } = await supabase.from("team_board_tasks").insert({
    board_id: parsed.boardId,
    column_id: parsed.columnId,
    created_by: userId,
    assignee_id: assigneeId,
    title: parsed.title,
    description: parsed.description || null,
    priority: parsed.priority,
    due_date: parsed.dueDate ? dateKeySchema.parse(parsed.dueDate) : null,
    sort_order: Date.now()
  });

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/team/board");
}

export async function moveTeamBoardTaskAction(formData: FormData) {
  const { supabase, userId } = await requireUser();
  const parsed = teamBoardTaskMoveSchema.parse({
    teamId: formData.get("teamId"),
    boardId: formData.get("boardId"),
    taskId: formData.get("taskId"),
    columnId: formData.get("columnId")
  });

  await requireTeamBoardMember(supabase, userId, parsed.teamId, parsed.boardId);

  const { data: column, error: columnError } = await supabase
    .from("team_board_columns")
    .select("id")
    .eq("id", parsed.columnId)
    .eq("board_id", parsed.boardId)
    .maybeSingle();

  if (columnError || !column) {
    throw new Error(columnError?.message ?? "Колонка не найдена на этой доске.");
  }

  const { error } = await supabase
    .from("team_board_tasks")
    .update({ column_id: parsed.columnId, sort_order: Date.now() })
    .eq("id", parsed.taskId)
    .eq("board_id", parsed.boardId);

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/team/board");
}

export async function addTeamBoardCommentAction(formData: FormData) {
  const { supabase, userId } = await requireUser();
  const parsed = teamBoardCommentSchema.parse({
    teamId: formData.get("teamId"),
    boardId: formData.get("boardId"),
    taskId: formData.get("taskId"),
    content: formData.get("content")
  });

  await requireTeamBoardMember(supabase, userId, parsed.teamId, parsed.boardId);

  const { data: task, error: taskError } = await supabase
    .from("team_board_tasks")
    .select("id")
    .eq("id", parsed.taskId)
    .eq("board_id", parsed.boardId)
    .maybeSingle();

  if (taskError || !task) {
    throw new Error(taskError?.message ?? "Задача не найдена на этой доске.");
  }

  const { error } = await supabase.from("team_board_comments").insert({
    task_id: task.id,
    author_id: userId,
    content: parsed.content
  });

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/team/board");
}

async function requirePersonalBoardAccess(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  boardId: string
) {
  const { data: board, error } = await supabase
    .from("personal_boards")
    .select("id")
    .eq("id", boardId)
    .eq("user_id", userId)
    .eq("is_archived", false)
    .maybeSingle();

  if (error || !board) {
    throw new Error(error?.message ?? "Личная доска не найдена");
  }

  return board;
}

async function requirePersonalBoardColumn(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  boardId: string,
  columnId: string
) {
  const { data: column, error } = await supabase
    .from("personal_board_columns")
    .select("id, title")
    .eq("id", columnId)
    .eq("board_id", boardId)
    .eq("user_id", userId)
    .maybeSingle();

  if (error || !column) {
    throw new Error(error?.message ?? "Колонка не найдена на личной доске");
  }

  return column;
}

function isDoneColumn(title: string) {
  const normalized = title.trim().toLowerCase();
  return normalized === "готово" || normalized === "done";
}

async function requireTeamAdmin(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  teamId: string
) {
  const { data: membership, error } = await supabase
    .from("team_members")
    .select("role")
    .eq("team_id", teamId)
    .eq("user_id", userId)
    .eq("status", "active")
    .maybeSingle();

  if (error || !membership || !["owner", "admin"].includes(membership.role)) {
    throw new Error(error?.message ?? "Недостаточно прав для управления командными инициативами.");
  }
}

async function requireTeamBoardMember(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  teamId: string,
  boardId: string
) {
  const [{ data: board, error: boardError }, membership] = await Promise.all([
    supabase.from("team_boards").select("id").eq("id", boardId).eq("team_id", teamId).maybeSingle(),
    requireTeamMember(supabase, userId, teamId)
  ]);

  if (boardError || !board) {
    throw new Error(boardError?.message ?? "Доска не найдена в этой команде.");
  }

  return membership;
}

async function requireTeamMember(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  teamId: string
) {
  const { data: membership, error } = await supabase
    .from("team_members")
    .select("role")
    .eq("team_id", teamId)
    .eq("user_id", userId)
    .eq("status", "active")
    .maybeSingle();

  if (error || !membership) {
    throw new Error(error?.message ?? "Вы не состоите в этой команде.");
  }

  return membership;
}

function getLeaveTeamErrorMessage(message?: string) {
  if (message?.includes("OWNER_CANNOT_LEAVE")) {
    return "Владелец не может выйти из команды. Сначала передайте владение или удалите команду.";
  }

  if (message?.includes("AUTH_REQUIRED")) {
    return "Войдите, чтобы выйти из команды";
  }

  return "Не удалось выйти из команды";
}

export async function upsertGoalAction(formData: FormData) {
  const { supabase, userId } = await requireUser();
  const parsed = goalSchema.parse({
    id: String(formData.get("id") ?? "") || undefined,
    title: formData.get("title"),
    description: formData.get("description"),
    type: formData.get("type"),
    status: formData.get("status"),
    priority: formData.get("priority"),
    startDate: formData.get("startDate"),
    dueDate: formData.get("dueDate"),
    taskIds: formData.getAll("taskIds")
  });
  const goalFields = {
    user_id: userId,
    title: parsed.title,
    description: parsed.description || null,
    type: parsed.type,
    status: parsed.status,
    priority: parsed.priority,
    start_date: parsed.startDate || null,
    due_date: parsed.dueDate || null
  };
  const { data: goal, error } = parsed.id
    ? await supabase
        .from("goals")
        .update({
          title: goalFields.title,
          description: goalFields.description,
          type: goalFields.type,
          status: goalFields.status,
          priority: goalFields.priority,
          start_date: goalFields.start_date,
          due_date: goalFields.due_date
        })
        .eq("id", parsed.id)
        .eq("user_id", userId)
        .select("id")
        .single()
    : await supabase.from("goals").insert(goalFields).select("id").single();

  if (error || !goal) {
    throw new Error(error?.message ?? "Цель не сохранена");
  }

  await syncGoalTasks(goal.id, parsed.taskIds);
  revalidateTracker();
}

export async function archiveGoalAction(formData: FormData) {
  const { supabase, userId } = await requireUser();
  const goalId = String(formData.get("goalId") ?? "");

  const { error } = await supabase
    .from("goals")
    .update({ status: "archived" })
    .eq("id", goalId)
    .eq("user_id", userId);

  if (error) {
    throw new Error(error.message);
  }

  revalidateTracker();
}

export async function deleteGoalAction(formData: FormData) {
  const { supabase, userId } = await requireUser();
  const goalId = String(formData.get("goalId") ?? "");

  const { error } = await supabase
    .from("goals")
    .delete()
    .eq("id", goalId)
    .eq("user_id", userId);

  if (error) {
    throw new Error(error.message);
  }

  revalidateTracker();
}

export async function upsertNoteAction(formData: FormData) {
  const { supabase, userId } = await requireUser();
  const parsed = noteSchema.parse({
    id: String(formData.get("id") ?? "") || undefined,
    title: formData.get("title"),
    content: formData.get("content"),
    tags: formData.get("tags"),
    monthId: formData.get("monthId"),
    taskId: formData.get("taskId"),
    goalId: formData.get("goalId"),
    date: formData.get("date")
  });
  const noteFields = {
    user_id: userId,
    title: parsed.title || null,
    content: parsed.content,
    tags: parseTags(parsed.tags),
    month_id: parsed.monthId || null,
    task_id: parsed.taskId || null,
    goal_id: parsed.goalId || null,
    date: parsed.date || null
  };
  const { error } = parsed.id
    ? await supabase
        .from("notes")
        .update({
          title: noteFields.title,
          content: noteFields.content,
          tags: noteFields.tags,
          month_id: noteFields.month_id,
          task_id: noteFields.task_id,
          goal_id: noteFields.goal_id,
          date: noteFields.date
        })
        .eq("id", parsed.id)
        .eq("user_id", userId)
    : await supabase.from("notes").insert(noteFields);

  if (error) {
    throw new Error(error.message);
  }

  revalidateTracker();
}

export async function deleteNoteAction(formData: FormData) {
  const { supabase, userId } = await requireUser();
  const noteId = String(formData.get("noteId") ?? "");

  const { error } = await supabase
    .from("notes")
    .delete()
    .eq("id", noteId)
    .eq("user_id", userId);

  if (error) {
    throw new Error(error.message);
  }

  revalidateTracker();
}

export async function importJsonAction(formData: FormData) {
  const { supabase, userId } = await requireUser();
  const parsed = importPreviewSchema.parse({
    payload: formData.get("payload")
  });

  if (formData.get("confirmImport") !== "on") {
    throw new Error("Подтвердите импорт, чтобы изменить данные.");
  }

  const rateLimit = await consumeRateLimit({
    scope: "data-import",
    identifier: userId,
    maxRequests: 3,
    windowSeconds: 3600
  });

  if (!rateLimit.allowed) {
    throw new Error(getRateLimitMessage(rateLimit.retryAfter));
  }

  let payload: ImportedPayload;

  try {
    payload = JSON.parse(parsed.payload) as ImportedPayload;
  } catch {
    throw new Error("JSON не удалось прочитать.");
  }

  const categories = Array.isArray(payload.categories) ? payload.categories : [];
  const tasks = Array.isArray(payload.tasks) ? payload.tasks : [];
  const months = Array.isArray(payload.months) ? payload.months : [];
  const goals = Array.isArray(payload.goals) ? payload.goals : [];
  const goalTasks = Array.isArray(payload.goal_tasks) ? payload.goal_tasks : [];
  const plans = Array.isArray(payload.daily_plans) ? payload.daily_plans : [];
  const facts = Array.isArray(payload.daily_facts) ? payload.daily_facts : [];
  const notes = Array.isArray(payload.notes) ? payload.notes : [];
  const planningRules = Array.isArray(payload.task_planning_rules) ? payload.task_planning_rules : [];
  const dailyNotes = Array.isArray(payload.daily_notes) ? payload.daily_notes : [];
  const importedPreferences = payload.user_preferences;
  const importedPeriodKeys = new Set(
    months
      .map((month) => {
        const year = asNumber(month.year, 0);
        const monthNumber = asNumber(month.month, 0);
        return year && monthNumber ? `${year}-${monthNumber}` : null;
      })
      .filter((key): key is string => Boolean(key))
  );

  if (importedPeriodKeys.size > 0) {
    const { data: existingMonths, error: existingMonthsError } = await supabase
      .from("months")
      .select("year, month, status")
      .eq("user_id", userId);

    if (existingMonthsError) {
      throw new Error(existingMonthsError.message);
    }

    const protectedPeriod = (existingMonths ?? []).find(
      (month) => importedPeriodKeys.has(`${month.year}-${month.month}`) && month.status !== "draft"
    );

    if (protectedPeriod) {
      throw new Error(
        `Импорт не изменяет утвержденные и закрытые месяцы. Сначала разблокируйте ${getMonthTitle(protectedPeriod.year, protectedPeriod.month)}.`
      );
    }
  }

  if (importedPreferences) {
    const { error } = await supabase
      .from("user_preferences")
      .upsert(
        {
          user_id: userId,
          daily_reminder_enabled: asBoolean(importedPreferences.daily_reminder_enabled, false),
          daily_reminder_time: asString(importedPreferences.daily_reminder_time, "21:00"),
          risk_alerts_enabled: asBoolean(importedPreferences.risk_alerts_enabled, true),
          theme: parseThemePreference(asString(importedPreferences.theme)),
          default_month_target: asNumber(importedPreferences.default_month_target, 0.8)
        },
        { onConflict: "user_id" }
      );

    if (error) {
      throw new Error(error.message);
    }
  }

  const categoryMap = new Map<string, string>();
  const taskMap = new Map<string, string>();
  const taskWeights = new Map<string, number>();
  const monthMap = new Map<string, string>();
  const goalMap = new Map<string, string>();
  const monthStatuses: {
    id: string;
    status: "draft" | "approved" | "closed";
    approved_at: string | null;
    closed_at: string | null;
  }[] = [];

  for (const category of categories) {
    const name = asString(category.name);

    if (!name) {
      continue;
    }

    const { data, error } = await supabase
      .from("categories")
      .upsert(
        {
          user_id: userId,
          name,
          color: asString(category.color, "#2563eb"),
          sort_order: asNumberOrNull(category.sort_order)
        },
        { onConflict: "user_id,name" }
      )
      .select("id")
      .single();

    if (error || !data) {
      throw new Error(error?.message ?? "Категория не импортирована");
    }

    const oldId = asString(category.id);
    if (oldId) {
      categoryMap.set(oldId, data.id);
    }
  }

  for (const task of tasks) {
    const title = asString(task.title);

    if (!title) {
      continue;
    }

    const oldCategoryId = asString(task.category_id);
    const { data, error } = await supabase
      .from("tasks")
      .upsert(
        {
          user_id: userId,
          category_id: oldCategoryId ? categoryMap.get(oldCategoryId) ?? null : null,
          title,
          description: asNullableString(task.description),
          weight: asNumber(task.weight, 1),
          is_active: asBoolean(task.is_active, true)
        },
        { onConflict: "user_id,title" }
      )
      .select("id")
      .single();

    if (error || !data) {
      throw new Error(error?.message ?? "Задача не импортирована");
    }

    const oldId = asString(task.id);
    if (oldId) {
      taskMap.set(oldId, data.id);
    }
    taskWeights.set(data.id, asNumber(task.weight, 1));
  }

  for (const month of months) {
    const year = asNumber(month.year, 0);
    const monthNumber = asNumber(month.month, 0);

    if (!year || !monthNumber) {
      continue;
    }

    const originalStatus = parseMonthStatus(asString(month.status));
    const { data, error } = await supabase
      .from("months")
      .upsert(
        {
          user_id: userId,
          year,
          month: monthNumber,
          title: asString(month.title, getMonthTitle(year, monthNumber)),
          status: "draft",
          target_percent: asNumber(month.target_percent, 0.8),
          approved_at: null,
          closed_at: null
        },
        { onConflict: "user_id,year,month" }
      )
      .select("id")
      .single();

    if (error || !data) {
      throw new Error(error?.message ?? "Месяц не импортирован");
    }

    const oldId = asString(month.id);
    if (oldId) {
      monthMap.set(oldId, data.id);
    }
    monthStatuses.push({
      id: data.id,
      status: originalStatus,
      approved_at: asNullableString(month.approved_at),
      closed_at: asNullableString(month.closed_at)
    });
  }

  for (const goal of goals) {
    const title = asString(goal.title);

    if (!title) {
      continue;
    }

    const type = parseGoalType(asString(goal.type));
    const { data: matchingGoals, error: matchingGoalsError } = await supabase
      .from("goals")
      .select("id")
      .eq("user_id", userId)
      .eq("title", title)
      .eq("type", type)
      .limit(1);

    if (matchingGoalsError) {
      throw new Error(matchingGoalsError.message);
    }

    const goalPayload = {
      title,
      description: asNullableString(goal.description),
      type,
      status: parseGoalStatus(asString(goal.status)),
      priority: parseGoalPriority(asString(goal.priority)),
      start_date: asNullableString(goal.start_date),
      due_date: asNullableString(goal.due_date)
    };
    const existingGoal = matchingGoals?.[0] ?? null;
    const { data, error } = existingGoal
      ? await supabase
          .from("goals")
          .update(goalPayload)
          .eq("id", existingGoal.id)
          .eq("user_id", userId)
          .select("id")
          .single()
      : await supabase.from("goals").insert({ user_id: userId, ...goalPayload }).select("id").single();

    if (error || !data) {
      throw new Error(error?.message ?? "Цель не импортирована");
    }

    const oldId = asString(goal.id);
    if (oldId) {
      goalMap.set(oldId, data.id);
    }
  }

  const mappedPlans = plans
    .map((plan) => {
      const monthId = monthMap.get(asString(plan.month_id));
      const taskId = taskMap.get(asString(plan.task_id));

      if (!monthId || !taskId) {
        return null;
      }

      const plannedValue = asNumber(plan.planned_value, 0);
      return {
        month_id: monthId,
        task_id: taskId,
        date: asString(plan.date),
        planned_value: plannedValue,
        planned_score: calculateScore(plannedValue, taskWeights.get(taskId) ?? 1),
        locked: false
      };
    })
    .filter((plan): plan is NonNullable<typeof plan> => Boolean(plan?.date));

  if (mappedPlans.length > 0) {
    const { error } = await supabase
      .from("daily_plans")
      .upsert(mappedPlans, { onConflict: "month_id,task_id,date" });

    if (error) {
      throw new Error(error.message);
    }
  }

  const mappedFacts = facts
    .map((fact) => {
      const monthId = monthMap.get(asString(fact.month_id));
      const taskId = taskMap.get(asString(fact.task_id));

      if (!monthId || !taskId) {
        return null;
      }

      const actualValue = asNumber(fact.actual_value, 0);
      return {
        month_id: monthId,
        task_id: taskId,
        date: asString(fact.date),
        actual_value: actualValue,
        actual_score: calculateScore(actualValue, taskWeights.get(taskId) ?? 1),
        note: asNullableString(fact.note)
      };
    })
    .filter((fact): fact is NonNullable<typeof fact> => Boolean(fact?.date));

  if (mappedFacts.length > 0) {
    const { error } = await supabase
      .from("daily_facts")
      .upsert(mappedFacts, { onConflict: "month_id,task_id,date" });

    if (error) {
      throw new Error(error.message);
    }
  }

  const mappedRules = planningRules
    .map((rule) => {
      const taskId = taskMap.get(asString(rule.task_id));

      if (!taskId) {
        return null;
      }

      return {
        user_id: userId,
        task_id: taskId,
        mode: parsePlanningMode(asString(rule.mode)),
        weekdays: asNumberArray(rule.weekdays),
        specific_dates: asStringArray(rule.specific_dates),
        times_per_month: asNumberOrNull(rule.times_per_month),
        default_planned_value: asNumber(rule.default_planned_value, 1)
      };
    })
    .filter((rule): rule is NonNullable<typeof rule> => Boolean(rule));

  if (mappedRules.length > 0) {
    const { error } = await supabase
      .from("task_planning_rules")
      .upsert(mappedRules, { onConflict: "user_id,task_id" });

    if (error) {
      throw new Error(error.message);
    }
  }

  const mappedGoalTasks = goalTasks
    .map((goalTask) => {
      const goalId = goalMap.get(asString(goalTask.goal_id));
      const taskId = taskMap.get(asString(goalTask.task_id));

      if (!goalId || !taskId) {
        return null;
      }

      return {
        goal_id: goalId,
        task_id: taskId
      };
    })
    .filter((goalTask): goalTask is NonNullable<typeof goalTask> => Boolean(goalTask));

  if (mappedGoalTasks.length > 0) {
    const { error } = await supabase
      .from("goal_tasks")
      .upsert(mappedGoalTasks, { onConflict: "goal_id,task_id" });

    if (error) {
      throw new Error(error.message);
    }
  }

  const mappedNotes = notes
    .map((note) => ({
      user_id: userId,
      month_id: monthMap.get(asString(note.month_id)) ?? null,
      task_id: taskMap.get(asString(note.task_id)) ?? null,
      goal_id: goalMap.get(asString(note.goal_id)) ?? null,
      date: asNullableString(note.date),
      title: asNullableString(note.title),
      content: asString(note.content),
      tags: asStringArray(note.tags)
    }))
    .filter((note) => note.content);

  for (const note of mappedNotes) {
    let existingNoteQuery = supabase
      .from("notes")
      .select("id")
      .eq("user_id", userId)
      .eq("content", note.content)
      .limit(1);

    existingNoteQuery = note.date ? existingNoteQuery.eq("date", note.date) : existingNoteQuery.is("date", null);
    existingNoteQuery = note.title ? existingNoteQuery.eq("title", note.title) : existingNoteQuery.is("title", null);

    const { data: existingNotes, error: existingNotesError } = await existingNoteQuery;

    if (existingNotesError) {
      throw new Error(existingNotesError.message);
    }

    if (!existingNotes?.length) {
      const { error } = await supabase.from("notes").insert(note);

      if (error) {
        throw new Error(error.message);
      }
    }
  }

  const mappedDailyNotes = dailyNotes
    .map((note) => {
      const monthId = monthMap.get(asString(note.month_id));

      if (!monthId) {
        return null;
      }

      return {
        user_id: userId,
        month_id: monthId,
        date: asString(note.date),
        content: asString(note.content),
        mood: asNullableString(note.mood),
        energy: asNumberOrNull(note.energy)
      };
    })
    .filter((note): note is NonNullable<typeof note> => Boolean(note?.date));

  if (mappedDailyNotes.length > 0) {
    const { error } = await supabase
      .from("daily_notes")
      .upsert(mappedDailyNotes, { onConflict: "user_id,date" });

    if (error) {
      throw new Error(error.message);
    }
  }

  for (const month of monthStatuses) {
    const { error } = await supabase
      .from("months")
      .update({
        status: month.status,
        approved_at: month.approved_at,
        closed_at: month.closed_at
      })
      .eq("id", month.id)
      .eq("user_id", userId);

    if (error) {
      throw new Error(error.message);
    }
  }

  revalidateTracker();
  redirect("/settings?import=done");
}

async function requireUser() {
  if (!isSupabaseConfigured()) {
    throw new Error("Supabase не настроен. Заполните .env.local.");
  }

  const supabase = await createClient();
  const {
    data: { user },
    error
  } = await supabase.auth.getUser();

  if (error || !user) {
    redirect("/login");
  }

  return { supabase, userId: user.id };
}

async function getRequestOrigin() {
  const headersList = await headers();
  const host = headersList.get("host") ?? "localhost:3000";
  const forwardedProto = headersList.get("x-forwarded-proto");
  const protocol = forwardedProto ?? (host.includes("localhost") ? "http" : "https");

  return `${protocol}://${host}`;
}

async function syncGoalTasks(goalId: string, taskIds: string[]) {
  const supabase = await createClient();
  const { error: deleteError } = await supabase
    .from("goal_tasks")
    .delete()
    .eq("goal_id", goalId);

  if (deleteError) {
    throw new Error(deleteError.message);
  }

  const uniqueTaskIds = Array.from(new Set(taskIds));

  if (uniqueTaskIds.length === 0) {
    return;
  }

  const { error: insertError } = await supabase.from("goal_tasks").insert(
    uniqueTaskIds.map((taskId) => ({
      goal_id: goalId,
      task_id: taskId
    }))
  );

  if (insertError) {
    throw new Error(insertError.message);
  }
}

function parseTags(value?: string) {
  if (!value) {
    return [];
  }

  return value
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean);
}

function asString(value: unknown, fallback = "") {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function getSafeNextPath(value: FormDataEntryValue | null) {
  if (typeof value !== "string" || !value.startsWith("/") || value.startsWith("//")) {
    return null;
  }

  return value.startsWith("/team/invite/") ? value : null;
}

function getRateLimitMessage(retryAfter: number) {
  const minutes = Math.ceil(retryAfter / 60);
  return minutes > 1
    ? `Слишком много попыток. Повторите через ${minutes} мин.`
    : "Слишком много попыток. Повторите через минуту.";
}

function asNullableString(value: unknown) {
  const text = asString(value);
  return text || null;
}

function asNumber(value: unknown, fallback: number) {
  const number = typeof value === "number" ? value : Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function asNumberOrNull(value: unknown) {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function asBoolean(value: unknown, fallback: boolean) {
  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value === "string") {
    return value === "true";
  }

  return fallback;
}

function asStringArray(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => asString(item))
    .filter(Boolean);
}

function asNumberArray(value: unknown) {
  if (!Array.isArray(value)) {
    return null;
  }

  const values = value
    .map((item) => Number(item))
    .filter((item) => Number.isInteger(item));

  return values.length ? values : null;
}

function parseMonthStatus(value: string): "draft" | "approved" | "closed" {
  if (value === "approved" || value === "closed") {
    return value;
  }

  return "draft";
}

function parseGoalType(value: string): "long_term" | "monthly" | "weekly" {
  if (value === "monthly" || value === "weekly") {
    return value;
  }

  return "long_term";
}

function parseGoalStatus(value: string): "active" | "completed" | "paused" | "archived" {
  if (value === "completed" || value === "paused" || value === "archived") {
    return value;
  }

  return "active";
}

function parseGoalPriority(value: string): "low" | "medium" | "high" {
  if (value === "low" || value === "high") {
    return value;
  }

  return "medium";
}

function parsePlanningMode(value: string): PlanningRuleMode {
  if (
    value === "weekdays" ||
    value === "weekends" ||
    value === "specific_weekdays" ||
    value === "specific_dates" ||
    value === "n_times_per_month" ||
    value === "manual"
  ) {
    return value;
  }

  return "daily";
}

function parseThemePreference(value: string): "light" | "dark" | "system" {
  if (value === "light" || value === "dark") {
    return value;
  }

  return "system";
}

function revalidateTracker() {
  revalidatePath("/dashboard");
  revalidatePath("/planner");
  revalidatePath("/daily");
  revalidatePath("/calendar");
  revalidatePath("/analytics");
  revalidatePath("/weekly");
  revalidatePath("/monthly-report");
  revalidatePath("/history");
  revalidatePath("/goals");
  revalidatePath("/notes");
  revalidatePath("/checks");
  revalidatePath("/settings");
}
