"use client";

import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { AppLayout } from "@/components/layout/AppLayout";
import { ServiceReportsPage } from "@/components/pages/Reports/ServiceReportsPage";

export default function RelatoriosServicosPageRoute() {
  return (
    <ProtectedRoute>
      <AppLayout>
        <ServiceReportsPage />
      </AppLayout>
    </ProtectedRoute>
  );
}





