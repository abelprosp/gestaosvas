"use client";

import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { AppLayout } from "@/components/layout/AppLayout";
import { ServicesPage } from "@/components/pages/Services/ServicesPage";

export default function ServicosPageRoute() {
  return (
    <ProtectedRoute>
      <AppLayout>
        <ServicesPage />
      </AppLayout>
    </ProtectedRoute>
  );
}





