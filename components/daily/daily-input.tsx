"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { AlertTriangle, ClipboardCheck, Copy, Save, Undo2 } from "lucide-react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { saveDailyFactsAction } from "@/app/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { missReasonLabels } from "@/lib/reflection";
import { dailyNoteSchema, factValueSchema, missReasonSchema } from "@/lib/validators/tracker";
import { cn, formatScore } from "@/lib/utils";
import type { Category, DailyFact, DailyNote, DailyPlan, Task } from "@/types/domain";

const factOptions = [0, 0.25, 0.5, 0.75, 1, 1.25, 1.5, 2];
const energyOptions = [
  { value: 1, label: "Очень низко" },
  { value: 2, label: "Ниже обычного" },
  { value: 3, label: "Ровно" },
  { value: 4, label: "Хорошо" },
  { value: 5, label: "Высоко" }
];

const dailyFormSchema = z.object({
  entries: z.array(
    z.object({
      taskId: z.string().uuid(),
      actualValue: factValueSchema.nullable(),
      note: z.string().optional(),
      missReason: missReasonSchema.or(z.literal("")).optional(),
      missComment: z.string().optional()
    })
  ),
  dailyNote: dailyNoteSchema.optional()
});

type DailyForm = z.infer<typeof dailyFormSchema>;
type DailyFilter = "all" | "unfilled" | "focus" | "below";

type DailyItem = {
  task: Task;
  category: Category | null;
  plan: DailyPlan;
  fact: DailyFact | null;
};

type UndoSnapshot = {
  values: DailyForm;
  filledTaskIds: string[];
};

function cloneFormValues(values: DailyForm): DailyForm {
  return {
    entries: values.entries.map((entry) => ({ ...entry })),
    dailyNote: values.dailyNote ? { ...values.dailyNote } : undefined
  };
}

export function DailyInput({
  monthId,
  date,
  items,
  yesterdayFacts = [],
  dailyNote,
  readOnly = false
}: {
  monthId: string;
  date: string;
  items: DailyItem[];
  yesterdayFacts?: DailyFact[];
  dailyNote?: DailyNote | null;
  readOnly?: boolean;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [canUndo, setCanUndo] = useState(false);
  const [filter, setFilter] = useState<DailyFilter>("all");
  const [filledTaskIds, setFilledTaskIds] = useState<Set<string>>(
    () => new Set(items.filter((item) => item.fact).map((item) => item.task.id))
  );
  const initialRender = useRef(true);
  const undoSnapshotRef = useRef<UndoSnapshot | null>(null);
  const lastSavedPayloadRef = useRef<string | null>(null);
  const defaultValues = useMemo<DailyForm>(
    () => ({
      entries: items.map((item) => ({
        taskId: item.task.id,
        actualValue: item.fact?.actual_value ?? null,
        note: item.fact?.note ?? "",
        missReason: item.fact?.miss_reason ?? "",
        missComment: item.fact?.miss_comment ?? ""
      })),
      dailyNote: {
        content: dailyNote?.content ?? "",
        mood: dailyNote?.mood ?? "",
        energy: dailyNote?.energy ?? ""
      }
    }),
    [dailyNote, items]
  );
  const form = useForm<DailyForm>({
    resolver: zodResolver(dailyFormSchema),
    defaultValues
  });
  const watchedEntries = form.watch("entries");
  const watchedDailyNote = form.watch("dailyNote");
  const selectedEnergy = Number(watchedDailyNote?.energy) || null;
  const filledCount = filledTaskIds.size;
  const hasUnfilled = filledCount < items.length;
  const yesterdayByTask = useMemo(
    () => new Map(yesterdayFacts.map((fact) => [fact.task_id, fact])),
    [yesterdayFacts]
  );
  const groups = useMemo(() => {
    const map = new Map<string, { category: Category | null; rows: { item: DailyItem; index: number }[] }>();

    items.forEach((item, index) => {
      const key = item.category?.id ?? "without-category";
      const current = map.get(key);

      if (current) {
        current.rows.push({ item, index });
      } else {
        map.set(key, {
          category: item.category,
          rows: [{ item, index }]
        });
      }
    });

    return Array.from(map.values());
  }, [items]);
  const maxTaskWeight = useMemo(() => Math.max(0, ...items.map((item) => item.task.weight)), [items]);
  const focusTaskIds = useMemo(
    () => new Set(items.filter((item) => item.task.weight === maxTaskWeight).map((item) => item.task.id)),
    [items, maxTaskWeight]
  );

  useEffect(() => {
    form.reset(defaultValues);
    setFilledTaskIds(new Set(items.filter((item) => item.fact).map((item) => item.task.id)));
    undoSnapshotRef.current = null;
    lastSavedPayloadRef.current = JSON.stringify(defaultValues);
    setCanUndo(false);
    initialRender.current = true;
  }, [defaultValues, form, items]);

  const captureUndoSnapshot = useCallback(() => {
    if (readOnly) {
      return;
    }

    undoSnapshotRef.current = {
      values: cloneFormValues(form.getValues()),
      filledTaskIds: Array.from(filledTaskIds)
    };
    setCanUndo(true);
  }, [filledTaskIds, form, readOnly]);

  const markFilled = useCallback((taskId: string) => {
    setFilledTaskIds((current) => {
      const next = new Set(current);
      next.add(taskId);
      return next;
    });
  }, []);

  const setFactValue = useCallback((index: number, taskId: string, value: number, recordUndo = true) => {
    if (recordUndo) {
      captureUndoSnapshot();
    }
    form.setValue(`entries.${index}.actualValue`, value, { shouldDirty: true, shouldValidate: true });
    markFilled(taskId);
  }, [captureUndoSnapshot, form, markFilled]);

  const clearFactValue = useCallback((index: number, taskId: string) => {
    captureUndoSnapshot();
    form.setValue(`entries.${index}.actualValue`, null, { shouldDirty: true, shouldValidate: true });
    form.setValue(`entries.${index}.missReason`, "", { shouldDirty: true });
    form.setValue(`entries.${index}.missComment`, "", { shouldDirty: true });
    setFilledTaskIds((current) => {
      const next = new Set(current);
      next.delete(taskId);
      return next;
    });
  }, [captureUndoSnapshot, form]);

  const save = useCallback(async (values: DailyForm) => {
    const payload = JSON.stringify(values);
    if (lastSavedPayloadRef.current === payload) {
      return;
    }

    const result = await saveDailyFactsAction({
        monthId,
        date,
        entries: values.entries,
        dailyNote: values.dailyNote
      })
      .catch((error: unknown) => ({
        ok: false,
        error: error instanceof Error ? error.message : "Не удалось сохранить день"
      }));

    if (!result.ok) {
      setSaveError(result.error ?? "Не удалось сохранить день");
      setSavedAt(null);
      return;
    }

    setSaveError(null);
    lastSavedPayloadRef.current = payload;
    setSavedAt(new Date().toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" }));
    router.refresh();
  }, [date, monthId, router]);

  const closePlannedAsDone = useCallback(() => {
    captureUndoSnapshot();
    items.forEach((item, index) => {
      setFactValue(index, item.task.id, Math.min(2, Math.max(0, item.plan.planned_value)), false);
    });
  }, [captureUndoSnapshot, items, setFactValue]);

  const markUnfilledAsZero = useCallback(() => {
    captureUndoSnapshot();
    items.forEach((item, index) => {
      if (!filledTaskIds.has(item.task.id)) {
        setFactValue(index, item.task.id, 0, false);
      }
    });
  }, [captureUndoSnapshot, filledTaskIds, items, setFactValue]);

  const copyYesterday = useCallback(() => {
    const copiedTaskIds = new Set<string>();
    captureUndoSnapshot();

    items.forEach((item, index) => {
      const yesterday = yesterdayByTask.get(item.task.id);

      if (!yesterday) {
        return;
      }

      form.setValue(`entries.${index}.actualValue`, yesterday.actual_value, { shouldDirty: true, shouldValidate: true });
      form.setValue(`entries.${index}.note`, "", { shouldDirty: true });
      form.setValue(`entries.${index}.missReason`, "", { shouldDirty: true });
      form.setValue(`entries.${index}.missComment`, "", { shouldDirty: true });
      copiedTaskIds.add(item.task.id);
    });

    if (copiedTaskIds.size > 0) {
      setFilledTaskIds((current) => new Set([...current, ...copiedTaskIds]));
    }
  }, [captureUndoSnapshot, form, items, yesterdayByTask]);

  const undoLastChange = useCallback(() => {
    const snapshot = undoSnapshotRef.current;

    if (!snapshot || readOnly) {
      return;
    }

    form.reset(cloneFormValues(snapshot.values));
    setFilledTaskIds(new Set(snapshot.filledTaskIds));
    undoSnapshotRef.current = null;
    setCanUndo(false);
    startTransition(() => {
      void save(snapshot.values);
    });
  }, [form, readOnly, save]);

  useEffect(() => {
    if (initialRender.current) {
      initialRender.current = false;
      return;
    }

    if (readOnly) {
      return;
    }

    const timeout = window.setTimeout(() => {
      const values = form.getValues();
      const parsed = dailyFormSchema.safeParse(values);

      if (!parsed.success) {
        return;
      }

      startTransition(() => {
        void save(parsed.data);
      });
    }, 1500);

    return () => window.clearTimeout(timeout);
  }, [watchedEntries, watchedDailyNote, form, readOnly, save]);

  if (!items.length) {
    return (
      <Card>
        <CardContent className="p-5 text-sm text-muted-foreground">
          На выбранную дату нет задач с планом.
        </CardContent>
      </Card>
    );
  }

  return (
    <form
      className="space-y-4"
      onSubmit={form.handleSubmit((values) => {
        startTransition(() => {
          void save(values);
        });
      })}
    >
      <Card className="section-panel">
        <CardHeader className="space-y-3 pb-3">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <CardTitle>Быстрый ввод</CardTitle>
            <Badge variant={hasUnfilled ? "warning" : "success"}>
              заполнено {filledCount} из {items.length}
            </Badge>
          </div>
          {hasUnfilled ? (
            <div className="flex items-start gap-2 rounded-md border border-warning/35 bg-warning/10 p-3 text-sm">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
              Остались пустые факты. Перед сохранением можно отметить их нулем одной кнопкой.
            </div>
          ) : null}
        </CardHeader>
        <CardContent className="grid gap-2 sm:grid-cols-3">
          <Button type="button" variant="success" disabled={readOnly} onClick={closePlannedAsDone}>
            <ClipboardCheck className="h-4 w-4" />
            Заполнить по плану
          </Button>
          <Button type="button" variant="outline" disabled={readOnly || !hasUnfilled} onClick={markUnfilledAsZero}>
            Остальное не сделал
          </Button>
          <Button type="button" variant="secondary" disabled={readOnly || yesterdayFacts.length === 0} onClick={copyYesterday}>
            <Copy className="h-4 w-4" />
            Факт со вчера
          </Button>
          <div className="grid gap-2 sm:col-span-3 sm:grid-cols-4" role="group" aria-label="Фильтр задач дня">
            {[
              ["all", "Все"],
              ["unfilled", "Не заполнено"],
              ["focus", "Главный фокус"],
              ["below", "Просадки"]
            ].map(([value, label]) => (
              <Button
                key={value}
                type="button"
                variant={filter === value ? "default" : "outline"}
                size="sm"
                onClick={() => setFilter(value as DailyFilter)}
              >
                {label}
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>

      {groups.map((group) => {
        const visibleRows = group.rows.filter(({ item, index }) => {
          const current = watchedEntries[index]?.actualValue ?? null;
          if (filter === "unfilled") {
            return current === null;
          }
          if (filter === "focus") {
            return focusTaskIds.has(item.task.id);
          }
          if (filter === "below") {
            return current !== null && current < item.plan.planned_value;
          }
          return true;
        });

        if (!visibleRows.length) {
          return null;
        }

        return (
        <details key={group.category?.id ?? "without-category"} open={groups.length <= 4} className="daily-category group">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-3 bg-muted/35 p-4 transition-colors hover:bg-primary/[0.04]">
            <div className="flex min-w-0 items-center gap-2">
              {group.category ? (
                <span
                  className="h-2.5 w-2.5 rounded-full"
                  style={{ backgroundColor: group.category.color }}
                />
              ) : null}
              <span className="font-semibold">{group.category?.name ?? "Без категории"}</span>
              <Badge variant="outline">{group.rows.length}</Badge>
            </div>
            <span className="text-xs text-muted-foreground">свернуть</span>
          </summary>
          <div className="space-y-3 border-t border-border/80 p-3">
            {visibleRows.map(({ item, index }) => {
              const current = watchedEntries[index]?.actualValue ?? null;
              const hasFact = current !== null;
              const isBelowPlan = hasFact && current < item.plan.planned_value;
              const isMeasured = item.task.input_mode === "measured";
              const taskUnit = item.task.unit?.trim() || "ед.";
              const stateClass =
                !hasFact
                  ? "border-border bg-muted/30"
                  : current >= item.plan.planned_value
                  ? "border-success/50 bg-success/10"
                  : current > 0
                    ? "border-warning/60 bg-warning/10"
                    : "border-destructive/40 bg-destructive/10";

              return (
                <article key={item.task.id} className={cn("daily-task", stateClass)}>
                  <div className="space-y-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge variant="info">Вес {formatScore(item.task.weight)}</Badge>
                          <Badge variant="outline">
                            План {formatScore(item.plan.planned_value)}{isMeasured ? ` ${taskUnit}` : ""}
                          </Badge>
                          {isMeasured ? <Badge variant="outline">Измеримая</Badge> : null}
                        </div>
                        <h2 className="mt-2 text-base font-semibold tracking-normal">{item.task.title}</h2>
                      </div>
                      <div className="text-right text-sm">
                        <div className="font-semibold">
                          {hasFact ? formatScore(current * item.task.weight) : "—"} / {formatScore(item.plan.planned_score)}
                        </div>
                        <div className="text-muted-foreground">баллы факт / план</div>
                        {isMeasured ? (
                          <div className="mt-1 text-xs text-muted-foreground">
                            {hasFact ? formatScore(current) : "—"} / {formatScore(item.plan.planned_value)} {taskUnit}
                          </div>
                        ) : null}
                      </div>
                    </div>

                    <input type="hidden" {...form.register(`entries.${index}.taskId`)} />
                    {isMeasured ? (
                      <div className="grid gap-2 sm:grid-cols-[1fr_auto] sm:items-end">
                        <div className="space-y-2">
                          <Label htmlFor={`actual-${item.task.id}`}>Факт в единицах</Label>
                          <InputLikeNumber
                            id={`actual-${item.task.id}`}
                            value={current}
                            unit={taskUnit}
                            disabled={readOnly}
                            onFocus={captureUndoSnapshot}
                            onChange={(value) => {
                              if (value === null) {
                                clearFactValue(index, item.task.id);
                              } else {
                                setFactValue(index, item.task.id, value);
                              }
                            }}
                          />
                        </div>
                        <Button type="button" variant="outline" disabled={readOnly} onClick={() => setFactValue(index, item.task.id, item.plan.planned_value)}>
                          По плану
                        </Button>
                      </div>
                    ) : (
                      <div className="grid grid-cols-4 gap-2 sm:grid-cols-8">
                        {factOptions.map((value) => (
                          <Button
                            key={value}
                            type="button"
                            variant={current === value ? "default" : "outline"}
                            className={cn(
                              "h-12 px-2 text-base sm:h-11 sm:text-sm",
                              current === value && "scale-[1.02] shadow-[0_10px_20px_-16px_hsl(var(--primary))]"
                            )}
                            disabled={readOnly}
                            aria-pressed={current === value}
                            onClick={() => setFactValue(index, item.task.id, value)}
                          >
                            {value}
                          </Button>
                        ))}
                      </div>
                    )}

                    <details className="rounded-md border border-border/70 bg-card/70 p-3">
                      <summary className="cursor-pointer text-sm font-medium text-muted-foreground">
                        Комментарий к задаче
                      </summary>
                      <Textarea
                        placeholder={hasFact ? "Коротко: что повлияло на выполнение" : "Сначала выберите факт"}
                        className="mt-3 min-h-16"
                        disabled={readOnly || !hasFact}
                        onFocus={captureUndoSnapshot}
                        {...form.register(`entries.${index}.note`)}
                      />
                    </details>
                    {isBelowPlan ? (
                      <div className="grid gap-3 rounded-md border border-warning/30 bg-warning/10 p-3 sm:grid-cols-[220px_1fr]">
                        <div className="space-y-2">
                          <Label htmlFor={`miss-reason-${item.task.id}`}>Причина ниже плана</Label>
                          <Select
                            id={`miss-reason-${item.task.id}`}
                            disabled={readOnly}
                            onFocus={captureUndoSnapshot}
                            {...form.register(`entries.${index}.missReason`)}
                          >
                            <option value="">Не выбрано</option>
                            {Object.entries(missReasonLabels).map(([value, label]) => (
                              <option key={value} value={value}>
                                {label}
                              </option>
                            ))}
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor={`miss-comment-${item.task.id}`}>Короткий комментарий</Label>
                          <Textarea
                            id={`miss-comment-${item.task.id}`}
                            className="min-h-10"
                            placeholder="Нашли причину — теперь можно улучшить систему"
                            disabled={readOnly}
                            onFocus={captureUndoSnapshot}
                            {...form.register(`entries.${index}.missComment`)}
                          />
                        </div>
                      </div>
                    ) : null}
                    {form.formState.errors.entries?.[index]?.actualValue ? (
                      <p className="text-sm text-destructive">
                        {form.formState.errors.entries[index]?.actualValue?.message}
                      </p>
                    ) : null}
                  </div>
                </article>
              );
            })}
          </div>
        </details>
        );
      })}

      {groups.length > 0 && groups.every((group) => group.rows.every(({ item, index }) => {
        const current = watchedEntries[index]?.actualValue ?? null;
        if (filter === "unfilled") return current !== null;
        if (filter === "focus") return !focusTaskIds.has(item.task.id);
        if (filter === "below") return current === null || current >= item.plan.planned_value;
        return false;
      })) ? (
        <Card>
          <CardContent className="p-5 text-sm text-muted-foreground">
            По текущему фильтру задач нет.
          </CardContent>
        </Card>
      ) : null}

      <Card className="section-panel">
        <CardHeader>
          <CardTitle>Ритм дня</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 lg:grid-cols-[1fr_180px_160px]">
          <div className="space-y-2 lg:col-span-3">
            <Label htmlFor="daily-note">Комментарий дня</Label>
            <Textarea
              id="daily-note"
              className="min-h-24"
              placeholder="Что сработало, что помешало, что улучшить завтра"
              disabled={readOnly}
              onFocus={captureUndoSnapshot}
              {...form.register("dailyNote.content")}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="daily-mood">Настроение</Label>
            <Select id="daily-mood" disabled={readOnly} onFocus={captureUndoSnapshot} {...form.register("dailyNote.mood")}>
              <option value="">Не выбрано</option>
              <option value="спокойно">Спокойно</option>
              <option value="хорошо">Хорошо</option>
              <option value="напряженно">Напряженно</option>
              <option value="усталость">Усталость</option>
              <option value="сильный день">Сильный день</option>
            </Select>
          </div>
          <div className="space-y-2 lg:col-span-3">
            <Label>Энергия</Label>
            <div className="grid grid-cols-5 gap-2" role="group" aria-label="Оценка энергии">
              {energyOptions.map((option) => (
                <Button
                  key={option.value}
                  type="button"
                  variant={selectedEnergy === option.value ? "default" : "outline"}
                  className="h-auto min-h-14 flex-col gap-1 px-2 py-2 text-xs"
                  disabled={readOnly}
                  aria-label={`Энергия: ${option.value}, ${option.label}`}
                  onClick={() => {
                    captureUndoSnapshot();
                    form.setValue("dailyNote.energy", option.value, { shouldDirty: true });
                  }}
                >
                  <span className="text-base font-semibold">{option.value}</span>
                  <span className="hidden leading-tight sm:inline">{option.label}</span>
                </Button>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">Личная оценка самочувствия, не медицинский показатель.</p>
          </div>
        </CardContent>
      </Card>

      <div className="daily-savebar">
        <div className="min-w-0 text-sm text-muted-foreground">
          <div>
            {readOnly
              ? "Месяц закрыт: данные доступны только для просмотра"
              : isPending
                ? "Сохраняю..."
                : savedAt
                  ? `Сохранено в ${savedAt}`
                  : "Автосохранение включено"}
          </div>
          {saveError ? (
            <div className="mt-1 font-medium text-destructive">{saveError}</div>
          ) : null}
        </div>
        <div className="flex shrink-0 gap-2">
          <Button type="button" variant="outline" disabled={isPending || readOnly || !canUndo} onClick={undoLastChange}>
            <Undo2 className="h-4 w-4" />
            Отменить
          </Button>
          <Button type="submit" disabled={isPending || readOnly}>
            <Save className="h-4 w-4" />
            Сохранить день
          </Button>
        </div>
      </div>
    </form>
  );
}

function InputLikeNumber({
  id,
  value,
  unit,
  disabled,
  onFocus,
  onChange
}: {
  id: string;
  value: number | null;
  unit: string;
  disabled?: boolean;
  onFocus: () => void;
  onChange: (value: number | null) => void;
}) {
  return (
    <div className="relative">
      <Input
        id={id}
        type="number"
        min="0"
        step="any"
        value={value ?? ""}
        disabled={disabled}
        className="pr-20"
        onFocus={onFocus}
        onChange={(event) => {
          const next = event.currentTarget.value === "" ? null : Number(event.currentTarget.value);
          if (next === null || Number.isFinite(next)) {
            onChange(next);
          }
        }}
      />
      <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
        {unit}
      </span>
    </div>
  );
}
