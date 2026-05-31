import { supabase, isSupabaseOffline, markSupabaseUnavailable, withTimeout } from '@/lib/supabase';

const AUTH_TIMEOUT = 6000;
const LOCAL_USER_KEY = 'research_auth_user';
const LOCAL_USERS_KEY = 'research_local_users';

export interface AppUser {
  id: string;
  email: string;
  name?: string;
  isLocal?: boolean;
}

interface LocalUserRecord {
  id: string;
  email: string;
  name?: string;
  // very lightweight obfuscation — NOT real security, only for offline demo mode
  passwordHash: string;
}

// ---- helpers for offline/local auth ----
async function sha256Hash(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hashBuffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

function getLocalUsers(): LocalUserRecord[] {
  try {
    const raw = localStorage.getItem(LOCAL_USERS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveLocalUsers(users: LocalUserRecord[]) {
  localStorage.setItem(LOCAL_USERS_KEY, JSON.stringify(users));
}

function setCurrentLocalUser(user: AppUser | null) {
  if (user) {
    localStorage.setItem(LOCAL_USER_KEY, JSON.stringify(user));
  } else {
    localStorage.removeItem(LOCAL_USER_KEY);
  }
}

function getCurrentLocalUser(): AppUser | null {
  try {
    const raw = localStorage.getItem(LOCAL_USER_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

// Synchronously-accessible cache of the current user's id, used to associate
// papers with the logged-in account without an async round-trip.
let _cachedUserId: string | null = null;
function setCachedUserId(id: string | null) {
  _cachedUserId = id;
}
export function getCachedUserId(): string | null {
  if (_cachedUserId) return _cachedUserId;
  const local = getCurrentLocalUser();
  return local?.id ?? null;
}

// ---- local auth implementations ----
async function localSignUp(email: string, password: string, name?: string): Promise<AppUser> {
  const users = getLocalUsers();
  const normalized = email.trim().toLowerCase();
  if (users.find(u => u.email === normalized)) {
    throw new Error('An account with this email already exists.');
  }
  const record: LocalUserRecord = {
    id: crypto.randomUUID(),
    email: normalized,
    name,
    passwordHash: await sha256Hash(password),
  };
  users.push(record);
  saveLocalUsers(users);
  const user: AppUser = { id: record.id, email: record.email, name: record.name, isLocal: true };
  setCurrentLocalUser(user);
  return user;
}

async function localSignIn(email: string, password: string): Promise<AppUser> {
  const users = getLocalUsers();
  const normalized = email.trim().toLowerCase();
  const record = users.find(u => u.email === normalized);
  if (!record || record.passwordHash !== await sha256Hash(password)) {
    throw new Error('Invalid email or password.');
  }
  const user: AppUser = { id: record.id, email: record.email, name: record.name, isLocal: true };
  setCurrentLocalUser(user);
  return user;
}

export const authService = {
  async getCurrentUser(): Promise<AppUser | null> {
    // If offline, only use local user
    if (isSupabaseOffline()) {
      const u = getCurrentLocalUser();
      setCachedUserId(u?.id ?? null);
      return u;
    }

    try {
      const { data, error } = await withTimeout(supabase.auth.getSession(), AUTH_TIMEOUT);
      if (error) throw error;
      const session = data?.session;
      if (session?.user) {
        const u: AppUser = {
          id: session.user.id,
          email: session.user.email || '',
          name: (session.user.user_metadata as any)?.name,
        };
        setCachedUserId(u.id);
        return u;
      }
      // No supabase session — fall back to a possible local session
      const local = getCurrentLocalUser();
      setCachedUserId(local?.id ?? null);
      return local;
    } catch (error) {
      console.warn('Auth getSession failed, using local auth:', error);
      markSupabaseUnavailable();
      const local = getCurrentLocalUser();
      setCachedUserId(local?.id ?? null);
      return local;
    }
  },

  async signUp(email: string, password: string, name?: string): Promise<AppUser> {
    if (isSupabaseOffline()) {
      return await localSignUp(email, password, name);
    }

    try {
      const { data, error } = await withTimeout(
        supabase.auth.signUp({
          email: email.trim(),
          password,
          options: { data: { name } },
        }),
        AUTH_TIMEOUT
      );
      if (error) throw error;

      const user = data.user;
      if (user) {
        setCachedUserId(user.id);
        return { id: user.id, email: user.email || '', name };
      }
      // Some configs require email confirmation; fall back to local so the user can proceed
      return await localSignUp(email, password, name);
    } catch (error: any) {
      // If it's a network/timeout failure, fall back to local. Otherwise surface the error.
      const msg = String(error?.message || '');
      if (msg.includes('timed out') || msg.includes('Failed to fetch') || msg.includes('NetworkError')) {
        markSupabaseUnavailable();
        return await localSignUp(email, password, name);
      }
      throw new Error(error?.message || 'Sign up failed.');
    }
  },

  async signIn(email: string, password: string): Promise<AppUser> {
    if (isSupabaseOffline()) {
      return await localSignIn(email, password);
    }

    try {
      const { data, error } = await withTimeout(
        supabase.auth.signInWithPassword({ email: email.trim(), password }),
        AUTH_TIMEOUT
      );
      if (error) throw error;

      const user = data.user;
      if (user) {
        setCachedUserId(user.id);
        return {
          id: user.id,
          email: user.email || '',
          name: (user.user_metadata as any)?.name,
        };
      }
      throw new Error('Sign in failed.');
    } catch (error: any) {
      const msg = String(error?.message || '');
      if (msg.includes('timed out') || msg.includes('Failed to fetch') || msg.includes('NetworkError')) {
        markSupabaseUnavailable();
        return await localSignIn(email, password);
      }
      throw new Error(error?.message || 'Invalid email or password.');
    }
  },

  async signInWithGoogle(): Promise<void> {
    if (isSupabaseOffline()) {
      throw new Error('Google sign-in requires an internet connection.');
    }
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin },
    });
    if (error) throw new Error(error.message);
    // Browser navigates away — no return value needed.
  },

  async signOut(): Promise<void> {
    setCurrentLocalUser(null);
    setCachedUserId(null);
    if (!isSupabaseOffline()) {
      try {
        await withTimeout(supabase.auth.signOut(), AUTH_TIMEOUT);
      } catch (error) {
        markSupabaseUnavailable();
      }
    }
  },

  onAuthStateChange(callback: (user: AppUser | null) => void) {
    try {
      const { data } = supabase.auth.onAuthStateChange((_event, session) => {
        if (session?.user) {
          setCachedUserId(session.user.id);
          callback({
            id: session.user.id,
            email: session.user.email || '',
            name: (session.user.user_metadata as any)?.name,
          });
        } else {
          // Preserve local session if present
          const local = getCurrentLocalUser();
          setCachedUserId(local?.id ?? null);
          callback(local);
        }
      });
      return () => data.subscription.unsubscribe();
    } catch {
      return () => {};
    }
  },
};
