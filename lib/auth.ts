import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";

export interface AuthUser {
  id: string;
  email?: string;
  role?: string;
}

export async function requireAuth(request: NextRequest): Promise<{ user: AuthUser } | NextResponse> {
  try {
    const authHeader = request.headers.get("authorization");
    if (!authHeader) {
      return NextResponse.json({ message: "Token de acesso ausente" }, { status: 401 });
    }

    const token = authHeader.replace(/^Bearer\s+/i, "").trim();
    if (!token) {
      return NextResponse.json({ message: "Token de acesso inválido" }, { status: 401 });
    }

    const supabase = createServerClient();
    const { data, error } = await supabase.auth.getUser(token);

    if (error || !data.user) {
      return NextResponse.json({ message: "Sessão inválida" }, { status: 401 });
    }

    const user: AuthUser = {
      id: data.user.id,
      email: data.user.email ?? undefined,
      role: (data.user.user_metadata as { role?: string } | undefined)?.role ?? "user",
    };

    return { user };
  } catch (error) {
    console.error("Erro na autenticação:", error);
    return NextResponse.json({ message: "Erro na autenticação" }, { status: 500 });
  }
}

export function requireAdmin(user: AuthUser): boolean {
  return user.role === "admin";
}

export function isAdmin(user: AuthUser): boolean {
  return requireAdmin(user);
}

