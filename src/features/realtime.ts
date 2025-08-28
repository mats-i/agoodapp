import { supabaseClient } from '../lib/supabaseClient.js';

/**
 * Prenumerera på realtime-förändringar för public.tasks.
 * Använder Supabase Realtime (postgres_changes) och returnerar unsubscribe.
 * @param {(payload: any) => void} onChange - Callback vid INSERT/UPDATE/DELETE.
 * @returns {() => void} Unsubscribe-funktion.
 */
export function subscribeTasks(onChange: (payload: any) => void): () => void {
  const channel = supabaseClient
    .channel('realtime:tasks')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks' }, (payload) =>
      onChange(payload)
    )
    .subscribe();

  return () => {
    try {
      supabaseClient.removeChannel(channel);
    } catch (_) {
      // noop
    }
  };
}
