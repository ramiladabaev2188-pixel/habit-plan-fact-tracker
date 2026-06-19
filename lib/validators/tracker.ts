import { z } from "zod";

const quarterStep = (value: number) => Math.round(value * 4) === value * 4;

export const factValueSchema = z
  .number()
  .min(0, "Значение не может быть меньше 0")
  .max(2, "Значение не может быть больше 2")
  .refine(quarterStep, "Значение должно быть кратно 0.25");

export const planValueSchema = z
  .number()
  .min(0, "План не может быть отрицательным")
  .max(2, "Для MVP план ограничен шкалой 0-2")
  .refine(quarterStep, "План должен быть кратен 0.25");

export const monthSchema = z.object({
  year: z.coerce.number().int().min(2020).max(2100),
  month: z.coerce.number().int().min(1).max(12),
  title: z.string().trim().min(2, "Укажите название месяца")
});

export const categorySchema = z.object({
  name: z.string().trim().min(2, "Название слишком короткое"),
  color: z.string().trim().regex(/^#[0-9a-fA-F]{6}$/, "Укажите цвет в формате HEX")
});

export const categoryUpdateSchema = categorySchema.extend({
  id: z.string().uuid()
});

export const taskSchema = z.object({
  categoryId: z.string().uuid("Выберите категорию"),
  title: z.string().trim().min(2, "Название слишком короткое"),
  description: z.string().trim().optional(),
  weight: z.coerce.number().positive("Вес должен быть больше 0").max(20)
});

export const taskUpdateSchema = taskSchema.extend({
  id: z.string().uuid()
});

export const entityIdSchema = z.string().uuid();

export const taskActiveSchema = z.object({
  id: z.string().uuid(),
  isActive: z.enum(["true", "false"]).transform((value) => value === "true")
});

export const planGenerationSchema = z.object({
  monthId: z.string().uuid(),
  taskId: z.string().uuid(),
  mode: z.enum(["daily", "weekdays", "weekends", "specific_weekdays", "specific_dates", "n_times_per_month", "manual"]),
  plannedValue: z.coerce.number().pipe(planValueSchema),
  weekdays: z.array(z.coerce.number().int().min(0).max(6)).default([]),
  timesPerMonth: z.coerce.number().int().min(1).max(31).optional(),
  specificDates: z.array(z.string().trim()).default([])
});

export const settingsSchema = z.object({
  name: z.string().trim().min(1, "Введите имя").max(80),
  timezone: z.string().trim().min(1),
  targetPercent: z.coerce.number().min(0.1).max(2)
});

export const preferencesSchema = z.object({
  dailyReminderEnabled: z.coerce.boolean().default(false),
  dailyReminderTime: z.string().trim().regex(/^([01][0-9]|2[0-3]):[0-5][0-9]$/, "Укажите время в формате HH:mm"),
  riskAlertsEnabled: z.coerce.boolean().default(true),
  theme: z.enum(["light", "dark", "system"]),
  defaultMonthTarget: z.coerce.number().min(0.1).max(2)
});

export const goalSchema = z.object({
  id: z.string().uuid().optional(),
  title: z.string().trim().min(2, "Название слишком короткое"),
  description: z.string().trim().optional(),
  type: z.enum(["long_term", "monthly", "weekly"]),
  status: z.enum(["active", "completed", "paused", "archived"]),
  priority: z.enum(["low", "medium", "high"]),
  startDate: z.string().trim().optional(),
  dueDate: z.string().trim().optional(),
  taskIds: z.array(z.string().uuid()).default([])
});

export const noteSchema = z.object({
  id: z.string().uuid().optional(),
  title: z.string().trim().optional(),
  content: z.string().trim().min(1, "Введите текст заметки"),
  tags: z.string().trim().optional(),
  monthId: z.string().uuid().or(z.literal("")).optional(),
  taskId: z.string().uuid().or(z.literal("")).optional(),
  goalId: z.string().uuid().or(z.literal("")).optional(),
  date: z.string().trim().optional()
});

export const dailyNoteSchema = z.object({
  content: z.string().trim().optional(),
  mood: z.string().trim().optional(),
  energy: z.coerce.number().int().min(1).max(5).or(z.literal("")).optional()
});

export const copyMonthTemplateSchema = z.object({
  sourceMonthId: z.string().uuid(),
  year: z.coerce.number().int().min(2020).max(2100),
  month: z.coerce.number().int().min(1).max(12),
  title: z.string().trim().min(2, "Укажите название месяца"),
  copyAllTasks: z.coerce.boolean().default(false),
  onlyActive: z.coerce.boolean().default(true),
  excludeTasksWithoutPlan: z.coerce.boolean().default(true),
  keepCategories: z.coerce.boolean().default(true),
  keepGoalLinks: z.coerce.boolean().default(true)
});

export const importPreviewSchema = z.object({
  payload: z.string().trim().min(2, "Вставьте JSON")
});

export const teamSchema = z.object({
  name: z.string().trim().min(2, "Название команды слишком короткое").max(80),
  description: z.string().trim().max(500).optional()
});

export const teamInviteSchema = z.object({
  teamId: z.string().uuid(),
  email: z.string().trim().email("Укажите email").or(z.literal("")).optional(),
  role: z.enum(["admin", "member"]).default("member")
});

export const teamInviteTokenSchema = z.string().trim().min(12, "Некорректная ссылка приглашения");

export const leaveTeamSchema = z.object({
  teamId: z.string().uuid()
});
