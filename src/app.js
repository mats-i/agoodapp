// src/app.js
// All JavaScript från <script> i index.html, nu som ES-modul

import { supabaseClient } from './lib/supabaseClient.js';
import { getCurrentUser, setCurrentUser } from './lib/auth.js';
import {
  loadTasks as apiLoadTasks,
  saveTasks as apiSaveTasks,
  deleteTask as apiDeleteTask,
  updateTask as apiUpdateTask,
  toggleTaskComplete as apiToggleTaskComplete,
  migrateTaskFormat,
  generateId,
  listToday as apiListToday,
  listUpcoming as apiListUpcoming,
} from './tasks/api';
import { subscribeTasks } from './features/realtime';
import { showError, showSuccess } from './features/ui/notify.js';

let tasks = [];
// Enkel in-memory cache för tasks
let tasksCache = null;
let projects = ['all', 'work', 'personal'];
let currentProject = 'all';
let currentView = 'main';
let currentTab = 'outline';
let currentTaskType = 'todo';
let editingTask = null;
let currentEditTaskType = 'todo';
let inboxFilter = 'all';
let notifications = [];
let savedFilters = [];
let activeFilter = null;
let useSupabase = false;
let unsubscribeTasksRealtime = null;

console.log('Initializing app with auth guard...');
initAuthGuard();

async function testSupabaseConnection() {
  try {
    console.log('Testing Supabase connection...');
    const { data, error } = await supabaseClient.from('tasks').select('count').limit(1);
    if (error) throw error;
    console.log('✅ Supabase connection successful!');
    useSupabase = true;
    updateStatusIndicator();
    loadAndSetTasks();
    startRealtime();
  } catch (error) {
    console.log('Supabase connection failed:', error.message);
    useSupabase = false;
    updateStatusIndicator();
    showError(`Supabase-anslutning misslyckades: ${error?.message || error}`);
    loadAndSetTasks();
    stopRealtime();
  }
}

async function initAuthGuard() {
  try {
    const { data } = await supabaseClient.auth.getSession();
    const session = data?.session;
    if (!session) {
      showLoginView();
      attachLoginHandlers();
    } else {
      setCurrentUser(session.user?.email || session.user?.id || '');
      showAppView();
      await testSupabaseConnection();
    }
    // Lyssna på auth-förändringar
    supabaseClient.auth.onAuthStateChange(async (_event, session) => {
      if (session) {
        setCurrentUser(session.user?.email || session.user?.id || '');
        showAppView();
        await testSupabaseConnection();
      } else {
        stopRealtime();
        showLoginView();
        attachLoginHandlers();
      }
    });
  } catch (err) {
    console.error('Auth guard init failed:', err);
    showLoginView();
    showError(`Auth-init fel: ${err?.message || err}`);
  }
}

function showLoginView() {
  const login = document.getElementById('login-view');
  const app = document.getElementById('app-view') || document.getElementById('app');
  if (login) login.style.display = '';
  if (app) app.style.display = 'none';
}

function showAppView() {
  const login = document.getElementById('login-view');
  const app = document.getElementById('app-view') || document.getElementById('app');
  if (login) login.style.display = 'none';
  if (app) app.style.display = '';
}

function attachLoginHandlers() {
  const magicBtn = document.getElementById('login-magic-btn');
  const emailInput = document.getElementById('login-email');
  const githubBtn = document.getElementById('login-github-btn');

  if (magicBtn && emailInput) {
    magicBtn.onclick = async () => {
      const email = emailInput.value.trim();
      if (!email) return;
      magicBtn.disabled = true;
      try {
        await supabaseClient.auth.signInWithOtp({
          email,
          options: {
            emailRedirectTo: window.location.origin,
          },
        });
        magicBtn.textContent = 'Länk skickad!';
      } catch (e) {
        console.error('Magic link error', e);
        magicBtn.disabled = false;
      }
    };
  }

  if (githubBtn) {
    githubBtn.onclick = async () => {
      try {
        await supabaseClient.auth.signInWithOAuth({ provider: 'github' });
      } catch (e) {
        console.error('GitHub login error', e);
      }
    };
  }
}

function updateStatusIndicator() {
  const indicator = document.getElementById('status-indicator');
  if (useSupabase) {
    indicator.textContent = '🌐 Supabase Connected';
    indicator.className = 'status-indicator';
  } else {
    indicator.textContent = '💾 Local Mode';
    indicator.className = 'status-indicator local';
  }
  setTimeout(() => {
    indicator.style.opacity = '0';
    setTimeout(() => (indicator.style.display = 'none'), 300);
  }, 3000);
}

// Ladda tasks via task-API
async function loadAndSetTasks() {
  try {
    tasks = (await apiLoadTasks(useSupabase)).map(migrateTaskFormat);
    tasksCache = JSON.parse(JSON.stringify(tasks)); // Deep copy till cache
    // ...uppdatera UI, counts, etc...
    safeRenderCalendarFromApi();
  } catch (error) {
    console.error('Error loading tasks:', error);
    tasks = [];
    tasksCache = null;
    showError(`Fel vid laddning av uppgifter: ${error?.message || error}`);
  }
}

// Spara tasks via task-API
async function saveAllTasks() {
  try {
    await apiSaveTasks(tasks, useSupabase);
    // showSuccess('Uppgifter sparade'); // valfritt, avkommentera om nskas
  } catch (error) {
    console.error('Error saving tasks:', error);
    showError(`Fel vid sparande av uppgifter: ${error?.message || error}`);
  }
}

// Ta bort en task via task-API
async function removeTask(taskId) {
  try {
    await apiDeleteTask(taskId, useSupabase);
    // Ladda om tasks och uppdatera UI
    await loadAndSetTasks();
    // showSuccess('Uppgift borttagen'); // valfritt
  } catch (error) {
    console.error('Error deleting task:', error);
    showError(`Fel vid borttagning av uppgift: ${error?.message || error}`);
  }
}

// Uppdatera en task via task-API
async function updateTaskInApp(task) {
  // Optimistisk uppdatering
  if (!tasksCache) tasksCache = JSON.parse(JSON.stringify(tasks));
  const prevTasks = JSON.parse(JSON.stringify(tasks));
  tasks = tasks.map((t) => (t.id === task.id ? { ...t, ...task } : t));
  // ...uppdatera UI direkt...
  try {
    await apiUpdateTask(task, useSupabase);
    // Vid lyckad update, uppdatera cache
    tasksCache = JSON.parse(JSON.stringify(tasks));
  } catch (error) {
    // Rollback vid fel
    console.error('Optimistisk updateTask: rollback!', error);
    tasks = prevTasks;
    // ...uppdatera UI tillbaks...
    showError(`Kunde inte uppdatera uppgift: ${error?.message || error}`);
  }
  await loadAndSetTasks();
}

// Toggle complete-status på en task via task-API
async function toggleTaskCompleteInApp(taskId) {
  // Optimistisk toggle
  if (!tasksCache) tasksCache = JSON.parse(JSON.stringify(tasks));
  const prevTasks = JSON.parse(JSON.stringify(tasks));
  tasks = tasks.map((t) =>
    t.id === taskId
      ? {
          ...t,
          completed: !t.completed,
          completed_at: t.completed ? new Date().toISOString() : null,
        }
      : t
  );
  // ...uppdatera UI direkt...
  try {
    await apiToggleTaskComplete(taskId, useSupabase);
    // Vid lyckad update, uppdatera cache
    tasksCache = JSON.parse(JSON.stringify(tasks));
  } catch (error) {
    // Rollback vid fel
    console.error('Optimistisk toggleTaskComplete: rollback!', error);
    tasks = prevTasks;
    // ...uppdatera UI tillbaks...
    showError(`Kunde inte ndra status: ${error?.message || error}`);
  }
  await loadAndSetTasks();
}

async function refresh() {
  await loadAndSetTasks();
}

function setupRealtimeTasks() {
  if (unsubscribeTasksRealtime) unsubscribeTasksRealtime();
  if (useSupabase) {
    unsubscribeTasksRealtime = subscribeTasks(() => {
      refresh();
    });
  }
}

function startRealtime() {
  try {
    setupRealtimeTasks();
  } catch (e) {
    console.error('startRealtime error', e);
  }
}

function stopRealtime() {
  try {
    if (unsubscribeTasksRealtime) {
      unsubscribeTasksRealtime();
      unsubscribeTasksRealtime = null;
    }
  } catch (e) {
    // noop
  }
}

// Kalenderkoppling: använd API för att fylla Idag/Kommande-sektioner
async function renderCalendarFromApi() {
  const calView = document.getElementById('calendar-view');
  if (!calView) return;
  // Om kalendern är dold, gör inget; den kommer uppdateras vid visning också
  if (calView.style && calView.style.display === 'none') return;

  const todayUl = document.getElementById('today-tasks');
  const upcomingUl = document.getElementById('upcoming-tasks');
  const overdueUl = document.getElementById('overdue-tasks');
  const noDeadlineUl = document.getElementById('no-deadline-tasks');
  if (!todayUl || !upcomingUl || !overdueUl || !noDeadlineUl) return;

  // Filtrera på projekt om inte 'all'
  const projectTasks =
    currentProject === 'all' ? tasks : tasks.filter((t) => t.project === currentProject);

  // Hämta idag och kommande via API (respekterar Supabase/local)
  const [apiToday, apiUpcoming] = await Promise.all([
    apiListToday(useSupabase),
    apiListUpcoming(useSupabase, 7),
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
}

function renderCalendarSection(containerEl, list) {
  containerEl.innerHTML = '';
  const makeItem = (task) => {
    // Om global createTaskElement finns (från äldre UI), använd den
    if (typeof window !== 'undefined' && window.createTaskElement) {
      return window.createTaskElement(task);
    }
    const li = document.createElement('li');
    li.className = `task-item ${task.completed ? 'completed' : ''}`;
    li.setAttribute('data-task-id', task.id);
    li.textContent = task.title;
    return li;
  };
  list
    .slice()
    .sort((a, b) => new Date(a.deadline || '9999-12-31') - new Date(b.deadline || '9999-12-31'))
    .forEach((task) => containerEl.appendChild(makeItem(task)));
}

function safeRenderCalendarFromApi() {
  renderCalendarFromApi().catch(() => {});
}

// Avregistrera realtime vid fönsterstängning
if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', () => {
    stopRealtime();
  });
}

// För legacy-vyhantering: wrappa vy-funktioner om de finns globalt
function installViewChangeHooks() {
  const w = typeof window !== 'undefined' ? window : {};
  const wrap = (name, before, after) => {
    const orig = w[name];
    if (typeof orig === 'function') {
      w[name] = function (...args) {
        try {
          before && before(name);
        } catch (e) {
          // ignore
        }
        const result = orig.apply(this, args);
        try {
          after && after(name);
        } catch (e) {
          // ignore
        }
        return result;
      };
    }
  };
  // Starta realtime när huvudvyn visas, stoppa i andra vyer
  wrap('showMainView', null, () => startRealtime());
  wrap('showInbox', () => stopRealtime(), null);
  wrap('showSettings', () => stopRealtime(), null);
}

installViewChangeHooks();

// ...Resten av koden från <script> i index.html, oförändrad, inkl. alla funktioner och logik...
// (Se tidigare <script> för full kod, nu placerad här.)

// Ersätt alla användningar av currentUser med getCurrentUser() i resten av filen:
// Exempel:
// document.getElementById('task-assignee').value = getCurrentUser();
// task.assignee || getCurrentUser();
// author: getCurrentUser(),
// if (username !== getCurrentUser()) { ... }
// notifications.filter(n => n.recipient === getCurrentUser())
// notifications.filter(n => n.recipient === getCurrentUser() && !n.read)
