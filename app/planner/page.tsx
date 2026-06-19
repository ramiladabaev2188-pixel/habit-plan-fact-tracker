import { redirect } from "next/navigation";
import { PlannerWorkspace } from "@/components/planner/planner-workspace";
import { ErrorState } from "@/components/shared/page-state";
import { SetupNotice } from "@/components/shared/setup-notice";
import { loadTrackerData } from "@/lib/supabase/data";

export default async function PlannerPage({
  searchParams
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  const params = await searchParams;
  const result = await loadTrackerData(params.month);

  if (!result.configured) {
    return <SetupNotice />;
  }

  if (!result.user) {
    redirect("/login");
  }

  if (result.error || !result.data) {
    return <ErrorState message={result.error ?? "Неизвестная ошибка"} />;
  }

  return (
    <div className="app-page app-page-with-rail planner-page">
      <div className="workspace-header">
        <div>
          <div className="page-kicker">Конструктор месяца</div>
          <h1 className="workspace-title mt-1">Планирование</h1>
          <p className="workspace-subtitle">
            Месяцы, категории, задачи, веса и план по дням.
          </p>
        </div>
      </div>
      <PlannerWorkspace
        months={result.data.months}
        selectedMonth={result.data.selectedMonth}
        categories={result.data.categories}
        tasks={result.data.tasks}
        plans={result.data.plans}
      />
    </div>
  );
}
