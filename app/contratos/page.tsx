"use client";

import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { AppLayout } from "@/components/layout/AppLayout";
import { ContractsPage } from "@/components/pages/Contracts/ContractsPage";

export default function ContratosPageRoute() {
  return (
    <ProtectedRoute>
      <AppLayout>
        <ContractsPage />
      </AppLayout>
    </ProtectedRoute>
  );
}





