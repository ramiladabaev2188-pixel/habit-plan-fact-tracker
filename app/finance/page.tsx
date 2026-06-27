import { redirect } from "next/navigation";
import { upsertFinanceGoalAction, upsertFinanceSnapshotAction } from "@/app/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { ErrorState } from "@/components/shared/page-state";
import { SetupNotice } from "@/components/shared/setup-notice";
import { getTodayKey } from "@/lib/dates/month";
import { calculateFinanceSummary, formatMoney } from "@/lib/practical";
import { loadFinancePage, loadTrackerData } from "@/lib/supabase/data";
import { formatPercent } from "@/lib/utils";

export default async function FinancePage() {
  const [trackerResult, financeResult] = await Promise.all([
    loadTrackerData(undefined, { includeGoals: true }),
    loadFinancePage()
  ]);

  if (!trackerResult.configured) {
    return <SetupNotice />;
  }

  if (!trackerResult.user) {
    redirect("/login");
  }

  if (trackerResult.error || !trackerResult.data) {
    return <ErrorState message={trackerResult.error ?? "Неизвестная ошибка"} />;
  }

  if (financeResult.error) {
    return <ErrorState message={financeResult.error} />;
  }

  const { lifeAreas, goals } = trackerResult.data;
  const summary = calculateFinanceSummary(financeResult.snapshots, financeResult.goals);
  const today = getTodayKey();

  return (
    <div className="app-page space-y-6">
      <div className="workspace-header">
        <div>
          <div className="page-kicker">Личный контур</div>
          <h1 className="workspace-title mt-1">Финансы</h1>
          <p className="workspace-subtitle">
            Снимок доходов, расходов, накоплений и целей. Это не бухгалтерия, а быстрый финансовый радар.
          </p>
        </div>
        <Badge variant={summary.monthlyFreeCash >= 0 ? "success" : "destructive"}>
          {summary.monthlyFreeCash >= 0 ? "Поток положительный" : "Поток отрицательный"}
        </Badge>
      </div>

      <div className="grid gap-3 md:grid-cols-4">
        <Metric title="Накопления" value={formatMoney(summary.latest?.savings ?? 0)} />
        <Metric title="Долги" value={formatMoney(summary.latest?.debt_total ?? 0)} tone="bad" />
        <Metric title="Капитал" value={formatMoney(summary.netWorth)} />
        <Metric
          title="Подушка"
          value={summary.emergencyMonths === null ? "нет данных" : `${summary.emergencyMonths.toFixed(1)} мес.`}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_1fr]">
        <Card className="section-panel">
          <CardHeader>
            <CardTitle>Финансовый снимок</CardTitle>
            <CardDescription>Обновляйте раз в неделю или раз в месяц, чтобы видеть динамику.</CardDescription>
          </CardHeader>
          <CardContent>
            <form action={upsertFinanceSnapshotAction} className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="finance-date">Дата</Label>
                <Input id="finance-date" name="date" type="date" defaultValue={today} required />
              </div>
              <NumberField id="income" name="income" label="Доход" />
              <NumberField id="requiredExpenses" name="requiredExpenses" label="Обязательные расходы" />
              <NumberField id="optionalExpenses" name="optionalExpenses" label="Необязательные расходы" />
              <NumberField id="savings" name="savings" label="Накопления" />
              <NumberField id="debtTotal" name="debtTotal" label="Долги" />
              <NumberField id="investments" name="investments" label="Инвестиции" />
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="finance-comment">Комментарий</Label>
                <Textarea id="finance-comment" name="comment" placeholder="Что изменилось в деньгах" />
              </div>
              <div className="sm:col-span-2">
                <Button type="submit">Сохранить снимок</Button>
              </div>
            </form>
          </CardContent>
        </Card>

        <Card className="section-panel">
          <CardHeader>
            <CardTitle>Финансовая цель</CardTitle>
            <CardDescription>Свяжите цель со сферой или общей целью развития, если это полезно.</CardDescription>
          </CardHeader>
          <CardContent>
            <form action={upsertFinanceGoalAction} className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="finance-goal-title">Название</Label>
                <Input id="finance-goal-title" name="title" placeholder="Подушка 6 месяцев" required />
              </div>
              <NumberField id="targetAmount" name="targetAmount" label="Целевая сумма" required />
              <NumberField id="currentAmount" name="currentAmount" label="Текущая сумма" />
              <div className="space-y-2">
                <Label htmlFor="finance-goal-due">Дедлайн</Label>
                <Input id="finance-goal-due" name="dueDate" type="date" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="finance-goal-area">Сфера</Label>
                <Select id="finance-goal-area" name="lifeAreaId">
                  <option value="">Без сферы</option>
                  {lifeAreas.map((area) => (
                    <option key={area.id} value={area.id}>
                      {area.name}
                    </option>
                  ))}
                </Select>
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="finance-goal-link">Связь с целью</Label>
                <Select id="finance-goal-link" name="goalId">
                  <option value="">Без связи</option>
                  {goals.map((goal) => (
                    <option key={goal.id} value={goal.id}>
                      {goal.title}
                    </option>
                  ))}
                </Select>
              </div>
              <div className="sm:col-span-2">
                <Button type="submit">Сохранить цель</Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>

      <Card className="section-panel">
        <CardHeader>
          <CardTitle>Цели и темп</CardTitle>
          <CardDescription>Расчет показывает, сколько осталось и какой темп нужен.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {summary.goals.length ? (
            summary.goals.map((item) => (
              <div key={item.goal.id} className="rounded-lg border border-border/80 p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="font-semibold">{item.goal.title}</div>
                    <div className="mt-1 text-sm text-muted-foreground">
                      {formatMoney(item.goal.current_amount)} / {formatMoney(item.goal.target_amount)}
                    </div>
                  </div>
                  <Badge variant={item.percent >= 1 ? "over" : item.percent >= 0.5 ? "info" : "outline"}>
                    {formatPercent(item.percent)}
                  </Badge>
                </div>
                <Progress className="mt-3" value={Math.min(item.percent, 1) * 100} />
                <div className="mt-3 grid gap-2 text-sm text-muted-foreground sm:grid-cols-3">
                  <span>Осталось: {formatMoney(item.remaining)}</span>
                  <span>Нужно/мес.: {item.requiredPerMonth === null ? "нет дедлайна" : formatMoney(item.requiredPerMonth)}</span>
                  <span>Прогноз: {item.estimatedDate ?? "нужен положительный поток"}</span>
                </div>
              </div>
            ))
          ) : (
            <div className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">
              Финансовых целей пока нет. Добавьте первую цель выше, например подушку или закрытие долга.
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="section-panel">
        <CardHeader>
          <CardTitle>Последние снимки</CardTitle>
        </CardHeader>
        <CardContent>
          {financeResult.snapshots.length ? (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-sm">
                <thead className="text-left text-muted-foreground">
                  <tr>
                    <th className="py-2">Дата</th>
                    <th>Доход</th>
                    <th>Расходы</th>
                    <th>Накопления</th>
                    <th>Долги</th>
                    <th>Инвестиции</th>
                  </tr>
                </thead>
                <tbody>
                  {financeResult.snapshots.map((snapshot) => (
                    <tr key={snapshot.id} className="border-t border-border/80">
                      <td className="py-3">{snapshot.date}</td>
                      <td>{formatMoney(snapshot.income)}</td>
                      <td>{formatMoney(snapshot.required_expenses + snapshot.optional_expenses)}</td>
                      <td>{formatMoney(snapshot.savings)}</td>
                      <td>{formatMoney(snapshot.debt_total)}</td>
                      <td>{formatMoney(snapshot.investments)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">
              Снимков пока нет. Сохраните первый финансовый снимок, чтобы появились показатели.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function Metric({ title, value, tone }: { title: string; value: string; tone?: "bad" }) {
  return (
    <Card className="section-panel">
      <CardContent className="p-5">
        <div className="text-sm text-muted-foreground">{title}</div>
        <div className={tone === "bad" ? "mt-3 text-3xl font-semibold text-destructive" : "mt-3 text-3xl font-semibold"}>
          {value}
        </div>
      </CardContent>
    </Card>
  );
}

function NumberField({
  id,
  name,
  label,
  required
}: {
  id: string;
  name: string;
  label: string;
  required?: boolean;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <Input id={id} name={name} type="number" step="100" min={0} defaultValue={0} required={required} />
    </div>
  );
}
