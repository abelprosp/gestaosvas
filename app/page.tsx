"use client";

import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { AppLayout } from "@/components/layout/AppLayout";
import { DashboardPage } from "@/components/pages/DashboardPage";

// Forçar renderização dinâmica (não pré-renderizar)
export const dynamic = "force-dynamic";
export const runtime = "edge";

export default function HomePage() {
  return (
    <ProtectedRoute>
      <AppLayout>
        <DashboardPage />
      </AppLayout>
    </ProtectedRoute>
  );
}


