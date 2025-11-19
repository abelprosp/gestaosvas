"use client";

import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { AppLayout } from "@/components/layout/AppLayout";
import { AdminUsersPage } from "@/components/pages/Admin/AdminUsersPage";

export default function AdminUsuariosPageRoute() {
  return (
    <ProtectedRoute>
      <AppLayout>
        <AdminUsersPage />
      </AppLayout>
    </ProtectedRoute>
  );
}





