// src/types.ts
import { z } from 'zod';

export const TaskSchema = z.object({
  id: z.string(),
  title: z.string(),
  type: z.enum(['todo', 'note']),
  priority: z.enum(['low', 'medium', 'high']),
  assignee: z.string(),
  deadline: z.string().nullable(),
  project: z.string(),
  completed: z.boolean(),
  // sort order for manual ordering in a list (increasing numbers mean lower in the list)
  sort_order: z.number().optional(),
  parent_id: z.string().nullable().optional(),
  collapsed: z.boolean().optional(),
  notes: z.array(z.any()).optional(),
  agile: z.enum(['now', 'next', 'later']),
  estimated_hours: z.number().nullable().optional(),
  created_at: z.string(),
  completed_at: z.string().nullable().optional(),
});

export type Task = z.infer<typeof TaskSchema>;
