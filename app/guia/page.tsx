"use client";

import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { AppLayout } from "@/components/layout/AppLayout";
import { GuidePage } from "@/components/pages/Guide/GuidePage";

export default function GuiaPageRoute() {
  return (
    <ProtectedRoute>
      <AppLayout>
        <GuidePage />
      </AppLayout>
    </ProtectedRoute>
  );
}





