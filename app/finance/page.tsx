import { redirect } from "next/navigation";
import {
  deleteFinanceGoalAction,
  deleteFinanceSnapshotAction,
  upsertFinanceGoalAction,
  upsertFinanceSnapshotAction
} from "@/app/actions";
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
import { ConfirmSubmitButton } from "@/components/shared/confirm-submit-button";
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
                {item.goal.goal_id ? (
                  <div className="mt-3 rounded-md border border-warning/30 bg-warning/10 p-3 text-xs text-muted-foreground">
                    Связь с общей целью сейчас визуальная: суммы обновляются в финансовом контуре отдельно.
                  </div>
                ) : null}
                <details className="mt-4 rounded-md border border-border/80 bg-fog">
                  <summary className="cursor-pointer px-3 py-2 text-sm font-medium">Редактировать цель</summary>
                  <form action={upsertFinanceGoalAction} className="grid gap-3 border-t border-border/80 p-3 sm:grid-cols-2">
                    <input type="hidden" name="id" value={item.goal.id} />
                    <div className="space-y-2 sm:col-span-2">
                      <Label>Название</Label>
                      <Input name="title" defaultValue={item.goal.title} required />
                    </div>
                    <NumberField id={`target-${item.goal.id}`} name="targetAmount" label="Целевая сумма" required defaultValue={item.goal.target_amount} />
                    <NumberField id={`current-${item.goal.id}`} name="currentAmount" label="Текущая сумма" defaultValue={item.goal.current_amount} />
                    <div className="space-y-2">
                      <Label>Дедлайн</Label>
                      <Input name="dueDate" type="date" defaultValue={item.goal.due_date ?? ""} />
                    </div>
                    <div className="space-y-2">
                      <Label>Сфера</Label>
                      <Select name="lifeAreaId" defaultValue={item.goal.life_area_id ?? ""}>
                        <option value="">Без сферы</option>
                        {lifeAreas.map((area) => (
                          <option key={area.id} value={area.id}>
                            {area.name}
                          </option>
                        ))}
                      </Select>
                    </div>
                    <div className="space-y-2 sm:col-span-2">
                      <Label>Связь с целью</Label>
                      <Select name="goalId" defaultValue={item.goal.goal_id ?? ""}>
                        <option value="">Без связи</option>
                        {goals.map((goal) => (
                          <option key={goal.id} value={goal.id}>
                            {goal.title}
                          </option>
                        ))}
                      </Select>
                    </div>
                    <div className="flex flex-wrap gap-2 sm:col-span-2">
                      <Button type="submit" variant="outline">Сохранить изменения</Button>
                    </div>
                  </form>
                  <form action={deleteFinanceGoalAction} className="border-t border-border/80 p-3">
                    <input type="hidden" name="id" value={item.goal.id} />
                    <ConfirmSubmitButton type="submit" variant="destructive" size="sm" message={`Удалить финансовую цель «${item.goal.title}»?`}>
                      Удалить цель
                    </ConfirmSubmitButton>
                  </form>
                </details>
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
                    <th></th>
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
                      <td className="text-right">
                        <form action={deleteFinanceSnapshotAction}>
                          <input type="hidden" name="id" value={snapshot.id} />
                          <ConfirmSubmitButton type="submit" variant="ghost" size="sm" message={`Удалить финансовый снимок за ${snapshot.date}?`}>
                            Удалить
                          </ConfirmSubmitButton>
                        </form>
                        <details className="mt-2 text-left">
                          <summary className="cursor-pointer text-xs text-muted-foreground">Редактировать</summary>
                          <form action={upsertFinanceSnapshotAction} className="mt-2 grid min-w-[320px] gap-2 rounded-md border bg-card p-3">
                            <Input name="date" type="date" defaultValue={snapshot.date} required />
                            <Input name="income" type="number" step="100" min={0} defaultValue={snapshot.income} aria-label="Доход" />
                            <Input name="requiredExpenses" type="number" step="100" min={0} defaultValue={snapshot.required_expenses} aria-label="Обязательные расходы" />
                            <Input name="optionalExpenses" type="number" step="100" min={0} defaultValue={snapshot.optional_expenses} aria-label="Необязательные расходы" />
                            <Input name="savings" type="number" step="100" min={0} defaultValue={snapshot.savings} aria-label="Накопления" />
                            <Input name="debtTotal" type="number" step="100" min={0} defaultValue={snapshot.debt_total} aria-label="Долги" />
                            <Input name="investments" type="number" step="100" min={0} defaultValue={snapshot.investments} aria-label="Инвестиции" />
                            <Textarea name="comment" defaultValue={snapshot.comment ?? ""} aria-label="Комментарий" />
                            <Button type="submit" size="sm">Сохранить снимок</Button>
                          </form>
                        </details>
                      </td>
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
  required,
  defaultValue = 0
}: {
  id: string;
  name: string;
  label: string;
  required?: boolean;
  defaultValue?: number;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <Input id={id} name={name} type="number" step="100" min={0} defaultValue={defaultValue} required={required} />
    </div>
  );
}
