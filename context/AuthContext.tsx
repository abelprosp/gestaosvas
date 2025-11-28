"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase/client";
import axios from "axios";

const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || "/api",
});

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
    // O interceptor em lib/api/client.ts já gerencia o token automaticamente
    // Este useEffect é mantido apenas para compatibilidade, mas o interceptor tem prioridade
    if (session?.access_token) {
      api.defaults.headers.common.Authorization = `Bearer ${session.access_token}`;
    } else {
      delete api.defaults.headers.common.Authorization;
    }
  }, [session]);

  const signIn = useCallback(async ({ email, password }: { email: string; password: string }) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      return { error: error.message };
    }
    // Atualizar estado imediatamente após login bem-sucedido
    if (data.session) {
      setSession(data.session);
      setUser(data.session.user);
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

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth deve ser usado dentro de AuthProvider");
  }
  return context;
}


