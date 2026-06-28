import { NextRequest, NextResponse } from "next/server";
import { buildWeeklyMarkdown } from "@/lib/activity";
import { calculateWeeklyReport } from "@/lib/metrics";
import { loadTrackerData } from "@/lib/supabase/data";

export async function GET(request: NextRequest) {
  const monthId = request.nextUrl.searchParams.get("month") ?? undefined;
  const result = await loadTrackerData(monthId, { includeWeeklyReviews: true });

  if (!result.configured) {
    return new NextResponse("Supabase не настроен", { status: 500 });
  }

  if (!result.user) {
    return new NextResponse("Нужна авторизация", { status: 401 });
  }

  if (result.error || !result.data?.selectedMonth) {
    return new NextResponse(result.error ?? "Месяц не найден", { status: 400 });
  }

  const { selectedMonth, plans, facts, tasks, weeklyReviews } = result.data;
  const report = calculateWeeklyReport(selectedMonth, plans, facts, tasks);
  const markdown = buildWeeklyMarkdown(selectedMonth, report, weeklyReviews);

  return new NextResponse(markdown, {
    headers: {
      "Content-Type": "text/markdown; charset=utf-8",
      "Content-Disposition": `attachment; filename="weekly-${selectedMonth.year}-${String(selectedMonth.month).padStart(2, "0")}.md"`
    }
  });
}
