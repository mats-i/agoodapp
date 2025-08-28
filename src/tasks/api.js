// src/tasks/api.js
// Task API för AGoodApp (ren JavaScript-version för runtime i browsern)

import { supabaseClient } from '../lib/supabaseClient.js';
import { getCurrentUser } from '../lib/auth.js';
import { showError } from '../features/ui/notify.js';

// Hjälp: säker JSON parse
function readLocalTasks() {
  try {
    return JSON.parse(localStorage.getItem('agoodapp_tasks') || '[]');
  } catch {
    return [];
  }
}

// Läs alla tasks (Supabase eller localStorage)
export async function loadTasks(useSupabase) {
  if (useSupabase) {
    const { data, error } = await supabaseClient
      .from('tasks')
      .select('*')
      .order('created_at', { ascending: true });
    if (error) throw error;
    return data || [];
  }
  return readLocalTasks();
}

// Spara alla tasks till localStorage och (om aktiverat) Supabase
export async function saveTasks(tasks, useSupabase) {
  localStorage.setItem('agoodapp_tasks', JSON.stringify(tasks));
  if (useSupabase) {
    try {
      for (const task of tasks) {
        const { error } = await supabaseClient.from('tasks').upsert(task);
        if (error) throw error;
      }
    } catch (e) {
      showError(`Fel vid sparande i Supabase: ${e?.message || e}`);
      throw e;
    }
  }
  return tasks;
}

// Uppdatera en task
export async function updateTask(updatedTask, useSupabase) {
  if (useSupabase) {
    try {
      const { error } = await supabaseClient.from('tasks').upsert(updatedTask);
      if (error) throw error;
    } catch (e) {
      showError(`Fel vid uppdatering i Supabase: ${e?.message || e}`);
      throw e;
    }
  }
  let tasks = readLocalTasks();
  tasks = tasks.map((t) => (t.id === updatedTask.id ? { ...t, ...updatedTask } : t));
  localStorage.setItem('agoodapp_tasks', JSON.stringify(tasks));
  return updatedTask;
}

// Toggle complete-status på en task
export async function toggleTaskComplete(taskId, useSupabase) {
  let tasks = readLocalTasks();
  const task = tasks.find((t) => t.id === taskId);
  if (!task) return undefined;
  task.completed = !task.completed;
  task.completed_at = task.completed ? new Date().toISOString() : null;
  return await updateTask(task, useSupabase);
}

// Ta bort en task
export async function deleteTask(taskId, useSupabase) {
  if (useSupabase) {
    try {
      await supabaseClient.from('tasks').delete().eq('id', taskId);
    } catch (e) {
      showError(`Fel vid borttagning i Supabase: ${e?.message || e}`);
      throw e;
    }
  }
  let tasks = readLocalTasks();
  tasks = tasks.filter((task) => task.id !== taskId);
  localStorage.setItem('agoodapp_tasks', JSON.stringify(tasks));
  return tasks;
}

// Migrera äldre task-format till nytt
export function migrateTaskFormat(task) {
  return {
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
    estimated_hours: task.estimated_hours ?? null,
    created_at: task.created_at || new Date().toISOString(),
    completed_at: task.completed_at ?? null,
    // sort_order kan saknas i äldre data
    sort_order: typeof task.sort_order === 'number' ? task.sort_order : undefined,
  };
}

export function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2);
}

// Bulk-uppdatera sort_order
export async function updateTaskOrders(updates, useSupabase) {
  let tasks = readLocalTasks();
  const map = new Map(updates.map((u) => [u.id, u.sort_order]));
  tasks = tasks.map((t) => (map.has(t.id) ? { ...t, sort_order: map.get(t.id) } : t));
  localStorage.setItem('agoodapp_tasks', JSON.stringify(tasks));

  if (useSupabase && updates.length) {
    try {
      const payload = updates.map((u) => ({ id: u.id, sort_order: u.sort_order }));
      const { error } = await supabaseClient.from('tasks').upsert(payload, { onConflict: 'id' });
      if (error) throw error;
    } catch (e) {
      showError(`Fel vid sorteringsuppdatering i Supabase: ${e?.message || e}`);
      throw e;
    }
  }
  return tasks;
}

// Lista tasks med deadline idag
export async function listToday(useSupabase) {
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
    return data || [];
  }
  const tasks = readLocalTasks();
  return tasks.filter(
    (t) =>
      t.deadline &&
      inRange(new Date(t.deadline), start, end, { includeStart: true, includeEnd: false })
  );
}

// Lista tasks med deadline kommande N dagar (default 7)
export async function listUpcoming(useSupabase, days = 7) {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + days + 1); // inkluderar kommande N hela dagar

  if (useSupabase) {
    const { data, error } = await supabaseClient
      .from('tasks')
      .select('*')
      .gt('deadline', start.toISOString())
      .lt('deadline', end.toISOString());
    if (error) throw error;
    return data || [];
  }
  const tasks = readLocalTasks();
  return tasks.filter(
    (t) =>
      t.deadline &&
      inRange(new Date(t.deadline), start, end, { includeStart: false, includeEnd: false })
  );
}

function inRange(date, start, end, { includeStart = true, includeEnd = false } = {}) {
  const d = new Date(date);
  return (includeStart ? d >= start : d > start) && (includeEnd ? d <= end : d < end);
}
