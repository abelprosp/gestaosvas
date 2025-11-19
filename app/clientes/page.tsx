"use client";

import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { AppLayout } from "@/components/layout/AppLayout";
import { ClientsPage } from "@/components/pages/Clients/ClientsPage";

export default function ClientesPageRoute() {
  return (
    <ProtectedRoute>
      <AppLayout>
        <ClientsPage />
      </AppLayout>
    </ProtectedRoute>
  );
}





