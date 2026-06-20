import { NextRequest, NextResponse } from "next/server";
import { consumeRateLimit } from "@/lib/security/rate-limit";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";
import { entityIdSchema } from "@/lib/validators/tracker";

export async function GET(request: NextRequest) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: "Supabase не настроен" }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Требуется вход" }, { status: 401 });
  }

  const rateLimit = await consumeRateLimit({
    scope: "data-export",
    identifier: user.id,
    maxRequests: 10,
    windowSeconds: 3600
  });

  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: "Слишком много экспортов. Повторите позже." },
      { status: 429, headers: { "retry-after": String(rateLimit.retryAfter) } }
    );
  }

  const monthId = entityIdSchema.safeParse(request.nextUrl.searchParams.get("month"));

  if (!monthId.success) {
    return NextResponse.json({ error: "Укажите месяц" }, { status: 400 });
  }

  const { data: month, error: monthError } = await supabase
    .from("months")
    .select("*")
    .eq("id", monthId.data)
    .eq("user_id", user.id)
    .single();

  if (monthError || !month) {
    return NextResponse.json({ error: monthError?.message ?? "Месяц не найден" }, { status: 404 });
  }

  const [preferences, categories, tasks, goals, goalTasks, notes, planningRules, dailyNotes, plans, facts] = await Promise.all([
    supabase.from("user_preferences").select("*").eq("user_id", user.id).maybeSingle(),
    supabase.from("categories").select("*").eq("user_id", user.id).order("sort_order"),
    supabase.from("tasks").select("*").eq("user_id", user.id).order("created_at"),
    supabase.from("goals").select("*").eq("user_id", user.id).order("created_at"),
    supabase.from("goal_tasks").select("*"),
    supabase.from("notes").select("*").eq("user_id", user.id).eq("month_id", month.id).order("created_at"),
    supabase.from("task_planning_rules").select("*").eq("user_id", user.id).order("created_at"),
    supabase.from("daily_notes").select("*").eq("user_id", user.id).eq("month_id", month.id).order("date"),
    supabase.from("daily_plans").select("*").eq("month_id", month.id).order("date"),
    supabase.from("daily_facts").select("*").eq("month_id", month.id).order("date")
  ]);

  const payload = {
    exported_at: new Date().toISOString(),
    scope: "month",
    user_preferences: preferences.data,
    categories: categories.data ?? [],
    tasks: tasks.data ?? [],
    months: [month],
    goals: goals.data ?? [],
    goal_tasks: goalTasks.data ?? [],
    notes: notes.data ?? [],
    task_planning_rules: planningRules.data ?? [],
    daily_notes: dailyNotes.data ?? [],
    daily_plans: plans.data ?? [],
    daily_facts: facts.data ?? []
  };

  return new NextResponse(JSON.stringify(payload, null, 2), {
    headers: {
      "content-type": "application/json; charset=utf-8",
      "content-disposition": `attachment; filename="habit-tracker-${month.year}-${String(month.month).padStart(2, "0")}.json"`,
      "cache-control": "private, no-store"
    }
  });
}
