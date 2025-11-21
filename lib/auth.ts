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
      console.warn("Requisição sem header Authorization");
      return NextResponse.json({ message: "Token de acesso ausente" }, { status: 401 });
    }

    const token = authHeader.replace(/^Bearer\s+/i, "").trim();
    if (!token) {
      console.warn("Token de acesso vazio após processar header");
      return NextResponse.json({ message: "Token de acesso inválido" }, { status: 401 });
    }

    const supabase = createServerClient();
    const { data, error } = await supabase.auth.getUser(token);

    if (error) {
      console.error("Erro ao validar token:", error);
      return NextResponse.json({ message: `Sessão inválida: ${error.message}` }, { status: 401 });
    }

    if (!data.user) {
      console.warn("Token válido mas sem dados de usuário");
      return NextResponse.json({ message: "Sessão inválida" }, { status: 401 });
    }

    const user: AuthUser = {
      id: data.user.id,
      email: data.user.email ?? undefined,
      role: (data.user.user_metadata as { role?: string } | undefined)?.role ?? "user",
    };

    console.log(`Usuário autenticado: ${user.email} (role: ${user.role})`);
    return { user };
  } catch (error) {
    console.error("Erro na autenticação:", error);
    return NextResponse.json({ message: "Erro na autenticação" }, { status: 500 });
  }
}

export function requireAdmin(user: AuthUser): boolean {
  const isAdmin = user.role === "admin";
  if (!isAdmin) {
    console.warn(`Acesso negado: usuário ${user.email} tem role "${user.role}", mas requer "admin"`);
  }
  return isAdmin;
}

export function isAdmin(user: AuthUser): boolean {
  return requireAdmin(user);
}

