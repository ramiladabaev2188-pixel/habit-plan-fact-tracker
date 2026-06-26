import { NextResponse } from "next/server";
import { consumeRateLimit } from "@/lib/security/rate-limit";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
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

  const [profile, preferences, lifeAreas, categories, tasks, months, goals, goalTasks, notes, planningRules, dailyNotes] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", user.id).maybeSingle(),
    supabase.from("user_preferences").select("*").eq("user_id", user.id).maybeSingle(),
    supabase.from("life_areas").select("*").eq("user_id", user.id).order("sort_order"),
    supabase.from("categories").select("*").eq("user_id", user.id).order("sort_order"),
    supabase.from("tasks").select("*").eq("user_id", user.id).order("created_at"),
    supabase.from("months").select("*").eq("user_id", user.id).order("year").order("month"),
    supabase.from("goals").select("*").eq("user_id", user.id).order("created_at"),
    supabase.from("goal_tasks").select("*"),
    supabase.from("notes").select("*").eq("user_id", user.id).order("created_at"),
    supabase.from("task_planning_rules").select("*").eq("user_id", user.id).order("created_at"),
    supabase.from("daily_notes").select("*").eq("user_id", user.id).order("date")
  ]);

  const monthIds = (months.data ?? []).map((month) => month.id);
  const [plans, facts] = monthIds.length
    ? await Promise.all([
        supabase.from("daily_plans").select("*").in("month_id", monthIds).order("date"),
        supabase.from("daily_facts").select("*").in("month_id", monthIds).order("date")
      ])
    : [
        { data: [], error: null },
        { data: [], error: null }
      ];

  const payload = {
    exported_at: new Date().toISOString(),
    profile: profile.data,
    user_preferences: preferences.data,
    life_areas: lifeAreas.data ?? [],
    categories: categories.data ?? [],
    tasks: tasks.data ?? [],
    months: months.data ?? [],
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
      "content-disposition": `attachment; filename="habit-tracker-export-${new Date().toISOString().slice(0, 10)}.json"`,
      "cache-control": "private, no-store"
    }
  });
}
