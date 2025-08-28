// src/lib/auth.ts
// Thin wrappers around Supabase Auth (SDK v2)

import { supabaseClient } from './supabaseClient.js';
import type { Session } from '@supabase/supabase-js';

/**
 * Get the current auth session, or null if not signed in.
 */
export async function getSession(): Promise<Session | null> {
  const { data, error } = await supabaseClient.auth.getSession();
  if (error) throw error;
  return data.session;
}

/**
 * Send a magic-link to sign in with email. Returns true if request accepted.
 * Uses current origin as redirect target by default.
 */
export async function signIn(email: string): Promise<boolean> {
  const { error } = await supabaseClient.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: (typeof window !== 'undefined' && window.location?.origin) || undefined,
      shouldCreateUser: true,
    },
  });
  if (error) throw error;
  return true;
}

/**
 * Sign out the current user.
 */
export async function signOut(): Promise<void> {
  const { error } = await supabaseClient.auth.signOut();
  if (error) throw error;
}
