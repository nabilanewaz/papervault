import { createClient } from '@supabase/supabase-js';

// Initialize Supabase client
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;
const supabase = createClient(supabaseUrl, supabaseKey);

export { supabase };

// ============================================================
// Supabase availability tracking
// ============================================================

// Track whether Supabase is reachable
let _supabaseAvailable: boolean | null = null; // null = unknown
let _lastCheckTime = 0;
const CHECK_INTERVAL_MS = 60_000; // Re-check every 60 seconds after a failure

/**
 * Returns true if Supabase is known to be available,
 * false if known to be unavailable,
 * or performs a quick health check if status is unknown / stale.
 */
export async function isSupabaseAvailable(): Promise<boolean> {
  // If we already know it's available, return true
  if (_supabaseAvailable === true) return true;

  // If we recently checked and it was unavailable, don't re-check yet
  if (_supabaseAvailable === false && Date.now() - _lastCheckTime < CHECK_INTERVAL_MS) {
    return false;
  }

  // Perform a quick health check with a short timeout
  try {
    const result = await withTimeout(
      supabase.from('papers').select('id', { count: 'exact', head: true }),
      3000 // 3 second timeout
    );

    if (result.error) {
      // Supabase responded but with an error (table might not exist, etc.)
      // This still means the server is reachable
      _supabaseAvailable = true;
      return true;
    }

    _supabaseAvailable = true;
    return true;
  } catch (error) {
    console.warn('Supabase health check failed, switching to offline mode:', error);
    _supabaseAvailable = false;
    _lastCheckTime = Date.now();
    return false;
  }
}

/**
 * Immediately mark Supabase as unavailable (called on fetch failures).
 */
export function markSupabaseUnavailable(): void {
  _supabaseAvailable = false;
  _lastCheckTime = Date.now();
}

/**
 * Check if Supabase is currently known to be unavailable (synchronous).
 * Returns true if we should skip Supabase calls.
 */
export function isSupabaseOffline(): boolean {
  if (_supabaseAvailable === false && Date.now() - _lastCheckTime < CHECK_INTERVAL_MS) {
    return true;
  }
  return false;
}

/**
 * Wrap a promise with a timeout. Rejects if the promise doesn't resolve
 * within the given milliseconds.
 */
export function withTimeout<T>(promise: PromiseLike<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`Operation timed out after ${ms}ms`));
    }, ms);

    Promise.resolve(promise).then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      }
    );
  });
}
