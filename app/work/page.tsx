import { redirect } from "next/navigation";
import { upsertWorkCaseAction, upsertWorkProjectAction, upsertWorkSkillAction } from "@/app/actions";
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
import { workStatusLabels } from "@/lib/practical";
import { loadTrackerData, loadWorkPage } from "@/lib/supabase/data";
import { formatPercent } from "@/lib/utils";

export default async function WorkPage() {
  const [trackerResult, workResult] = await Promise.all([
    loadTrackerData(undefined, { includeGoals: true }),
    loadWorkPage()
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

  if (workResult.error) {
    return <ErrorState message={workResult.error} />;
  }

  const careerArea = trackerResult.data.lifeAreas.find((area) => area.name.toLowerCase().includes("работ"));
  const activeProjects = workResult.projects.filter((project) => project.status === "active").length;
  const completedCases = workResult.cases.length;
  const averageSkill =
    workResult.skills.length
      ? workResult.skills.reduce((sum, skill) => sum + skill.level / skill.target_level, 0) / workResult.skills.length
      : 0;

  return (
    <div className="app-page space-y-6">
      <div className="workspace-header">
        <div>
          <div className="page-kicker">Практический контур</div>
          <h1 className="workspace-title mt-1">Работа и рост дохода</h1>
          <p className="workspace-subtitle">
            Проекты, навыки и кейсы. Здесь собираются доказательства профессионального роста для резюме, работы и бизнеса.
          </p>
        </div>
        {careerArea ? <Badge variant="info">Сфера: {careerArea.name}</Badge> : null}
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        <Metric title="Активные проекты" value={String(activeProjects)} />
        <Metric title="Кейсы" value={String(completedCases)} />
        <Metric title="Средний уровень навыков" value={formatPercent(averageSkill)} />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="section-panel">
          <CardHeader>
            <CardTitle>Проект</CardTitle>
            <CardDescription>Что сейчас двигает карьеру или доход.</CardDescription>
          </CardHeader>
          <CardContent>
            <form action={upsertWorkProjectAction} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="project-title">Название</Label>
                <Input id="project-title" name="title" placeholder="Новый лендинг для клиента" required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="project-status">Статус</Label>
                <Select id="project-status" name="status" defaultValue="active">
                  <option value="active">В работе</option>
                  <option value="paused">Пауза</option>
                  <option value="completed">Завершен</option>
                  <option value="archived">Архив</option>
                </Select>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <DateField id="project-start" name="startDate" label="Старт" />
                <DateField id="project-due" name="dueDate" label="Дедлайн" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="project-description">Описание</Label>
                <Textarea id="project-description" name="description" />
              </div>
              <Button type="submit">Сохранить проект</Button>
            </form>
          </CardContent>
        </Card>

        <Card className="section-panel">
          <CardHeader>
            <CardTitle>Навык</CardTitle>
            <CardDescription>Уровень от 1 до 10 и целевой уровень.</CardDescription>
          </CardHeader>
          <CardContent>
            <form action={upsertWorkSkillAction} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="skill-name">Название</Label>
                <Input id="skill-name" name="name" placeholder="Продажи, Next.js, дизайн" required />
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <NumberField id="skill-level" name="level" label="Сейчас" defaultValue={3} min={1} max={10} />
                <NumberField id="skill-target" name="targetLevel" label="Цель" defaultValue={7} min={1} max={10} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="skill-comment">Комментарий</Label>
                <Textarea id="skill-comment" name="comment" />
              </div>
              <Button type="submit">Сохранить навык</Button>
            </form>
          </CardContent>
        </Card>

        <Card className="section-panel">
          <CardHeader>
            <CardTitle>Кейс</CardTitle>
            <CardDescription>Фиксируйте результат в формате было → стало.</CardDescription>
          </CardHeader>
          <CardContent>
            <form action={upsertWorkCaseAction} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="case-title">Название</Label>
                <Input id="case-title" name="title" placeholder="Ускорил dashboard" required />
              </div>
              <TextAreaField id="case-problem" name="problem" label="Проблема" />
              <TextAreaField id="case-actions" name="actions" label="Что сделал" />
              <TextAreaField id="case-result" name="result" label="Результат" />
              <div className="grid gap-3 sm:grid-cols-2">
                <TextAreaField id="metrics-before" name="metricsBefore" label="Было" />
                <TextAreaField id="metrics-after" name="metricsAfter" label="Стало" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="case-skills">Навыки через запятую</Label>
                <Input id="case-skills" name="skills" placeholder="аналитика, фронтенд, коммуникация" />
              </div>
              <Button type="submit">Сохранить кейс</Button>
            </form>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_1fr]">
        <Card className="section-panel">
          <CardHeader>
            <CardTitle>Проекты</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {workResult.projects.length ? (
              workResult.projects.map((project) => (
                <div key={project.id} className="rounded-lg border border-border/80 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="font-semibold">{project.title}</div>
                      {project.description ? <p className="mt-1 text-sm text-muted-foreground">{project.description}</p> : null}
                    </div>
                    <Badge variant={project.status === "active" ? "success" : "outline"}>{workStatusLabels[project.status]}</Badge>
                  </div>
                  <div className="mt-3 text-sm text-muted-foreground">
                    {project.start_date ?? "без старта"} → {project.due_date ?? "без дедлайна"}
                  </div>
                </div>
              ))
            ) : (
              <Empty text="Проектов пока нет." />
            )}
          </CardContent>
        </Card>

        <Card className="section-panel">
          <CardHeader>
            <CardTitle>Навыки</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {workResult.skills.length ? (
              workResult.skills.map((skill) => {
                const progress = skill.target_level > 0 ? skill.level / skill.target_level : 0;
                return (
                  <div key={skill.id} className="rounded-lg border border-border/80 p-4">
                    <div className="flex justify-between gap-3">
                      <div className="font-semibold">{skill.name}</div>
                      <div className="text-sm text-muted-foreground">
                        {skill.level} / {skill.target_level}
                      </div>
                    </div>
                    <Progress className="mt-3" value={Math.min(progress, 1) * 100} />
                    {skill.comment ? <p className="mt-2 text-sm text-muted-foreground">{skill.comment}</p> : null}
                  </div>
                );
              })
            ) : (
              <Empty text="Навыков пока нет." />
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="section-panel">
        <CardHeader>
          <CardTitle>Кейсы и результаты</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 lg:grid-cols-2">
          {workResult.cases.length ? (
            workResult.cases.map((workCase) => (
              <div key={workCase.id} className="rounded-lg border border-border/80 p-4">
                <div className="font-semibold">{workCase.title}</div>
                {workCase.result ? <p className="mt-2 text-sm text-muted-foreground">{workCase.result}</p> : null}
                <div className="mt-3 grid gap-3 text-sm sm:grid-cols-2">
                  <div className="rounded-md bg-fog p-3">
                    <div className="text-xs text-muted-foreground">Было</div>
                    <div className="mt-1">{workCase.metrics_before || "—"}</div>
                  </div>
                  <div className="rounded-md bg-fog p-3">
                    <div className="text-xs text-muted-foreground">Стало</div>
                    <div className="mt-1">{workCase.metrics_after || "—"}</div>
                  </div>
                </div>
                {workCase.skills.length ? (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {workCase.skills.map((skill) => (
                      <Badge key={skill} variant="outline">
                        {skill}
                      </Badge>
                    ))}
                  </div>
                ) : null}
              </div>
            ))
          ) : (
            <div className="lg:col-span-2">
              <Empty text="Кейсов пока нет. Добавьте первый результат: что было, что сделали, что стало лучше." />
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function Metric({ title, value }: { title: string; value: string }) {
  return (
    <Card className="section-panel">
      <CardContent className="p-5">
        <div className="text-sm text-muted-foreground">{title}</div>
        <div className="mt-3 text-3xl font-semibold">{value}</div>
      </CardContent>
    </Card>
  );
}

function DateField({ id, name, label }: { id: string; name: string; label: string }) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <Input id={id} name={name} type="date" />
    </div>
  );
}

function NumberField({
  id,
  name,
  label,
  defaultValue,
  min,
  max
}: {
  id: string;
  name: string;
  label: string;
  defaultValue: number;
  min: number;
  max: number;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <Input id={id} name={name} type="number" min={min} max={max} defaultValue={defaultValue} required />
    </div>
  );
}

function TextAreaField({ id, name, label }: { id: string; name: string; label: string }) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <Textarea id={id} name={name} />
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return <div className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">{text}</div>;
}
