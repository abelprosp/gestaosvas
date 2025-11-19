"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { AppLayout } from "@/components/layout/AppLayout";
import { DashboardPage } from "@/components/pages/DashboardPage";

// Forçar renderização dinâmica (não pré-renderizar)
export const dynamic = "force-dynamic";

export default function HomePage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [mounted, setMounted] = useState(false);

  // Garantir que só renderiza no client
  useEffect(() => {
    setMounted(true);
  }, []);

  // Se ainda não montou no client, não renderizar nada
  if (!mounted) {
    return (
      <div style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        height: '100vh',
        fontFamily: 'system-ui'
      }}>
        <div>Carregando...</div>
      </div>
    );
  }

  // Redirecionar para login se não autenticado (client-side)
  useEffect(() => {
    if (!loading && !user) {
      router.push("/login");
    }
  }, [user, loading, router]);

  // Se estiver carregando, mostrar loading
  if (loading) {
    return (
      <div style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        height: '100vh',
        fontFamily: 'system-ui'
      }}>
        <div>Carregando...</div>
      </div>
    );
  }

  // Se não estiver autenticado, mostrar null (vai redirecionar)
  if (!user) {
    return (
      <div style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        height: '100vh',
        fontFamily: 'system-ui'
      }}>
        <div>Redirecionando para login...</div>
      </div>
    );
  }

  // Se autenticado, mostrar o dashboard
  return (
    <ProtectedRoute>
      <AppLayout>
        <DashboardPage />
      </AppLayout>
    </ProtectedRoute>
  );
}


