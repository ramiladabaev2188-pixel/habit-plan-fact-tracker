import { z } from "zod";

const quarterStep = (value: number) => Math.round(value * 4) === value * 4;

export const factValueSchema = z
  .number()
  .min(0, "Значение не может быть меньше 0")
  .max(1000000, "Значение слишком большое");

export const ratioFactValueSchema = z
  .number()
  .min(0, "Значение не может быть меньше 0")
  .max(2, "Значение не может быть больше 2")
  .refine(quarterStep, "Значение должно быть кратно 0.25");

export const dateKeySchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Укажите дату в формате ГГГГ-ММ-ДД")
  .refine((value) => {
    const [year, month, day] = value.split("-").map(Number);
    const date = new Date(Date.UTC(year, month - 1, day));

    return (
      date.getUTCFullYear() === year &&
      date.getUTCMonth() === month - 1 &&
      date.getUTCDate() === day
    );
  }, "Укажите существующую дату");

export const planValueSchema = z
  .number()
  .min(0, "План не может быть отрицательным")
  .max(1000000, "План слишком большой");

export const monthSchema = z.object({
  year: z.coerce.number().int().min(2020).max(2100),
  month: z.coerce.number().int().min(1).max(12),
  title: z.string().trim().min(2, "Укажите название месяца")
});

export const lifeAreaSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().trim().min(2, "Название сферы слишком короткое").max(80),
  color: z.string().trim().regex(/^#[0-9a-fA-F]{6}$/, "Укажите цвет в формате HEX"),
  icon: z.string().trim().max(64).optional(),
  description: z.string().trim().max(500).optional(),
  sortOrder: z.coerce.number().int().min(0).max(10_000).optional()
});

export const categorySchema = z.object({
  name: z.string().trim().min(2, "Название слишком короткое"),
  color: z.string().trim().regex(/^#[0-9a-fA-F]{6}$/, "Укажите цвет в формате HEX"),
  lifeAreaId: z.string().uuid().or(z.literal("")).optional()
});

export const categoryUpdateSchema = categorySchema.extend({
  id: z.string().uuid()
});

const taskBaseSchema = z.object({
  categoryId: z.string().uuid("Выберите категорию"),
  title: z.string().trim().min(2, "Название слишком короткое"),
  description: z.string().trim().optional(),
  weight: z.coerce.number().positive("Вес должен быть больше 0").max(20),
  inputMode: z.enum(["ratio", "measured"]).default("ratio"),
  unit: z.string().trim().max(24, "Единица слишком длинная").optional()
});

function validateTaskInputMode(value: z.infer<typeof taskBaseSchema>, ctx: z.RefinementCtx) {
  if (value.inputMode === "measured" && !value.unit?.trim()) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["unit"],
      message: "Для измеримой задачи укажите единицу"
    });
  }
}

export const taskSchema = taskBaseSchema.superRefine(validateTaskInputMode);

export const taskUpdateSchema = taskBaseSchema.extend({
  id: z.string().uuid()
}).superRefine(validateTaskInputMode);

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
  lifeAreaId: z.string().uuid().or(z.literal("")).optional(),
  type: z.enum(["long_term", "monthly", "weekly"]),
  status: z.enum(["active", "completed", "paused", "archived"]),
  priority: z.enum(["low", "medium", "high"]),
  whyText: z.string().trim().optional(),
  targetValue: z.coerce.number().nonnegative().or(z.literal("")).optional(),
  currentValue: z.coerce.number().nonnegative().or(z.literal("")).optional(),
  unit: z.string().trim().optional(),
  desiredIdentity: z.string().trim().optional(),
  progressMode: z.enum(["linked_tasks", "manual_value", "mixed"]).default("linked_tasks"),
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

export const missReasonSchema = z.enum([
  "no_time",
  "low_energy",
  "forgot",
  "not_important",
  "overloaded_plan",
  "health",
  "other_priorities",
  "no_conditions",
  "other"
]);

export const weeklyReviewSchema = z.object({
  monthId: z.string().uuid(),
  weekNumber: z.coerce.number().int().min(1).max(5),
  startDate: dateKeySchema,
  endDate: dateKeySchema,
  workedWell: z.string().trim().max(2000).optional(),
  didntWork: z.string().trim().max(2000).optional(),
  blockers: z.string().trim().max(2000).optional(),
  repeatNext: z.string().trim().max(2000).optional(),
  removeNext: z.string().trim().max(2000).optional(),
  lesson: z.string().trim().max(2000).optional(),
  nextWeekFocus: z.string().trim().max(2000).optional()
});

export const experimentSchema = z.object({
  id: z.string().uuid().optional(),
  title: z.string().trim().min(2, "Название эксперимента слишком короткое").max(140),
  hypothesis: z.string().trim().max(1000).optional(),
  lifeAreaId: z.string().uuid().or(z.literal("")).optional(),
  startDate: dateKeySchema,
  endDate: dateKeySchema,
  status: z.enum(["draft", "active", "completed", "archived"]).default("draft"),
  successMetric: z.string().trim().max(500).optional(),
  resultSummary: z.string().trim().max(1500).optional(),
  conclusion: z.string().trim().max(1500).optional()
});

export const experimentCheckinSchema = z.object({
  experimentId: z.string().uuid(),
  date: dateKeySchema,
  value: z.coerce.number().min(0).max(1000),
  note: z.string().trim().max(1000).optional()
});

export const lifeEventSchema = z.object({
  id: z.string().uuid().optional(),
  title: z.string().trim().min(2, "Название события слишком короткое").max(160),
  description: z.string().trim().max(1200).optional(),
  lifeAreaId: z.string().uuid().or(z.literal("")).optional(),
  goalId: z.string().uuid().or(z.literal("")).optional(),
  eventDate: dateKeySchema,
  type: z.enum([
    "achievement",
    "milestone",
    "decision",
    "failure",
    "recovery",
    "purchase",
    "health",
    "finance",
    "work",
    "family",
    "faith",
    "custom"
  ]),
  importance: z.coerce.number().int().min(1).max(5)
});

export const financeSnapshotSchema = z.object({
  date: dateKeySchema,
  income: z.coerce.number().min(0).max(1_000_000_000).default(0),
  requiredExpenses: z.coerce.number().min(0).max(1_000_000_000).default(0),
  optionalExpenses: z.coerce.number().min(0).max(1_000_000_000).default(0),
  savings: z.coerce.number().min(-1_000_000_000).max(1_000_000_000).default(0),
  debtTotal: z.coerce.number().min(0).max(1_000_000_000).default(0),
  investments: z.coerce.number().min(0).max(1_000_000_000).default(0),
  comment: z.string().trim().max(1000).optional()
});

export const financeGoalSchema = z.object({
  id: z.string().uuid().optional(),
  title: z.string().trim().min(2, "Название цели слишком короткое").max(140),
  targetAmount: z.coerce.number().positive("Цель должна быть больше 0").max(1_000_000_000),
  currentAmount: z.coerce.number().min(0).max(1_000_000_000).default(0),
  dueDate: dateKeySchema.or(z.literal("")).optional(),
  lifeAreaId: z.string().uuid().or(z.literal("")).optional(),
  goalId: z.string().uuid().or(z.literal("")).optional()
});

export const healthLogSchema = z.object({
  date: dateKeySchema,
  weight: z.coerce.number().positive().max(500).or(z.literal("")).optional(),
  sleepHours: z.coerce.number().min(0).max(24).or(z.literal("")).optional(),
  energy: z.coerce.number().int().min(1).max(5).or(z.literal("")).optional(),
  mood: z.string().trim().max(80).optional(),
  painLevel: z.coerce.number().int().min(0).max(10).or(z.literal("")).optional(),
  workoutDone: z.coerce.boolean().default(false),
  steps: z.coerce.number().int().min(0).max(200_000).or(z.literal("")).optional(),
  comment: z.string().trim().max(1000).optional()
});

export const carSystemSchema = z.enum([
  "engine",
  "transmission",
  "transfer_case",
  "front_diff",
  "rear_diff",
  "brakes",
  "spark_plugs",
  "filters",
  "antifreeze",
  "power_steering",
  "battery",
  "tires",
  "other"
]);

export const carSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().trim().min(2, "Название авто слишком короткое").max(100),
  brand: z.string().trim().max(80).optional(),
  model: z.string().trim().max(80).optional(),
  year: z.coerce.number().int().min(1950).max(2100).or(z.literal("")).optional(),
  currentMileage: z.coerce.number().int().min(0).max(5_000_000).default(0)
});

export const carServiceItemSchema = z.object({
  id: z.string().uuid().optional(),
  carId: z.string().uuid(),
  name: z.string().trim().min(2, "Название узла слишком короткое").max(120),
  system: carSystemSchema,
  lastServiceDate: dateKeySchema.or(z.literal("")).optional(),
  lastServiceMileage: z.coerce.number().int().min(0).max(5_000_000).or(z.literal("")).optional(),
  intervalMonths: z.coerce.number().int().min(1).max(240).or(z.literal("")).optional(),
  intervalKm: z.coerce.number().int().min(1).max(500_000).or(z.literal("")).optional(),
  comment: z.string().trim().max(1000).optional()
});

export const carServiceLogSchema = z.object({
  carId: z.string().uuid(),
  serviceItemId: z.string().uuid().or(z.literal("")).optional(),
  serviceDate: dateKeySchema,
  mileage: z.coerce.number().int().min(0).max(5_000_000),
  cost: z.coerce.number().min(0).max(100_000_000).default(0),
  comment: z.string().trim().max(1000).optional()
});

export const workProjectSchema = z.object({
  id: z.string().uuid().optional(),
  title: z.string().trim().min(2, "Название проекта слишком короткое").max(160),
  description: z.string().trim().max(1200).optional(),
  status: z.enum(["active", "paused", "completed", "archived"]).default("active"),
  startDate: dateKeySchema.or(z.literal("")).optional(),
  dueDate: dateKeySchema.or(z.literal("")).optional()
});

export const workCaseSchema = z.object({
  id: z.string().uuid().optional(),
  title: z.string().trim().min(2, "Название кейса слишком короткое").max(160),
  problem: z.string().trim().max(2000).optional(),
  actions: z.string().trim().max(3000).optional(),
  result: z.string().trim().max(2000).optional(),
  metricsBefore: z.string().trim().max(1000).optional(),
  metricsAfter: z.string().trim().max(1000).optional(),
  conclusion: z.string().trim().max(2000).optional(),
  skills: z.string().trim().max(500).optional()
});

export const workSkillSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().trim().min(2, "Название навыка слишком короткое").max(100),
  level: z.coerce.number().int().min(1).max(10),
  targetLevel: z.coerce.number().int().min(1).max(10),
  comment: z.string().trim().max(1000).optional()
});

export const passwordChangeSchema = z
  .object({
    currentPassword: z.string().min(1, "Введите текущий пароль").max(128, "Пароль слишком длинный"),
    newPassword: z.string().min(12, "Новый пароль должен быть не короче 12 символов").max(128, "Пароль слишком длинный"),
    confirmPassword: z.string().min(12, "Подтвердите новый пароль").max(128, "Пароль слишком длинный")
  })
  .refine((value) => value.newPassword === value.confirmPassword, {
    message: "Новый пароль и подтверждение не совпадают",
    path: ["confirmPassword"]
  })
  .refine((value) => value.currentPassword !== value.newPassword, {
    message: "Новый пароль должен отличаться от текущего",
    path: ["newPassword"]
  });

export const onboardingSchema = z.object({
  name: z.string().trim().min(1, "Введите имя").max(80),
  lifeAreaIds: z.array(z.string().uuid()).default([]),
  desiredIdentity: z.string().trim().min(3, "Опишите версию себя").max(500),
  goal1: z.string().trim().min(2, "Укажите первую цель").max(160),
  goal2: z.string().trim().max(160).optional(),
  goal3: z.string().trim().max(160).optional(),
  blockers: z.array(z.string().trim().max(80)).default([]),
  mode: z.enum(["recovery", "normal", "push"]).default("normal"),
  starterTemplate: z.enum(["balanced", "health", "discipline", "work"]).default("balanced")
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
  payload: z
    .string()
    .trim()
    .min(2, "Вставьте JSON")
    .max(2_000_000, "Файл импорта слишком большой. Максимум 2 МБ.")
});

export const signInSchema = z.object({
  email: z.string().trim().email("Укажите корректную почту").max(320),
  password: z.string().min(6, "Пароль слишком короткий").max(128, "Пароль слишком длинный")
});

export const signUpSchema = z.object({
  name: z.string().trim().min(1, "Введите имя").max(80),
  email: z.string().trim().email("Укажите корректную почту").max(320),
  password: z
    .string()
    .min(12, "Для нового аккаунта используйте пароль не короче 12 символов")
    .max(128, "Пароль слишком длинный")
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

const teamInitiativeFields = z.object({
  teamId: z.string().uuid(),
  title: z.string().trim().min(2, "Название слишком короткое").max(120),
  description: z.string().trim().max(800).optional(),
  unit: z.string().trim().min(1, "Укажите единицу измерения").max(24),
  targetValue: z.coerce.number().positive("Цель должна быть больше нуля").max(1_000_000),
  startDate: z.string().trim().optional(),
  dueDate: z.string().trim().optional()
});

export const teamGoalSchema = teamInitiativeFields;

export const teamChallengeSchema = teamInitiativeFields.extend({
  status: z.enum(["draft", "active"]).default("active")
});

export const teamContributionSchema = z.object({
  teamId: z.string().uuid(),
  initiativeId: z.string().uuid(),
  value: z.coerce.number().positive("Вклад должен быть больше нуля").max(1_000_000),
  note: z.string().trim().max(500).optional(),
  date: z.string().trim().optional()
});

export const teamBoardSchema = z.object({
  teamId: z.string().uuid(),
  title: z.string().trim().min(2, "Название доски слишком короткое").max(100),
  description: z.string().trim().max(500).optional()
});

export const teamBoardTaskSchema = z.object({
  teamId: z.string().uuid(),
  boardId: z.string().uuid(),
  columnId: z.string().uuid(),
  title: z.string().trim().min(2, "Название задачи слишком короткое").max(160),
  description: z.string().trim().max(2_000).optional(),
  priority: z.enum(["low", "medium", "high", "urgent"]).default("medium"),
  assigneeId: z.string().uuid().or(z.literal("")).optional(),
  dueDate: z.string().trim().optional()
});

export const teamBoardTaskMoveSchema = z.object({
  teamId: z.string().uuid(),
  boardId: z.string().uuid(),
  taskId: z.string().uuid(),
  columnId: z.string().uuid()
});

export const teamBoardCommentSchema = z.object({
  teamId: z.string().uuid(),
  boardId: z.string().uuid(),
  taskId: z.string().uuid(),
  content: z.string().trim().min(1, "Введите комментарий").max(1_000)
});
