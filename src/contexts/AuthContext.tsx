import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { authService, AppUser } from '@/services/authService';

interface AuthContextType {
  user: AppUser | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, name?: string) => Promise<void>;
  signOut: () => Promise<void>;
  signInWithGoogle: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  signIn: async () => {},
  signUp: async () => {},
  signOut: async () => {},
  signInWithGoogle: async () => {},
});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    authService.getCurrentUser().then((u) => {
      if (mounted) {
        setUser(u);
        setLoading(false);
      }
    });

    const unsubscribe = authService.onAuthStateChange((u) => {
      if (mounted) setUser(u);
    });

    return () => {
      mounted = false;
      unsubscribe();
    };
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    const u = await authService.signIn(email, password);
    setUser(u);
  }, []);

  const signUp = useCallback(async (email: string, password: string, name?: string) => {
    const u = await authService.signUp(email, password, name);
    setUser(u);
  }, []);

  const signOut = useCallback(async () => {
    await authService.signOut();
    setUser(null);
  }, []);

  const signInWithGoogle = useCallback(async () => {
    await authService.signInWithGoogle();
    // Browser navigates away; onAuthStateChange handles the return.
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, signIn, signUp, signOut, signInWithGoogle }}>
      {children}
    </AuthContext.Provider>
  );
};
