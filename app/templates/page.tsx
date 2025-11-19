"use client";

import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { AppLayout } from "@/components/layout/AppLayout";
import { TemplatesPage } from "@/components/pages/Templates/TemplatesPage";

export default function TemplatesPageRoute() {
  return (
    <ProtectedRoute>
      <AppLayout>
        <TemplatesPage />
      </AppLayout>
    </ProtectedRoute>
  );
}





