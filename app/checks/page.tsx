import Link from "next/link";
import { redirect } from "next/navigation";
import { AlertTriangle, CheckCircle2, ShieldAlert } from "lucide-react";
import { lockApprovedPlansAction } from "@/app/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { EmptyMonthState, ErrorState } from "@/components/shared/page-state";
import { SetupNotice } from "@/components/shared/setup-notice";
import { runDataQualityChecks } from "@/lib/checks";
import { loadTrackerData } from "@/lib/supabase/data";
import { cn } from "@/lib/utils";

export default async function ChecksPage({
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

  const { selectedMonth, months, tasks, plans, facts } = result.data;

  if (!selectedMonth) {
    return (
      <div>
        <EmptyMonthState />
      </div>
    );
  }

  const checks = runDataQualityChecks({
    month: selectedMonth,
    tasks,
    plans,
    facts
  });
  const criticalCount = checks.filter((check) => check.status === "critical").length;
  const warningCount = checks.filter((check) => check.status === "warning").length;

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-normal">Проверки данных</h1>
          <p className="text-sm text-muted-foreground">
            Контроль качества планов, фактов, задач и блокировок.
          </p>
        </div>
        <form className="grid gap-3 sm:grid-cols-[240px_auto]" action="/checks">
          <div className="space-y-2">
            <Label>Месяц</Label>
            <Select name="month" defaultValue={selectedMonth.id}>
              {months.map((month) => (
                <option key={month.id} value={month.id}>
                  {month.title}
                </option>
              ))}
            </Select>
          </div>
          <Button type="submit" className="self-end">Проверить</Button>
        </form>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <Card>
          <CardContent className="p-4">
            <div className="text-sm text-muted-foreground">Критично</div>
            <div className="text-3xl font-semibold text-destructive">{criticalCount}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-sm text-muted-foreground">Внимание</div>
            <div className="text-3xl font-semibold text-warning">{warningCount}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-sm text-muted-foreground">Чисто</div>
            <div className="text-3xl font-semibold text-success">
              {checks.filter((check) => check.status === "clean").length}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {checks.map((check) => {
          const Icon = check.status === "clean" ? CheckCircle2 : check.status === "warning" ? AlertTriangle : ShieldAlert;

          return (
            <Card
              key={check.id}
              className={cn(
                check.status === "clean" && "border-success/40",
                check.status === "warning" && "border-warning/50 bg-warning/10",
                check.status === "critical" && "border-destructive/50 bg-destructive/10"
              )}
            >
              <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0">
                <div className="min-w-0">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Icon className="h-4 w-4 shrink-0" />
                    {check.title}
                  </CardTitle>
                  <p className="mt-1 text-sm text-muted-foreground">{check.summary}</p>
                </div>
                <Badge variant={check.status === "clean" ? "success" : check.status === "warning" ? "warning" : "destructive"}>
                  {check.status === "clean" ? "✅ чисто" : check.status === "warning" ? "🟡 внимание" : "🔴 критично"}
                </Badge>
              </CardHeader>
              <CardContent className="space-y-3">
                {check.issues.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Проблем не найдено.</p>
                ) : (
                  <div className="space-y-2">
                    {check.issues.slice(0, 8).map((issue) => (
                      <div key={issue.id} className="flex flex-col gap-2 rounded-md border bg-card/80 p-3 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                          <div className="font-medium">{issue.title}</div>
                          <div className="text-sm text-muted-foreground">{issue.description}</div>
                        </div>
                        <div className="flex gap-2">
                          {issue.fixAction === "lock_plans" ? (
                            <form action={lockApprovedPlansAction}>
                              <input type="hidden" name="monthId" value={selectedMonth.id} />
                              <Button type="submit" size="sm" variant="secondary">Исправить</Button>
                            </form>
                          ) : null}
                          {issue.href ? (
                            <Button asChild size="sm" variant="outline">
                              <Link href={issue.href}>Открыть</Link>
                            </Button>
                          ) : null}
                        </div>
                      </div>
                    ))}
                    {check.issues.length > 8 ? (
                      <p className="text-sm text-muted-foreground">
                        Еще {check.issues.length - 8} записей. Начните с первых проблем выше.
                      </p>
                    ) : null}
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
