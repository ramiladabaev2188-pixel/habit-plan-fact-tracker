"use client";

import { useMemo, useState } from "react";
import { Play, Square } from "lucide-react";
import { createFocusSessionAction } from "@/app/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { Task } from "@/types/domain";

type FocusSessionFormProps = {
  tasks: Task[];
};

export function FocusSessionForm({ tasks }: FocusSessionFormProps) {
  const [startedAt, setStartedAt] = useState("");
  const [endedAt, setEndedAt] = useState("");

  const duration = useMemo(() => {
    if (!startedAt || !endedAt) return "";
    const start = new Date(startedAt).getTime();
    const end = new Date(endedAt).getTime();
    if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) return "";
    return String(Math.round((end - start) / 60000));
  }, [endedAt, startedAt]);

  const nowLocal = () => {
    const date = new Date();
    date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
    return date.toISOString().slice(0, 16);
  };

  return (
    <form action={createFocusSessionAction} className="section-panel grid gap-4 p-4 sm:p-5">
      <div>
        <div className="page-kicker">Фокус-сессия</div>
        <h2 className="mt-1 text-xl font-semibold tracking-normal">Записать рабочий блок</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Это не тайм-трекер ради контроля. Цель — видеть, какие задачи получают настоящее внимание.
        </p>
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="focus-task">Задача</Label>
          <Select id="focus-task" name="taskId" defaultValue="">
            <option value="">Без привязки</option>
            {tasks.map((task) => (
              <option key={task.id} value={task.id}>
                {task.title}
              </option>
            ))}
          </Select>
        </div>
        <div className="grid grid-cols-2 gap-2 self-end">
          <Button type="button" variant="secondary" onClick={() => setStartedAt(nowLocal())}>
            <Play className="h-4 w-4" />
            Старт
          </Button>
          <Button type="button" variant="outline" onClick={() => setEndedAt(nowLocal())}>
            <Square className="h-4 w-4" />
            Стоп
          </Button>
        </div>
      </div>

      <div className="grid gap-3 lg:grid-cols-3">
        <div className="space-y-2">
          <Label htmlFor="startedAt">Начало</Label>
          <Input id="startedAt" name="startedAt" type="datetime-local" value={startedAt} onChange={(event) => setStartedAt(event.target.value)} required />
        </div>
        <div className="space-y-2">
          <Label htmlFor="endedAt">Конец</Label>
          <Input id="endedAt" name="endedAt" type="datetime-local" value={endedAt} onChange={(event) => setEndedAt(event.target.value)} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="durationMinutes">Минуты</Label>
          <Input id="durationMinutes" name="durationMinutes" type="number" min="0" value={duration} readOnly placeholder="Автоматически" />
        </div>
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="focus-note">Заметка</Label>
          <Textarea id="focus-note" name="note" placeholder="Что было в фокусе" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="focus-outcome">Результат</Label>
          <Textarea id="focus-outcome" name="outcome" placeholder="Что получилось в конце блока" />
        </div>
      </div>

      <div className="flex justify-end">
        <Button type="submit">Сохранить фокус</Button>
      </div>
    </form>
  );
}
