// src/bridge/calendar-bridge.js
// Bridge to hook tasks API into existing Calendar tab without refactoring legacy script

import { listToday, listUpcoming } from '../tasks/api.js';

function makeItem(task) {
  if (typeof window !== 'undefined' && window.createTaskElement) {
    return window.createTaskElement(task);
  }
  const li = document.createElement('li');
  li.className = `task-item ${task.completed ? 'completed' : ''}`;
  li.setAttribute('data-task-id', task.id);
  li.textContent = task.title;
  return li;
}

function renderCalendarSection(containerEl, list) {
  if (!containerEl) return;
  containerEl.innerHTML = '';
  list
    .slice()
    .sort((a, b) => new Date(a.deadline || '9999-12-31') - new Date(b.deadline || '9999-12-31'))
    .forEach((task) => containerEl.appendChild(makeItem(task)));
}

export async function renderCalendarFromApi() {
  const todayUl = document.getElementById('today-tasks');
  const upcomingUl = document.getElementById('upcoming-tasks');
  const overdueUl = document.getElementById('overdue-tasks');
  const noDeadlineUl = document.getElementById('no-deadline-tasks');
  if (!todayUl || !upcomingUl || !overdueUl || !noDeadlineUl) return;

  // Global state from legacy script
  const allTasks = Array.isArray(window.tasks) ? window.tasks : [];
  const currentProject = window.currentProject || 'all';
  const useSupabase = Boolean(window.useSupabase);

  // Project filter applied to base set
  const projectTasks =
    currentProject === 'all' ? allTasks : allTasks.filter((t) => t.project === currentProject);

  const [apiToday, apiUpcoming] = await Promise.all([
    listToday(useSupabase),
    listUpcoming(useSupabase, 7),
  ]);
  const todaySet = new Set(apiToday.map((t) => t.id));
  const upcomingSet = new Set(apiUpcoming.map((t) => t.id));

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const overdue = [];
  const todayTasks = [];
  const upcoming = [];
  const noDeadline = [];

  for (const task of projectTasks) {
    if (!task.deadline) {
      noDeadline.push(task);
      continue;
    }
    const d = new Date(task.deadline);
    d.setHours(0, 0, 0, 0);
    if (d < today && !task.completed) {
      overdue.push(task);
    } else if (todaySet.has(task.id)) {
      todayTasks.push(task);
    } else if (upcomingSet.has(task.id)) {
      upcoming.push(task);
    } else {
      noDeadline.push(task);
    }
  }

  renderCalendarSection(overdueUl, overdue);
  renderCalendarSection(todayUl, todayTasks);
  renderCalendarSection(upcomingUl, upcoming);
  renderCalendarSection(noDeadlineUl, noDeadline);

  // Update counts
  const setCount = (id, n) => {
    const el = document.getElementById(id);
    if (el) el.textContent = n || '';
  };
  setCount('overdue-count', overdue.length);
  setCount('today-count', todayTasks.length);
  setCount('upcoming-count', upcoming.length);
  setCount('no-deadline-count', noDeadline.length);
}

// Expose for legacy UI
if (typeof window !== 'undefined') {
  window.renderCalendarFromApi = renderCalendarFromApi;
}
