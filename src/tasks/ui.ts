// @ts-nocheck
import { updateTaskOrders } from '../tasks/api';

/**
 * Initierar drag-and-drop för en tasklista utan ramverk.
 * Förväntar att varje task-element har attributet data-task-id och att listcontainern har id `task-list`.
 * sort_order uppdateras optimistiskt och persisteras via updateTaskOrders.
 */
export function initTaskListDnD({
  listSelector = '#task-list',
  itemSelector = '[data-task-id]',
  getTasks,
  setTasks,
  useSupabase,
}) {
  const list = document.querySelector(listSelector);
  if (!list) return;

  // Gör alla items draggable
  Array.from(list.querySelectorAll(itemSelector)).forEach((el) => {
    (el as any).setAttribute('draggable', 'true');
  });

  let dragEl = null;
  let placeholder = null;

  const createPlaceholder = (height: number) => {
    const ph = document.createElement('div');
    ph.style.height = `${height}px`;
    ph.style.background = 'var(--dnd-placeholder-bg, #e5e7eb)';
    ph.style.border = '1px dashed #9ca3af';
    ph.style.margin = '4px 0';
    return ph;
  };

  list.addEventListener('dragstart', (e) => {
    const target = e.target?.closest(itemSelector);
    if (!target) return;
    dragEl = target;
    e.dataTransfer.effectAllowed = 'move';
    target.classList.add('dragging');
    placeholder = createPlaceholder(target.offsetHeight);
    target.parentElement?.insertBefore(placeholder, target.nextSibling);
  });

  list.addEventListener('dragover', (e) => {
    if (!dragEl || !placeholder) return;
    e.preventDefault();
    const afterEl = getDragAfterElement(list, e.clientY, itemSelector, dragEl);
    if (afterEl == null) {
      list.appendChild(placeholder);
    } else {
      afterEl.parentElement?.insertBefore(placeholder, afterEl);
    }
  });

  list.addEventListener('drop', async (e) => {
    if (!dragEl || !placeholder) return;
    e.preventDefault();

    const wasIndex = indexOfElement(list, dragEl, itemSelector);
    const newIndex = indexOfElement(list, placeholder, itemSelector, /*includePlaceholder*/ true);

    placeholder.replaceWith(dragEl);
    dragEl.classList.remove('dragging');

    // Optimistisk reorder i state
    const prev = JSON.parse(JSON.stringify(getTasks()));
    const reordered = arrayMove(prev, wasIndex, newIndex);

    // tilldela nya sort_order (0..n-1)
    const updates = reordered.map((t, i) => ({ id: t.id, sort_order: i }));
    reordered.forEach((t, i) => (t.sort_order = i));
    setTasks(reordered);

    try {
      await updateTaskOrders(updates, useSupabase());
    } catch (err) {
      console.error('DnD save failed, rollback', err);
      setTasks(prev);
    }

    dragEl = null;
    placeholder = null;
  });

  list.addEventListener('dragend', () => {
    if (dragEl) dragEl.classList.remove('dragging');
    if (placeholder && placeholder.parentElement) placeholder.remove();
    dragEl = null;
    placeholder = null;
  });
}

function arrayMove(arr, fromIndex, toIndex) {
  const newArr = arr.slice();
  const [item] = newArr.splice(fromIndex, 1);
  newArr.splice(toIndex, 0, item);
  return newArr;
}

function indexOfElement(container, el, itemSelector, includePlaceholder = false) {
  const items = Array.from(container.querySelectorAll(itemSelector));
  const list = includePlaceholder ? [...items, el] : items;
  return list.indexOf(el);
}

function getDragAfterElement(container, y, itemSelector, dragEl) {
  const elements = [...container.querySelectorAll(itemSelector)].filter(
    (el) => el !== dragEl && !el.classList.contains('dragging')
  );

  return elements.reduce(
    (closest, child) => {
      const box = child.getBoundingClientRect();
      const offset = y - box.top - box.height / 2;
      if (offset < 0 && offset > closest.offset) {
        return { offset, element: child };
      } else {
        return closest;
      }
    },
    { offset: Number.NEGATIVE_INFINITY, element: null }
  ).element;
}
