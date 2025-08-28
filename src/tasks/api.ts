import { supabaseClient } from '../lib/supabaseClient.js';
import { getCurrentUser } from '../lib/auth.js';
import { TaskSchema, Task } from '../types';
import { showError } from '../features/ui/notify.js';

export async function loadTasks(useSupabase: boolean): Promise<Task[]> {
  let tasksRaw;
  if (useSupabase) {
    const { data, error } = await supabaseClient
      .from('tasks')
      .select('*')
      .order('created_at', { ascending: true });
    if (error) throw error;
    tasksRaw = data || [];
  } else {
    const savedTasks = localStorage.getItem('agoodapp_tasks');
    tasksRaw = savedTasks ? JSON.parse(savedTasks) : [];
  }
  // Validate all tasks
  return tasksRaw.map((t: any) => TaskSchema.parse(t));
}

export async function saveTasks(tasks: Task[], useSupabase: boolean): Promise<Task[]> {
  // Validate all tasks
  const validTasks = tasks.map((t) => TaskSchema.parse(t));
  localStorage.setItem('agoodapp_tasks', JSON.stringify(validTasks));
  if (useSupabase) {
    try {
      for (const task of validTasks) {
        const { error } = await supabaseClient.from('tasks').upsert(task);
        if (error) throw error;
      }
    } catch (e) {
      showError(`Fel vid sparande i Supabase: ${e instanceof Error ? e.message : String(e)}`);
      throw e;
    }
  }
  return validTasks;
}

export async function deleteTask(taskId: string, useSupabase: boolean): Promise<Task[]> {
  if (useSupabase) {
    await supabaseClient.from('tasks').delete().eq('id', taskId);
  }
  // Remove from local array and localStorage
  let tasks: Task[] = JSON.parse(localStorage.getItem('agoodapp_tasks') || '[]');
  tasks = tasks.filter((task) => task.id !== taskId);
  localStorage.setItem('agoodapp_tasks', JSON.stringify(tasks));
  return tasks.map((t) => TaskSchema.parse(t));
}

export async function updateTask(updatedTask: Task, useSupabase: boolean): Promise<Task> {
  const validTask = TaskSchema.parse(updatedTask);
  if (useSupabase) {
    try {
      await supabaseClient.from('tasks').upsert(validTask);
    } catch (e) {
      showError(`Fel vid uppdatering i Supabase: ${e instanceof Error ? e.message : String(e)}`);
      throw e;
    }
  }
  // Uppdatera i localStorage
  let tasks: Task[] = JSON.parse(localStorage.getItem('agoodapp_tasks') || '[]');
  tasks = tasks.map((task) => (task.id === validTask.id ? validTask : task));
  localStorage.setItem('agoodapp_tasks', JSON.stringify(tasks));
  return validTask;
}

export async function toggleTaskComplete(
  taskId: string,
  useSupabase: boolean
): Promise<Task | undefined> {
  const tasks: Task[] = JSON.parse(localStorage.getItem('agoodapp_tasks') || '[]');
  const task = tasks.find((t) => t.id === taskId);
  if (!task) return;
  task.completed = !task.completed;
  task.completed_at = task.completed ? new Date().toISOString() : null;
  return await updateTask(task, useSupabase);
}

export function migrateTaskFormat(task: any): Task {
  return TaskSchema.parse({
    id: task.id ? String(task.id) : generateId(),
    title: task.title || 'Untitled Task',
    type: task.type || 'todo',
    priority: task.priority || 'medium',
    assignee: task.assignee || getCurrentUser(),
    deadline: task.deadline || null,
    project: task.project || 'work',
    completed: Boolean(task.completed),
    parent_id: task.parent_id || null,
    collapsed: Boolean(task.collapsed),
    notes: Array.isArray(task.notes) ? task.notes : [],
    agile: task.agile || 'later',
    estimated_hours: task.estimated_hours || null,
    created_at: task.created_at || new Date().toISOString(),
    completed_at: task.completed_at || null,
    // Behåll sort_order om befintlig; lämna annars undefined
    sort_order: typeof task.sort_order === 'number' ? task.sort_order : undefined,
  });
}

export function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

// Bulk-uppdatera sort_order för en uppsättning tasks
export async function updateTaskOrders(
  updates: Array<{ id: string; sort_order: number }>,
  useSupabase: boolean
): Promise<Task[]> {
  // Validera input
  updates.forEach((u) => {
    if (!u || typeof u.id !== 'string' || typeof u.sort_order !== 'number') {
      throw new Error('Invalid update payload for updateTaskOrders');
    }
  });

  // Uppdatera localStorage
  let tasks: Task[] = JSON.parse(localStorage.getItem('agoodapp_tasks') || '[]');
  const map = new Map(updates.map((u) => [u.id, u.sort_order]));
  tasks = tasks.map((t) => (map.has(t.id) ? { ...t, sort_order: map.get(t.id)! } : t));
  localStorage.setItem('agoodapp_tasks', JSON.stringify(tasks));

  // Spara i Supabase (bulk upsert endast på berörda fält)
  if (useSupabase && updates.length) {
    const payload = updates.map((u) => ({ id: u.id, sort_order: u.sort_order }));
    const { error } = await supabaseClient.from('tasks').upsert(payload, { onConflict: 'id' });
    if (error) throw error;
  }

  // Returnera validerade tasks
  return tasks.map((t) => TaskSchema.parse(t));
}

// Lista tasks med deadline idag
export async function listToday(useSupabase: boolean): Promise<Task[]> {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);

  if (useSupabase) {
    const { data, error } = await supabaseClient
      .from('tasks')
      .select('*')
      .gte('deadline', start.toISOString())
      .lt('deadline', end.toISOString());
    if (error) throw error;
    return (data || []).map((t: any) => TaskSchema.parse(t));
  }
  const tasks: Task[] = JSON.parse(localStorage.getItem('agoodapp_tasks') || '[]');
  return tasks
    .filter((t) => !!t.deadline)
    .filter((t) => {
      const d = new Date(t.deadline as any);
      return d >= start && d < end;
    })
    .map((t) => TaskSchema.parse(t));
}

// Lista tasks med deadline kommande N dagar (standard 7)
export async function listUpcoming(useSupabase: boolean, days = 7): Promise<Task[]> {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + days + 1); // include the next N full days

  if (useSupabase) {
    const { data, error } = await supabaseClient
      .from('tasks')
      .select('*')
      .gt('deadline', start.toISOString())
      .lt('deadline', end.toISOString());
    if (error) throw error;
    return (data || []).map((t: any) => TaskSchema.parse(t));
  }
  const tasks: Task[] = JSON.parse(localStorage.getItem('agoodapp_tasks') || '[]');
  return tasks
    .filter((t) => !!t.deadline)
    .filter((t) => {
      const d = new Date(t.deadline as any);
      return d > start && d < end;
    })
    .map((t) => TaskSchema.parse(t));
}
