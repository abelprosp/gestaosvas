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
      console.warn("[requireAuth] Requisição sem header Authorization");
      return NextResponse.json({ message: "Token de acesso ausente" }, { status: 401 });
    }

    const token = authHeader.replace(/^Bearer\s+/i, "").trim();
    if (!token) {
      console.warn("[requireAuth] Token de acesso vazio após processar header");
      return NextResponse.json({ message: "Token de acesso inválido" }, { status: 401 });
    }

    // Para validar token de usuário, não precisamos da Service Role Key
    // Podemos usar a ANON_KEY ou SERVICE_ROLE_KEY, ambos funcionam
    let supabase;
    try {
      supabase = createServerClient(false); // false = não requer Service Role Key obrigatória
    } catch (error) {
      console.error("[requireAuth] Erro ao criar cliente Supabase:", error);
      return NextResponse.json(
        { message: "Erro de configuração do servidor" },
        { status: 500 }
      );
    }

    const { data, error } = await supabase.auth.getUser(token);

    if (error) {
      console.error("[requireAuth] Erro ao validar token:", {
        message: error.message,
        status: (error as any)?.status,
      });
      return NextResponse.json({ message: `Sessão inválida: ${error.message}` }, { status: 401 });
    }

    if (!data?.user) {
      console.warn("[requireAuth] Token válido mas sem dados de usuário");
      return NextResponse.json({ message: "Sessão inválida" }, { status: 401 });
    }

    const user: AuthUser = {
      id: data.user.id,
      email: data.user.email ?? undefined,
      role: (data.user.user_metadata as { role?: string } | undefined)?.role ?? "user",
    };

    console.log(`[requireAuth] Usuário autenticado: ${user.email} (role: ${user.role})`);
    return { user };
  } catch (error) {
    console.error("[requireAuth] Erro inesperado na autenticação:", error);
    const message = error instanceof Error ? error.message : "Erro na autenticação";
    return NextResponse.json({ message }, { status: 500 });
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

