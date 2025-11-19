import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { Session, User } from "@supabase/supabase-js";
import supabase from "../lib/supabaseClient";
import { api } from "../api/client";

interface AuthContextValue {
  user: User | null;
  session: Session | null;
  loading: boolean;
  role: string;
  isAdmin: boolean;
  signIn: (params: { email: string; password: string }) => Promise<{ error?: string }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setUser(data.session?.user ?? null);
      setLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, currentSession) => {
      setSession(currentSession);
      setUser(currentSession?.user ?? null);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (session?.access_token) {
      api.defaults.headers.common.Authorization = `Bearer ${session.access_token}`;
    } else {
      delete api.defaults.headers.common.Authorization;
    }
  }, [session]);

  const signIn = useCallback(async ({ email, password }: { email: string; password: string }) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      return { error: error.message };
    }
    return {};
  }, []);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
  }, []);

  const role = useMemo(() => {
    if (!user) return "guest";
    return (user.user_metadata as { role?: string } | undefined)?.role ?? "user";
  }, [user]);

  const value = useMemo(
    () => ({
      user,
      session,
      loading,
      role,
      isAdmin: role === "admin",
      signIn,
      signOut,
    }),
    [loading, role, session, signIn, signOut, user],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth deve ser usado dentro de AuthProvider");
  }
  return context;
}


