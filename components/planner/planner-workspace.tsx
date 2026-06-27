"use client";

import { Archive, Copy, RotateCcw, Save, Trash2, Wand2 } from "lucide-react";
import {
  approveMonthAction,
  copyMonthFromTemplateAction,
  createCategoryAction,
  createMonthAction,
  createTaskAction,
  deleteCategoryAction,
  deleteTaskAction,
  generatePlanAction,
  savePlanGridAction,
  setTaskActiveAction,
  updateCategoryAction,
  updateTaskAction
} from "@/app/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { ConfirmSubmitButton } from "@/components/shared/confirm-submit-button";
import { getMonthDates, getMonthTitle, toDateKey, weekDayOptions } from "@/lib/dates/month";
import { formatScore } from "@/lib/utils";
import type { Category, DailyPlan, LifeArea, Month, Task } from "@/types/domain";

const colorOptions = ["#16a34a", "#7c3aed", "#f97316", "#2563eb", "#dc2626", "#0f766e"];

export function PlannerWorkspace({
  months,
  selectedMonth,
  lifeAreas,
  categories,
  tasks,
  plans
}: {
  months: Month[];
  selectedMonth: Month | null;
  lifeAreas: LifeArea[];
  categories: Category[];
  tasks: Task[];
  plans: DailyPlan[];
}) {
  const now = new Date();
  const nextMonthDate = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  const nextYear = nextMonthDate.getFullYear();
  const nextMonth = nextMonthDate.getMonth() + 1;
  const monthDates = selectedMonth ? getMonthDates(selectedMonth.year, selectedMonth.month) : [];
  const planMap = new Map(
    plans.map((plan) => [`${plan.task_id}:${plan.date}`, plan])
  );
  const categoryMap = new Map(categories.map((category) => [category.id, category]));
  const lifeAreaMap = new Map(lifeAreas.map((area) => [area.id, area]));
  const activeTasks = tasks.filter((task) => task.is_active);
  const visiblePlanTasks = tasks.filter(
    (task) => task.is_active || plans.some((plan) => plan.task_id === task.id)
  );
  const canCreateTask = categories.length > 0;
  const approved = selectedMonth?.status === "approved" || selectedMonth?.status === "closed";

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 border-b border-border/80 pb-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="page-kicker">Первый шаг</div>
          <h2 className="mt-1 text-xl font-semibold tracking-tight">Соберите основу месяца</h2>
        </div>
        <p className="max-w-md text-sm leading-5 text-muted-foreground">Месяц, категории и задачи остаются рядом, чтобы план не распадался на отдельные действия.</p>
      </div>
      <div className="planner-top-grid grid gap-3 xl:grid-cols-[0.8fr_1fr_1.25fr]">
        <Card className="section-panel">
          <CardHeader>
            <CardTitle>Месяц</CardTitle>
            <CardDescription>Черновик можно менять свободно</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <form action={createMonthAction} className="grid gap-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="year">Год</Label>
                  <Input id="year" name="year" type="number" defaultValue={now.getFullYear()} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="month">Месяц</Label>
                  <Input id="month" name="month" type="number" min={1} max={12} defaultValue={now.getMonth() + 1} />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="title">Название</Label>
                <Input id="title" name="title" defaultValue={selectedMonth?.title ?? ""} />
              </div>
              <Button type="submit">Создать месяц</Button>
            </form>

            {months.length ? (
              <div className="space-y-2">
                <Label>Выбранный месяц</Label>
                <Select
                  defaultValue={selectedMonth?.id}
                  onChange={(event) => {
                    window.location.href = `/planner?month=${event.currentTarget.value}`;
                  }}
                >
                  {months.map((month) => (
                    <option key={month.id} value={month.id}>
                      {month.title}
                    </option>
                  ))}
                </Select>
              </div>
            ) : null}

            {selectedMonth ? (
              <div className="flex items-center justify-between rounded-md border p-3">
                <div>
                  <div className="font-medium">{selectedMonth.title}</div>
                  <div className="text-sm text-muted-foreground">
                    {selectedMonth.status === "draft" ? "Черновик" : "Утвержден"}
                  </div>
                </div>
                <Badge variant={approved ? "success" : "info"}>
                  {approved ? "План зафиксирован" : "Можно редактировать"}
                </Badge>
              </div>
            ) : null}
          </CardContent>
        </Card>

        <Card className="section-panel">
          <CardHeader>
            <CardTitle>Категории</CardTitle>
            <CardDescription>Цвет используется в аналитике</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <form action={createCategoryAction} className="grid gap-3">
              <div className="space-y-2">
                <Label htmlFor="category-name">Название</Label>
                <Input id="category-name" name="name" placeholder="Например, Тело" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="category-life-area">Сфера жизни</Label>
                <Select id="category-life-area" name="lifeAreaId" defaultValue="">
                  <option value="">Без сферы</option>
                  {lifeAreas.map((area) => (
                    <option key={area.id} value={area.id}>
                      {area.name}
                    </option>
                  ))}
                </Select>
              </div>
              <div className="grid grid-cols-[1fr_auto] gap-3">
                <div className="space-y-2">
                  <Label htmlFor="category-color">Цвет</Label>
                  <Input id="category-color" name="color" type="color" defaultValue={colorOptions[0]} />
                </div>
                <Button type="submit" className="self-end">Добавить</Button>
              </div>
            </form>
            {categories.length ? (
              <div className="space-y-3">
                {categories.map((category) => (
                  <div key={category.id} className="list-row">
                    <form action={updateCategoryAction} className="grid gap-3">
                      <input type="hidden" name="id" value={category.id} />
                      <div className="space-y-2">
                        <Label htmlFor={`planner-category-name-${category.id}`}>Название</Label>
                        <Input
                          id={`planner-category-name-${category.id}`}
                          name="name"
                          defaultValue={category.name}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor={`planner-category-life-area-${category.id}`}>Сфера жизни</Label>
                        <Select
                          id={`planner-category-life-area-${category.id}`}
                          name="lifeAreaId"
                          defaultValue={category.life_area_id ?? ""}
                        >
                          <option value="">Без сферы</option>
                          {lifeAreas.map((area) => (
                            <option key={area.id} value={area.id}>
                              {area.name}
                            </option>
                          ))}
                        </Select>
                      </div>
                      <div className="grid grid-cols-[1fr_auto] gap-3">
                        <div className="space-y-2">
                          <Label htmlFor={`planner-category-color-${category.id}`}>Цвет</Label>
                          <Input
                            id={`planner-category-color-${category.id}`}
                            name="color"
                            type="color"
                            defaultValue={category.color}
                          />
                        </div>
                        <Button type="submit" size="sm" className="self-end">
                          Сохранить
                        </Button>
                      </div>
                    </form>
                    <div className="mt-3 flex items-center justify-between gap-3">
                      <Badge variant="outline">
                        <span
                          className="mr-1.5 h-2.5 w-2.5 rounded-full"
                          style={{ backgroundColor: category.color }}
                        />
                        {category.name}
                      </Badge>
                      {category.life_area_id ? (
                        <Badge variant="secondary">
                          {lifeAreaMap.get(category.life_area_id)?.name ?? "Сфера"}
                        </Badge>
                      ) : null}
                      <form action={deleteCategoryAction}>
                        <input type="hidden" name="id" value={category.id} />
                        <ConfirmSubmitButton
                          type="submit"
                          variant="destructive"
                          size="sm"
                          message={`Удалить категорию «${category.name}»? У задач эта категория будет очищена.`}
                        >
                          <Trash2 className="h-4 w-4" />
                          Удалить
                        </ConfirmSubmitButton>
                      </form>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
                Категорий пока нет. Добавьте первую категорию выше.
              </p>
            )}
          </CardContent>
        </Card>

        <Card className="section-panel">
          <CardHeader>
            <CardTitle>Задачи</CardTitle>
            <CardDescription>Вес усиливает вклад задачи в месяц</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <form action={createTaskAction} className="grid gap-3">
              <div className="space-y-2">
                <Label htmlFor="task-category">Категория</Label>
                <Select id="task-category" name="categoryId" required disabled={!canCreateTask}>
                  <option value="">{canCreateTask ? "Выберите категорию" : "Сначала создайте категорию"}</option>
                  {categories.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                    </option>
                  ))}
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="task-title">Задача</Label>
                <Input id="task-title" name="title" placeholder="Например, Прогулка" />
              </div>
              <div className="grid grid-cols-[1fr_auto] gap-3">
                <div className="space-y-2">
                  <Label htmlFor="task-weight">Вес</Label>
                  <Input id="task-weight" name="weight" type="number" min="0.25" step="0.25" defaultValue="1" />
                </div>
                <Button type="submit" className="self-end" disabled={!canCreateTask}>Добавить</Button>
              </div>
              <div className="grid gap-3 sm:grid-cols-[1fr_160px]">
                <div className="space-y-2">
                  <Label htmlFor="task-input-mode">Тип ввода факта</Label>
                  <Select id="task-input-mode" name="inputMode" defaultValue="ratio">
                    <option value="ratio">Шкала 0-2</option>
                    <option value="measured">Измеримое значение</option>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="task-unit">Единица</Label>
                  <Input id="task-unit" name="unit" placeholder="шаги, мин, стр." />
                </div>
              </div>
              {!canCreateTask ? (
                <p className="rounded-md border border-dashed p-3 text-sm text-muted-foreground">
                  Задача должна быть связана с категорией. Создайте категорию в соседнем блоке, затем добавьте задачу.
                </p>
              ) : null}
            </form>
            {tasks.length ? (
              <div className="space-y-3 border-t pt-4">
                {tasks.map((task) => {
                  const taskCategory = task.category_id ? categoryMap.get(task.category_id) : null;

                  return (
                    <div key={task.id} className="list-row">
                      <div className="mb-3 flex flex-wrap items-center gap-2">
                        <Badge variant={task.is_active ? "success" : "secondary"}>
                          {task.is_active ? "Активна" : "Архив"}
                        </Badge>
                        {taskCategory ? (
                          <Badge variant="outline">
                            <span
                              className="mr-1.5 h-2.5 w-2.5 rounded-full"
                              style={{ backgroundColor: taskCategory.color }}
                            />
                            {taskCategory.name}
                          </Badge>
                        ) : (
                          <Badge variant="warning">Без категории</Badge>
                        )}
                        <Badge variant={task.input_mode === "measured" ? "info" : "outline"}>
                          {task.input_mode === "measured" ? `Измеримо: ${task.unit ?? "ед."}` : "Шкала 0-2"}
                        </Badge>
                      </div>
                      <form action={updateTaskAction} className="grid gap-3">
                        <input type="hidden" name="id" value={task.id} />
                        <div className="space-y-2">
                          <Label htmlFor={`task-category-${task.id}`}>Категория</Label>
                          <Select
                            id={`task-category-${task.id}`}
                            name="categoryId"
                            required
                            defaultValue={task.category_id ?? ""}
                          >
                            <option value="">{categories.length ? "Выберите категорию" : "Сначала создайте категорию"}</option>
                            {categories.map((category) => (
                              <option key={category.id} value={category.id}>
                                {category.name}
                              </option>
                            ))}
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor={`task-title-${task.id}`}>Задача</Label>
                          <Input
                            id={`task-title-${task.id}`}
                            name="title"
                            defaultValue={task.title}
                          />
                        </div>
                        <div className="grid grid-cols-[1fr_auto] gap-3">
                          <div className="space-y-2">
                            <Label htmlFor={`task-weight-${task.id}`}>Вес</Label>
                            <Input
                              id={`task-weight-${task.id}`}
                              name="weight"
                              type="number"
                              min="0.25"
                              step="0.25"
                              defaultValue={task.weight}
                            />
                          </div>
                          <Button type="submit" size="sm" className="self-end">
                            Сохранить
                          </Button>
                        </div>
                        <div className="grid gap-3 sm:grid-cols-[1fr_160px]">
                          <div className="space-y-2">
                            <Label htmlFor={`task-input-mode-${task.id}`}>Тип ввода факта</Label>
                            <Select
                              id={`task-input-mode-${task.id}`}
                              name="inputMode"
                              defaultValue={task.input_mode}
                            >
                              <option value="ratio">Шкала 0-2</option>
                              <option value="measured">Измеримое значение</option>
                            </Select>
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor={`task-unit-${task.id}`}>Единица</Label>
                            <Input
                              id={`task-unit-${task.id}`}
                              name="unit"
                              defaultValue={task.unit ?? ""}
                              placeholder="шаги, мин, стр."
                            />
                          </div>
                        </div>
                      </form>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <form action={setTaskActiveAction}>
                          <input type="hidden" name="id" value={task.id} />
                          <input type="hidden" name="isActive" value={task.is_active ? "false" : "true"} />
                          <Button type="submit" variant="outline" size="sm">
                            {task.is_active ? (
                              <Archive className="h-4 w-4" />
                            ) : (
                              <RotateCcw className="h-4 w-4" />
                            )}
                            {task.is_active ? "Архивировать" : "Вернуть"}
                          </Button>
                        </form>
                        <form action={deleteTaskAction}>
                          <input type="hidden" name="id" value={task.id} />
                          <ConfirmSubmitButton
                            type="submit"
                            variant="destructive"
                            size="sm"
                            message={`Удалить задачу «${task.title}»? Это удалит связанные планы, факты и связи с целями.`}
                          >
                            <Trash2 className="h-4 w-4" />
                            Удалить
                          </ConfirmSubmitButton>
                        </form>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
                Задач пока нет. Добавьте первую задачу выше.
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="planner-workflow-panel">
        <CardHeader className="planner-workflow-heading">
          <CardTitle>Новый месяц из шаблона</CardTitle>
          <CardDescription>Копирует правила планирования прошлого месяца и генерирует план заново</CardDescription>
        </CardHeader>
        <CardContent>
          <form action={copyMonthFromTemplateAction} className="grid gap-4 lg:grid-cols-[1.2fr_120px_120px_1fr_auto] lg:items-end">
            <div className="space-y-2">
              <Label>Источник шаблона</Label>
              <Select name="sourceMonthId" defaultValue={selectedMonth?.id} required>
                {months.map((month) => (
                  <option key={month.id} value={month.id}>
                    {month.title}
                  </option>
                ))}
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Год</Label>
              <Input name="year" type="number" min={2020} max={2100} defaultValue={nextYear} />
            </div>
            <div className="space-y-2">
              <Label>Месяц</Label>
              <Input name="month" type="number" min={1} max={12} defaultValue={nextMonth} />
            </div>
            <div className="space-y-2">
              <Label>Название</Label>
              <Input name="title" defaultValue={getMonthTitle(nextYear, nextMonth)} />
            </div>
            <Button type="submit" disabled={!months.length}>
              <Copy className="h-4 w-4" />
              Создать
            </Button>
            <div className="lg:col-span-5 grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
              <label className="planner-choice">
                <input type="radio" name="taskScope" value="active" defaultChecked />
                Только активные задачи
              </label>
              <label className="planner-choice">
                <input type="radio" name="taskScope" value="all" />
                Все задачи
              </label>
              <label className="planner-choice">
                <input type="checkbox" name="excludeTasksWithoutPlan" defaultChecked />
                Исключить без плана
              </label>
              <p className="planner-choice col-span-1 sm:col-span-2 lg:col-span-2">
                Категории и связи с целями сохраняются автоматически: задачи в приложении общие для ваших месяцев.
              </p>
            </div>
          </form>
        </CardContent>
      </Card>

      {selectedMonth ? (
        <Card className="planner-workflow-panel">
          <CardHeader className="planner-workflow-heading">
            <CardTitle>Генератор плана</CardTitle>
            <CardDescription>После утверждения можно только увеличить план или добавить новое</CardDescription>
          </CardHeader>
          <CardContent>
            <form action={generatePlanAction} className="grid gap-4 lg:grid-cols-[1.3fr_1fr_1fr_1.2fr_1fr_auto] lg:items-end">
              <input type="hidden" name="monthId" value={selectedMonth.id} />
              <div className="space-y-2">
                <Label>Задача</Label>
                <Select name="taskId" required disabled={!activeTasks.length}>
                  {!activeTasks.length ? <option value="">Сначала добавьте активную задачу</option> : null}
                  {activeTasks.map((task) => (
                    <option key={task.id} value={task.id}>
                      {task.title}
                    </option>
                  ))}
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Режим</Label>
                <Select name="mode" defaultValue="daily">
                  <option value="daily">Каждый день</option>
                  <option value="weekdays">Только будни</option>
                  <option value="weekends">Только выходные</option>
                  <option value="specific_weekdays">Дни недели</option>
                  <option value="specific_dates">Конкретные даты</option>
                  <option value="n_times_per_month">N раз в месяц</option>
                  <option value="manual">Вручную</option>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>План</Label>
                <Input name="plannedValue" type="number" min="0" step="0.25" defaultValue="1" />
              </div>
              <div className="space-y-2">
                <Label>Дни недели</Label>
                <div className="flex flex-wrap gap-2">
                  {weekDayOptions.map((day) => (
                    <label key={day.value} className="planner-choice px-2 py-1 text-xs">
                      <input type="checkbox" name="weekdays" value={day.value} defaultChecked={day.value >= 1 && day.value <= 5} />
                      {day.label}
                    </label>
                  ))}
                </div>
              </div>
              <div className="space-y-2">
                <Label>Раз в месяц</Label>
                <Input name="timesPerMonth" type="number" min="1" max="31" defaultValue="8" />
              </div>
              <div className="space-y-2 lg:col-span-5">
                <Label>Конкретные даты</Label>
                <Input
                  name="specificDates"
                  placeholder="2026-06-01, 2026-06-10"
                />
              </div>
              <Button type="submit" disabled={!activeTasks.length}>
                <Wand2 className="h-4 w-4" />
                Сгенерировать
              </Button>
              {!activeTasks.length ? (
                <p className="rounded-md border border-dashed p-3 text-sm text-muted-foreground lg:col-span-6">
                  Для генерации плана нужна хотя бы одна активная задача.
                </p>
              ) : null}
            </form>
          </CardContent>
        </Card>
      ) : null}

      {selectedMonth ? (
        <Card className="planner-workflow-panel">
          <CardHeader className="planner-workflow-heading flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <CardTitle>Календарная таблица</CardTitle>
              <CardDescription>
                {approved
                  ? "Утвержденные значения защищены от уменьшения"
                  : "Значения сохраняются по всей таблице"}
              </CardDescription>
            </div>
            <form action={approveMonthAction}>
              <input type="hidden" name="monthId" value={selectedMonth.id} />
              <Button type="submit" variant={approved ? "secondary" : "success"} disabled={approved || plans.length === 0}>
                Утвердить план
              </Button>
            </form>
          </CardHeader>
          <CardContent>
            <form action={savePlanGridAction} className="space-y-4">
              <input type="hidden" name="monthId" value={selectedMonth.id} />
              <div className="overflow-x-auto rounded-md border border-border/85 bg-background/45">
                <table className="min-w-[980px] w-full border-collapse text-sm">
                  <thead>
                    <tr className="bg-muted/70">
                      <th className="sticky left-0 z-10 w-64 bg-muted p-3 text-left font-medium">Задача</th>
                      {monthDates.map((date) => (
                        <th key={date.toISOString()} className="w-16 p-2 text-center font-medium">
                          {date.getDate()}
                        </th>
                      ))}
                      <th className="w-20 p-2 text-center font-medium">План</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visiblePlanTasks.map((task) => {
                      const taskTotal = monthDates.reduce((sum, date) => {
                        const key = `${task.id}:${toDateKey(date)}`;
                        return sum + (planMap.get(key)?.planned_score ?? 0);
                      }, 0);

                      return (
                        <tr key={task.id} className="border-t border-border/75">
                          <td className="sticky left-0 z-10 bg-card p-3 align-top">
                            <div className="font-medium">{task.title}</div>
                            <div className="text-xs text-muted-foreground">Вес {formatScore(task.weight)}</div>
                          </td>
                          {monthDates.map((date) => {
                            const dateKey = toDateKey(date);
                            const plan = planMap.get(`${task.id}:${dateKey}`);
                            const min = approved ? plan?.planned_value ?? 0 : 0;

                            return (
                              <td key={dateKey} className="border-l p-1">
                                <Input
                                  className="h-9 min-w-14 px-2 text-center"
                                  name={`plan:${task.id}:${dateKey}`}
                                  type="number"
                                  min={min}
                                  step="0.25"
                                  defaultValue={plan?.planned_value ?? 0}
                                />
                              </td>
                            );
                          })}
                          <td className="border-l p-2 text-center font-semibold">
                            {formatScore(taskTotal)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <Button type="submit" disabled={!visiblePlanTasks.length}>
                <Save className="h-4 w-4" />
                Сохранить план
              </Button>
            </form>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
