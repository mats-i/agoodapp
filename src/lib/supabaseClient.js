// src/lib/supabaseClient.js
// Exports a configured Supabase client instance

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://tazwiywfzpmyqbmmkhpc.supabase.co';
const SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRhendpeXdmenBteXFibW1raHBjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTYxOTg2NzMsImV4cCI6MjA3MTc3NDY3M30.GwC80boqAj4Z78qt3BIG-iau1QJuZiFe058vWtFBCxg';

export const supabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
  global: {
    headers: { 'x-client-info': 'agoodapp/1.0' },
  },
});
