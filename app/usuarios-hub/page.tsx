"use client";

import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { AppLayout } from "@/components/layout/AppLayout";
import { HubUsersPage } from "@/components/pages/CloudUsers/HubUsersPage";

export default function UsuariosHubPageRoute() {
  return (
    <ProtectedRoute>
      <AppLayout>
        <HubUsersPage />
      </AppLayout>
    </ProtectedRoute>
  );
}





