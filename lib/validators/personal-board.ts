import { z } from "zod";

export const personalBoardSchema = z.object({
  title: z.string().trim().min(2, "Название доски слишком короткое").max(100),
  description: z.string().trim().max(500).optional()
});

export const personalBoardTaskSchema = z.object({
  boardId: z.string().uuid(),
  columnId: z.string().uuid(),
  title: z.string().trim().min(2, "Название задачи слишком короткое").max(160),
  description: z.string().trim().max(2_000).optional(),
  priority: z.enum(["low", "medium", "high", "urgent"]).default("medium"),
  dueDate: z.string().trim().optional(),
  goalId: z.string().uuid().or(z.literal("")).optional(),
  habitTaskId: z.string().uuid().or(z.literal("")).optional(),
  monthId: z.string().uuid().or(z.literal("")).optional()
});

export const personalBoardTaskUpdateSchema = personalBoardTaskSchema.extend({
  taskId: z.string().uuid()
});

export const personalBoardTaskMoveSchema = z.object({
  boardId: z.string().uuid(),
  taskId: z.string().uuid(),
  columnId: z.string().uuid()
});

export const personalBoardTaskArchiveSchema = z.object({
  boardId: z.string().uuid(),
  taskId: z.string().uuid()
});

export const personalBoardCommentSchema = z.object({
  taskId: z.string().uuid(),
  content: z.string().trim().min(1, "Введите комментарий").max(1_000)
});
