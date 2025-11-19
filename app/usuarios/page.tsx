"use client";

import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { AppLayout } from "@/components/layout/AppLayout";
import { UsersPage } from "@/components/pages/Users/UsersPage";

export default function UsuariosPageRoute() {
  return (
    <ProtectedRoute>
      <AppLayout>
        <UsersPage />
      </AppLayout>
    </ProtectedRoute>
  );
}





