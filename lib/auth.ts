import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { maskEmail, getSafeErrorMessage } from "@/lib/utils/privacy";

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

    // Para validar token de usuário, precisamos de um cliente Supabase
    // Vamos usar ANON_KEY que é suficiente para validar tokens
    let supabase;
    try {
      // Tentar criar cliente - se não conseguir, pode ser problema de configuração
      supabase = createServerClient(false); // false = não requer Service Role Key obrigatória
    } catch (clientError) {
      console.error("[requireAuth] Erro ao criar cliente Supabase:", clientError);
      const errorMsg = clientError instanceof Error ? clientError.message : String(clientError);
      return NextResponse.json(
        { 
          message: "Erro de configuração do servidor",
          details: { error: errorMsg }
        },
        { status: 500 }
      );
    }
    
    if (!supabase) {
      console.error("[requireAuth] Cliente Supabase é null/undefined");
      return NextResponse.json(
        { message: "Erro ao inicializar cliente de autenticação" },
        { status: 500 }
      );
    }

    const { data, error } = await supabase.auth.getUser(token);

    if (error) {
      const safeMessage = getSafeErrorMessage(error, "Erro de autenticação");
      console.error("[requireAuth] Erro ao validar token:", {
        message: safeMessage,
        status: (error as any)?.status,
      });
      // Sempre retornar mensagem genérica para não expor detalhes
      return NextResponse.json({ message: "Sessão inválida" }, { status: 401 });
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

    console.log(`[requireAuth] Usuário autenticado: ${maskEmail(user.email)} (role: ${user.role})`);
    return { user };
  } catch (error) {
    console.error("[requireAuth] Erro inesperado na autenticação:", error);
    const message = getSafeErrorMessage(error instanceof Error ? error : new Error("Erro na autenticação"), "Erro na autenticação");
    return NextResponse.json({ message }, { status: 500 });
  }
}

export function requireAdmin(user: AuthUser): boolean {
  const isAdmin = user.role === "admin";
  if (!isAdmin) {
    console.warn(`Acesso negado: usuário ${maskEmail(user.email)} tem role "${user.role}", mas requer "admin"`);
  }
  return isAdmin;
}

export function isAdmin(user: AuthUser): boolean {
  return requireAdmin(user);
}

