"use client";

import { useState } from "react";
import { upsertNoteAction } from "@/app/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { Goal, Month, Task } from "@/types/domain";

const templates = [
  "Почему был провал?",
  "Что сработало?",
  "Что улучшить завтра?",
  "Итог дня",
  "Итог недели",
  "Итог месяца"
];

export function NoteEditor({
  months,
  tasks,
  goals,
  defaultMonthId,
  defaultDate
}: {
  months: Month[];
  tasks: Task[];
  goals: Goal[];
  defaultMonthId?: string;
  defaultDate?: string;
}) {
  const [content, setContent] = useState("");

  return (
    <form action={upsertNoteAction} className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="note-title">Заголовок</Label>
          <Input id="note-title" name="title" placeholder="Коротко о заметке" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="note-date">Дата</Label>
          <Input id="note-date" name="date" type="date" defaultValue={defaultDate} />
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {templates.map((template) => (
          <Button
            key={template}
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              setContent((current) => (current ? `${current}\n\n## ${template}\n` : `## ${template}\n`));
            }}
          >
            {template}
          </Button>
        ))}
      </div>

      <div className="space-y-2">
        <Label htmlFor="note-content">Текст</Label>
        <Textarea
          id="note-content"
          name="content"
          value={content}
          onChange={(event) => setContent(event.currentTarget.value)}
          placeholder="Мысли, причины, выводы, следующий шаг..."
          className="min-h-40"
          required
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="space-y-2">
          <Label>Месяц</Label>
          <Select name="monthId" defaultValue={defaultMonthId ?? ""}>
            <option value="">Без месяца</option>
            {months.map((month) => (
              <option key={month.id} value={month.id}>
                {month.title}
              </option>
            ))}
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Задача</Label>
          <Select name="taskId" defaultValue="">
            <option value="">Без задачи</option>
            {tasks.map((task) => (
              <option key={task.id} value={task.id}>
                {task.title}
              </option>
            ))}
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Цель</Label>
          <Select name="goalId" defaultValue="">
            <option value="">Без цели</option>
            {goals.map((goal) => (
              <option key={goal.id} value={goal.id}>
                {goal.title}
              </option>
            ))}
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="note-tags">Теги</Label>
          <Input id="note-tags" name="tags" placeholder="сон, провал, вывод" />
        </div>
      </div>

      <Button type="submit">Создать заметку</Button>
    </form>
  );
}
