"use client";

import { ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Spinner, Center } from "@chakra-ui/react";
import { useAuth } from "@/context/AuthContext";
import { useEffect } from "react";

interface ProtectedRouteProps {
  children: ReactNode;
}

export function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) {
      router.push("/login");
    }
  }, [user, loading, router]);

  if (loading) {
    return (
      <Center h="100vh">
        <Spinner size="lg" />
      </Center>
    );
  }

  if (!user) {
    return null;
  }

  return <>{children}</>;
}





