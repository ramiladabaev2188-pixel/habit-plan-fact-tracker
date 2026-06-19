"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { AlertTriangle, ClipboardCheck, Copy, Save } from "lucide-react";
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
import { dailyNoteSchema, factValueSchema } from "@/lib/validators/tracker";
import { cn, formatScore } from "@/lib/utils";
import type { Category, DailyFact, DailyNote, DailyPlan, Task } from "@/types/domain";

const factOptions = [0, 0.25, 0.5, 0.75, 1, 1.25, 1.5, 2];

const dailyFormSchema = z.object({
  entries: z.array(
    z.object({
      taskId: z.string().uuid(),
      actualValue: factValueSchema,
      note: z.string().optional()
    })
  ),
  dailyNote: dailyNoteSchema.optional()
});

type DailyForm = z.infer<typeof dailyFormSchema>;

type DailyItem = {
  task: Task;
  category: Category | null;
  plan: DailyPlan;
  fact: DailyFact | null;
};

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
  const [filledTaskIds, setFilledTaskIds] = useState<Set<string>>(
    () => new Set(items.filter((item) => item.fact).map((item) => item.task.id))
  );
  const initialRender = useRef(true);
  const defaultValues = useMemo<DailyForm>(
    () => ({
      entries: items.map((item) => ({
        taskId: item.task.id,
        actualValue: item.fact?.actual_value ?? 0,
        note: item.fact?.note ?? ""
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

  useEffect(() => {
    form.reset(defaultValues);
    setFilledTaskIds(new Set(items.filter((item) => item.fact).map((item) => item.task.id)));
    initialRender.current = true;
  }, [defaultValues, form, items]);

  const markFilled = useCallback((taskId: string) => {
    setFilledTaskIds((current) => {
      const next = new Set(current);
      next.add(taskId);
      return next;
    });
  }, []);

  const setFactValue = useCallback((index: number, taskId: string, value: number) => {
    form.setValue(`entries.${index}.actualValue`, value, { shouldDirty: true, shouldValidate: true });
    markFilled(taskId);
  }, [form, markFilled]);

  const save = useCallback(async (values: DailyForm) => {
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
    setSavedAt(new Date().toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" }));
    router.refresh();
  }, [date, monthId, router]);

  const closePlannedAsDone = useCallback(() => {
    items.forEach((item, index) => {
      setFactValue(index, item.task.id, 1);
    });
  }, [items, setFactValue]);

  const markUnfilledAsZero = useCallback(() => {
    items.forEach((item, index) => {
      if (!filledTaskIds.has(item.task.id)) {
        setFactValue(index, item.task.id, 0);
      }
    });
  }, [filledTaskIds, items, setFactValue]);

  const copyYesterday = useCallback(() => {
    const copiedTaskIds = new Set<string>();

    items.forEach((item, index) => {
      const yesterday = yesterdayByTask.get(item.task.id);

      if (!yesterday) {
        return;
      }

      form.setValue(`entries.${index}.actualValue`, yesterday.actual_value, { shouldDirty: true, shouldValidate: true });
      form.setValue(`entries.${index}.note`, yesterday.note ?? "", { shouldDirty: true });
      copiedTaskIds.add(item.task.id);
    });

    if (copiedTaskIds.size > 0) {
      setFilledTaskIds((current) => new Set([...current, ...copiedTaskIds]));
    }
  }, [form, items, yesterdayByTask]);

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
    }, 900);

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
      <Card>
        <CardHeader className="space-y-3">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <CardTitle>Быстрый ввод</CardTitle>
            <Badge variant={hasUnfilled ? "warning" : "success"}>
              заполнено {filledCount} из {items.length}
            </Badge>
          </div>
          {hasUnfilled ? (
            <div className="flex items-start gap-2 rounded-md border border-warning/40 bg-warning/10 p-3 text-sm">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
              Остались пустые факты. Перед сохранением можно отметить их нулем одной кнопкой.
            </div>
          ) : null}
        </CardHeader>
        <CardContent className="grid gap-2 sm:grid-cols-3">
          <Button type="button" variant="success" disabled={readOnly} onClick={closePlannedAsDone}>
            <ClipboardCheck className="h-4 w-4" />
            Закрыть план как 1
          </Button>
          <Button type="button" variant="outline" disabled={readOnly || !hasUnfilled} onClick={markUnfilledAsZero}>
            0 для пустых
          </Button>
          <Button type="button" variant="secondary" disabled={readOnly || yesterdayFacts.length === 0} onClick={copyYesterday}>
            <Copy className="h-4 w-4" />
            Факт со вчера
          </Button>
        </CardContent>
      </Card>

      {groups.map((group) => (
        <details key={group.category?.id ?? "without-category"} open className="group overflow-hidden rounded-lg border bg-card/95 shadow-[0_18px_60px_-48px_rgba(15,23,42,0.75)]">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-3 bg-muted/35 p-4">
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
          <div className="space-y-3 border-t p-3">
            {group.rows.map(({ item, index }) => {
              const current = watchedEntries[index]?.actualValue ?? 0;
              const stateClass =
                current >= item.plan.planned_value
                  ? "border-success/50 bg-success/10"
                  : current > 0
                    ? "border-warning/60 bg-warning/10"
                    : "border-destructive/40 bg-destructive/10";

              return (
                <Card key={item.task.id} className={cn("overflow-hidden transition-colors", stateClass)}>
                  <CardContent className="space-y-4 p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge variant="info">Вес {formatScore(item.task.weight)}</Badge>
                          <Badge variant="outline">План {formatScore(item.plan.planned_value)}</Badge>
                        </div>
                        <h2 className="mt-2 text-base font-semibold tracking-normal">{item.task.title}</h2>
                      </div>
                      <div className="text-right text-sm">
                        <div className="font-semibold">
                          {formatScore(current * item.task.weight)} / {formatScore(item.plan.planned_score)}
                        </div>
                        <div className="text-muted-foreground">факт / план</div>
                      </div>
                    </div>

                    <input type="hidden" {...form.register(`entries.${index}.taskId`)} />
                    <div className="grid grid-cols-4 gap-2 sm:grid-cols-8">
                      {factOptions.map((value) => (
                        <Button
                          key={value}
                          type="button"
                          variant={current === value ? "default" : "outline"}
                          className={cn(
                            "h-12 px-2 text-base sm:h-11 sm:text-sm",
                            current === value && "scale-[1.02]"
                          )}
                          disabled={readOnly}
                          onClick={() => setFactValue(index, item.task.id, value)}
                        >
                          {value}
                        </Button>
                      ))}
                    </div>

                    <Textarea
                      placeholder="Комментарий к задаче"
                      className="min-h-16"
                      disabled={readOnly}
                      {...form.register(`entries.${index}.note`)}
                    />
                    {form.formState.errors.entries?.[index]?.actualValue ? (
                      <p className="text-sm text-destructive">
                        {form.formState.errors.entries[index]?.actualValue?.message}
                      </p>
                    ) : null}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </details>
      ))}

      <Card>
        <CardHeader>
          <CardTitle>Заметка дня</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 lg:grid-cols-[1fr_180px_160px]">
          <div className="space-y-2 lg:col-span-3">
            <Label htmlFor="daily-note">Комментарий дня</Label>
            <Textarea
              id="daily-note"
              className="min-h-24"
              placeholder="Что сработало, что помешало, что улучшить завтра"
              disabled={readOnly}
              {...form.register("dailyNote.content")}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="daily-mood">Настроение</Label>
            <Select id="daily-mood" disabled={readOnly} {...form.register("dailyNote.mood")}>
              <option value="">Не выбрано</option>
              <option value="спокойно">Спокойно</option>
              <option value="хорошо">Хорошо</option>
              <option value="напряженно">Напряженно</option>
              <option value="усталость">Усталость</option>
              <option value="сильный день">Сильный день</option>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="daily-energy">Энергия</Label>
            <Input
              id="daily-energy"
              type="number"
              min={1}
              max={5}
              disabled={readOnly}
              {...form.register("dailyNote.energy")}
            />
          </div>
        </CardContent>
      </Card>

      <div className="sticky bottom-20 z-20 flex items-center justify-between gap-3 rounded-lg border bg-card p-3 shadow-lg md:bottom-4">
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
        <Button type="submit" disabled={isPending || readOnly}>
          <Save className="h-4 w-4" />
          Сохранить день
        </Button>
      </div>
    </form>
  );
}
