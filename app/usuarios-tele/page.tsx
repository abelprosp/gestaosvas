"use client";

import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { AppLayout } from "@/components/layout/AppLayout";
import { TeleUsersPage } from "@/components/pages/CloudUsers/TeleUsersPage";

export default function UsuariosTelePageRoute() {
  return (
    <ProtectedRoute>
      <AppLayout>
        <TeleUsersPage />
      </AppLayout>
    </ProtectedRoute>
  );
}





