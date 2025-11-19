"use client";

import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { AppLayout } from "@/components/layout/AppLayout";
import { ProfilePage } from "@/components/pages/Profile/ProfilePage";

export default function PerfilPageRoute() {
  return (
    <ProtectedRoute>
      <AppLayout>
        <ProfilePage />
      </AppLayout>
    </ProtectedRoute>
  );
}





