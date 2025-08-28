// src/features/tasks/ui.ts
// Render helpers for task UI

export type SimpleTask = {
  id: string;
  title: string;
  status?: 'todo' | 'in_progress' | 'done' | string;
  completed?: boolean;
};

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Returnerar HTML för en task-rad med checkbox och titel.
 * Om status = 'done' (eller completed = true) → strike-through på titeln.
 */
export function TaskItem(task: SimpleTask): string {
  const isDone = task.status === 'done' || !!task.completed;
  const checkedAttr = isDone ? ' checked' : '';
  const title = escapeHtml(task.title || '');
  const titleStyle = isDone ? ' style="text-decoration: line-through;"' : '';

  return `
<li class="task-item" data-task-id="${escapeHtml(task.id)}">
  <input type="checkbox" class="task-checkbox"${checkedAttr} aria-label="Markera som klar" />
  <span class="task-title"${titleStyle}>${title}</span>
</li>
`.trim();
}
