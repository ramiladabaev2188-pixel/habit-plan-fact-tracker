import Link from "next/link";
import { redirect } from "next/navigation";
import { deleteNoteAction, upsertNoteAction } from "@/app/actions";
import { NoteEditor } from "@/components/notes/note-editor";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { ConfirmSubmitButton } from "@/components/shared/confirm-submit-button";
import { ErrorState } from "@/components/shared/page-state";
import { SetupNotice } from "@/components/shared/setup-notice";
import { getTodayKey } from "@/lib/dates/month";
import { loadTrackerData } from "@/lib/supabase/data";

export default async function NotesPage({
  searchParams
}: {
  searchParams: Promise<{
    q?: string;
    date?: string;
    month?: string;
    task?: string;
    goal?: string;
    tag?: string;
    page?: string;
  }>;
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

  const { notes, months, selectedMonth, tasks, goals } = result.data;
  const query = (params.q ?? "").toLowerCase().trim();
  const tags = Array.from(new Set(notes.flatMap((note) => note.tags))).sort();
  const filteredNotes = notes.filter((note) => {
    const searchOk =
      !query ||
      note.title?.toLowerCase().includes(query) ||
      note.content.toLowerCase().includes(query) ||
      note.tags.some((tag) => tag.toLowerCase().includes(query));
    const dateOk = !params.date || note.date === params.date;
    const monthOk = !params.month || note.month_id === params.month;
    const taskOk = !params.task || params.task === "all" || note.task_id === params.task;
    const goalOk = !params.goal || params.goal === "all" || note.goal_id === params.goal;
    const tagOk = !params.tag || params.tag === "all" || note.tags.includes(params.tag);
    return searchOk && dateOk && monthOk && taskOk && goalOk && tagOk;
  });
  const pageSize = 10;
  const currentPage = Math.max(1, Number(params.page ?? 1) || 1);
  const totalPages = Math.max(1, Math.ceil(filteredNotes.length / pageSize));
  const pagedNotes = filteredNotes.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  return (
    <div className="space-y-5 md:pl-64">
      <div>
        <h1 className="text-2xl font-semibold tracking-normal">Заметки</h1>
        <p className="text-sm text-muted-foreground">Разбор дней, недель, месяцев, задач и целей.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Новая заметка</CardTitle>
          <CardDescription>Шаблоны помогают быстро начать разбор.</CardDescription>
        </CardHeader>
        <CardContent>
          <NoteEditor
            months={months}
            tasks={tasks}
            goals={goals}
            defaultMonthId={selectedMonth?.id}
            defaultDate={getTodayKey()}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Фильтры</CardTitle>
        </CardHeader>
        <CardContent>
          <form action="/notes" className="grid gap-3 md:grid-cols-3 xl:grid-cols-6">
            <div className="space-y-2">
              <Label>Поиск</Label>
              <Input name="q" defaultValue={params.q ?? ""} placeholder="Текст или тег" />
            </div>
            <div className="space-y-2">
              <Label>Дата</Label>
              <Input name="date" type="date" defaultValue={params.date ?? ""} />
            </div>
            <div className="space-y-2">
              <Label>Месяц</Label>
              <Select name="month" defaultValue={params.month ?? selectedMonth?.id ?? ""}>
                <option value="">Все месяцы</option>
                {months.map((month) => (
                  <option key={month.id} value={month.id}>
                    {month.title}
                  </option>
                ))}
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Задача</Label>
              <Select name="task" defaultValue={params.task ?? "all"}>
                <option value="all">Все задачи</option>
                {tasks.map((task) => (
                  <option key={task.id} value={task.id}>
                    {task.title}
                  </option>
                ))}
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Цель</Label>
              <Select name="goal" defaultValue={params.goal ?? "all"}>
                <option value="all">Все цели</option>
                {goals.map((goal) => (
                  <option key={goal.id} value={goal.id}>
                    {goal.title}
                  </option>
                ))}
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Тег</Label>
              <Select name="tag" defaultValue={params.tag ?? "all"}>
                <option value="all">Все теги</option>
                {tags.map((tag) => (
                  <option key={tag} value={tag}>
                    {tag}
                  </option>
                ))}
              </Select>
            </div>
            <Button type="submit" className="md:col-span-3 xl:col-span-1">Применить</Button>
          </form>
        </CardContent>
      </Card>

      {filteredNotes.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center">
            <div className="text-lg font-semibold">Заметок пока нет</div>
            <p className="mt-2 text-sm text-muted-foreground">Создайте заметку по дню, задаче, цели или месяцу.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 xl:grid-cols-2">
          {pagedNotes.map((note) => {
            const task = tasks.find((item) => item.id === note.task_id);
            const goal = goals.find((item) => item.id === note.goal_id);
            const month = months.find((item) => item.id === note.month_id);

            return (
              <Card key={note.id}>
                <CardHeader>
                  <CardTitle>{note.title || "Без заголовка"}</CardTitle>
                  <CardDescription>
                    {[note.date, month?.title, task?.title, goal?.title].filter(Boolean).join(" · ") || "Связи не заданы"}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="whitespace-pre-wrap rounded-md bg-muted/50 p-3 text-sm">
                    {note.content}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {note.tags.map((tag) => (
                      <Badge key={tag} variant="outline">{tag}</Badge>
                    ))}
                  </div>
                  <form action={upsertNoteAction} className="space-y-3 rounded-md border p-3">
                    <input type="hidden" name="id" value={note.id} />
                    <div className="grid gap-3 sm:grid-cols-2">
                      <Input name="title" defaultValue={note.title ?? ""} placeholder="Заголовок" />
                      <Input name="date" type="date" defaultValue={note.date ?? ""} />
                    </div>
                    <Textarea name="content" defaultValue={note.content} className="min-h-28" required />
                    <div className="grid gap-3 sm:grid-cols-2">
                      <Select name="monthId" defaultValue={note.month_id ?? ""}>
                        <option value="">Без месяца</option>
                        {months.map((item) => (
                          <option key={item.id} value={item.id}>{item.title}</option>
                        ))}
                      </Select>
                      <Select name="taskId" defaultValue={note.task_id ?? ""}>
                        <option value="">Без задачи</option>
                        {tasks.map((item) => (
                          <option key={item.id} value={item.id}>{item.title}</option>
                        ))}
                      </Select>
                      <Select name="goalId" defaultValue={note.goal_id ?? ""}>
                        <option value="">Без цели</option>
                        {goals.map((item) => (
                          <option key={item.id} value={item.id}>{item.title}</option>
                        ))}
                      </Select>
                      <Input name="tags" defaultValue={note.tags.join(", ")} placeholder="Теги через запятую" />
                    </div>
                    <Button type="submit" size="sm">Сохранить</Button>
                  </form>
                  <form action={deleteNoteAction}>
                    <input type="hidden" name="noteId" value={note.id} />
                    <ConfirmSubmitButton
                      type="submit"
                      variant="destructive"
                      size="sm"
                      message="Удалить заметку без восстановления?"
                    >
                      Удалить
                    </ConfirmSubmitButton>
                  </form>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {filteredNotes.length > pageSize ? (
        <div className="flex items-center justify-between gap-3 rounded-lg border bg-card p-3">
          <Button asChild variant="outline" size="sm" disabled={currentPage <= 1}>
            <Link href={createPageHref(params, currentPage - 1)}>Назад</Link>
          </Button>
          <div className="text-sm text-muted-foreground">
            Страница {currentPage} из {totalPages}
          </div>
          <Button asChild variant="outline" size="sm" disabled={currentPage >= totalPages}>
            <Link href={createPageHref(params, currentPage + 1)}>Вперед</Link>
          </Button>
        </div>
      ) : null}
    </div>
  );
}

function createPageHref(params: Record<string, string | undefined>, page: number) {
  const search = new URLSearchParams();

  for (const [key, value] of Object.entries(params)) {
    if (key !== "page" && value) {
      search.set(key, value);
    }
  }

  search.set("page", String(Math.max(1, page)));
  return `/notes?${search.toString()}`;
}
