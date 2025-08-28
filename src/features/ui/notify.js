// src/features/ui/notify.js
// Samma notifier som TS-varianten, i ren JS fr direktladdning i browsern

let stylesInjected = false;
function ensureStyles() {
  if (stylesInjected) return;
  stylesInjected = true;
  const style = document.createElement('style');
  style.setAttribute('data-agoodapp-notify', '');
  style.textContent = `
    .notify-container{position:fixed;top:16px;right:16px;z-index:2147483647;display:flex;flex-direction:column;gap:8px}
    .notify-toast{min-width:240px;max-width:380px;padding:10px 12px;border-radius:8px;color:#fff;box-shadow:0 6px 16px rgba(0,0,0,.15);display:flex;align-items:flex-start;gap:10px;opacity:0;transform:translateY(-6px);animation:notify-in .2s ease-out forwards}
    .notify-toast.success{background:#10b981}
    .notify-toast.error{background:#ef4444}
    .notify-icon{font-size:16px;line-height:1.2;margin-top:2px}
    .notify-message{flex:1;white-space:pre-wrap}
    .notify-close{background:transparent;border:none;color:inherit;font-size:16px;cursor:pointer;opacity:.9}
    @keyframes notify-in{to{opacity:1;transform:translateY(0)}}
    @keyframes notify-out{to{opacity:0;transform:translateY(-6px)}}
  `;
  document.head.appendChild(style);
}

function getContainer() {
  let el = document.querySelector('.notify-container');
  if (!el) {
    el = document.createElement('div');
    el.className = 'notify-container';
    el.setAttribute('role', 'region');
    el.setAttribute('aria-label', 'Meddelanden');
    document.body.appendChild(el);
  }
  return el;
}

function show(kind, message, opts) {
  ensureStyles();
  const duration = (opts && opts.duration) || 3500;
  const container = getContainer();

  const toast = document.createElement('div');
  toast.className = `notify-toast ${kind}`;
  toast.setAttribute('role', kind === 'error' ? 'alert' : 'status');

  const icon = document.createElement('div');
  icon.className = 'notify-icon';
  icon.textContent = kind === 'error' ? '⚠️' : '✅';

  const text = document.createElement('div');
  text.className = 'notify-message';
  text.textContent = message;

  const close = document.createElement('button');
  close.className = 'notify-close';
  close.setAttribute('aria-label', 'Stäng');
  close.textContent = '×';
  const remove = () => {
    toast.style.animation = 'notify-out .18s ease-in forwards';
    setTimeout(() => toast.remove(), 200);
  };
  close.onclick = remove;

  toast.appendChild(icon);
  toast.appendChild(text);
  toast.appendChild(close);
  container.appendChild(toast);

  if (duration > 0) setTimeout(remove, duration);
}

export function showSuccess(message, opts) {
  show('success', message, opts);
}

export function showError(message, opts) {
  const msg =
    typeof message === 'string' ? message : (message && message.message) || 'Ett fel inträffade';
  show('error', msg, opts);
}
