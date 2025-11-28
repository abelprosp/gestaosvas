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
      console.warn("[requireAuth] Headers disponíveis:", Object.keys(request.headers));
      return NextResponse.json({ message: "Token de acesso ausente" }, { status: 401 });
    }

    const token = authHeader.replace(/^Bearer\s+/i, "").trim();
    if (!token) {
      console.warn("[requireAuth] Token de acesso vazio após processar header");
      console.warn("[requireAuth] Header original:", authHeader.substring(0, 30) + "...");
      return NextResponse.json({ message: "Token de acesso inválido" }, { status: 401 });
    }
    
    console.log(`[requireAuth] Token recebido (primeiros 20 chars): ${token.substring(0, 20)}... (tamanho: ${token.length})`);

    // Para validar token de usuário, precisamos usar ANON_KEY
    // NÃO usar Service Role Key aqui, pois ela não valida tokens de usuário corretamente
    let supabase;
    try {
      // Criar cliente com ANON_KEY (false = não usar Service Role Key)
      supabase = createServerClient(false);
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

    console.log(`[requireAuth] Tentando validar token com Supabase...`);
    console.log(`[requireAuth] URL Supabase: ${process.env.NEXT_PUBLIC_SUPABASE_URL?.substring(0, 30)}...`);
    console.log(`[requireAuth] Usando ANON_KEY: ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ? "SIM" : "NÃO"}`);
    console.log(`[requireAuth] Service Role Key presente: ${process.env.SUPABASE_SERVICE_ROLE_KEY ? "SIM" : "NÃO"}`);
    
    const { data, error } = await supabase.auth.getUser(token);

    if (error) {
      const safeMessage = getSafeErrorMessage(error, "Erro de autenticação");
      console.error("[requireAuth] ❌ ERRO ao validar token:", {
        message: safeMessage,
        status: (error as any)?.status,
        errorCode: (error as any)?.code,
        errorName: error.name,
        tokenLength: token.length,
        tokenPrefix: token.substring(0, 20) + "...",
        fullError: error,
        errorDetails: JSON.stringify(error, Object.getOwnPropertyNames(error)),
      });
      // Sempre retornar mensagem genérica para não expor detalhes
      return NextResponse.json({ message: "Sessão inválida" }, { status: 401 });
    }

    if (!data?.user) {
      console.warn("[requireAuth] ⚠️ Token válido mas sem dados de usuário");
      console.warn("[requireAuth] Data recebida:", { hasData: !!data, hasUser: !!data?.user });
      return NextResponse.json({ message: "Sessão inválida" }, { status: 401 });
    }

    const user: AuthUser = {
      id: data.user.id,
      email: data.user.email ?? undefined,
      role: (data.user.user_metadata as { role?: string } | undefined)?.role ?? "user",
    };

    console.log(`[requireAuth] ✅ Usuário autenticado: ${maskEmail(user.email)} (role: ${user.role})`);
    console.log(`[requireAuth] User metadata completo:`, JSON.stringify(data.user.user_metadata || {}));
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

