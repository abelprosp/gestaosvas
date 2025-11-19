"use client";

import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { AppLayout } from "@/components/layout/AppLayout";
import { CloudUsersPage } from "@/components/pages/CloudUsers/CloudUsersPage";

export default function UsuariosCloudPageRoute() {
  return (
    <ProtectedRoute>
      <AppLayout>
        <CloudUsersPage title="Usuários Cloud" serviceFilter="Cloud 150GB" />
      </AppLayout>
    </ProtectedRoute>
  );
}





