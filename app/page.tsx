"use client";

import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { AppLayout } from "@/components/layout/AppLayout";
import { DashboardPage } from "@/components/pages/DashboardPage";

export default function HomePage() {
  return (
    <ProtectedRoute>
      <AppLayout>
        <DashboardPage />
      </AppLayout>
    </ProtectedRoute>
  );
}


