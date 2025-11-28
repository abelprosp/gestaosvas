import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";

export async function GET(req: NextRequest) {
  try {
    const authHeader = req.headers.get("authorization");
    
    console.log("[TEST-AUTH] ========================================");
    console.log("[TEST-AUTH] Teste de autenticação");
    console.log("[TEST-AUTH] ========================================");
    console.log("[TEST-AUTH] Header Authorization presente:", authHeader ? "SIM" : "NÃO");
    
    if (!authHeader) {
      return NextResponse.json({ 
        error: "Token ausente",
        headers: Object.fromEntries(req.headers.entries())
      }, { status: 401 });
    }

    const token = authHeader.replace(/^Bearer\s+/i, "").trim();
    console.log("[TEST-AUTH] Token extraído (primeiros 30 chars):", token.substring(0, 30) + "...");
    console.log("[TEST-AUTH] Tamanho do token:", token.length);
    
    // Verificar variáveis de ambiente
    console.log("[TEST-AUTH] NEXT_PUBLIC_SUPABASE_URL:", process.env.NEXT_PUBLIC_SUPABASE_URL ? "✅ Configurado" : "❌ Não configurado");
    console.log("[TEST-AUTH] NEXT_PUBLIC_SUPABASE_ANON_KEY:", process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ? "✅ Configurado" : "❌ Não configurado");
    console.log("[TEST-AUTH] SUPABASE_SERVICE_ROLE_KEY:", process.env.SUPABASE_SERVICE_ROLE_KEY ? "✅ Configurado" : "❌ Não configurado");
    
    // Criar cliente
    console.log("[TEST-AUTH] Criando cliente Supabase com ANON_KEY...");
    const supabase = createServerClient(false);
    
    console.log("[TEST-AUTH] Cliente criado, tentando validar token...");
    const { data, error } = await supabase.auth.getUser(token);
    
    if (error) {
      console.error("[TEST-AUTH] ❌ ERRO ao validar token:");
      console.error("[TEST-AUTH] Mensagem:", error.message);
      console.error("[TEST-AUTH] Status:", (error as any)?.status);
      console.error("[TEST-AUTH] Code:", (error as any)?.code);
      console.error("[TEST-AUTH] Name:", error.name);
      console.error("[TEST-AUTH] Error completo:", JSON.stringify(error, Object.getOwnPropertyNames(error)));
      
      return NextResponse.json({
        error: "Erro ao validar token",
        details: {
          message: error.message,
          status: (error as any)?.status,
          code: (error as any)?.code,
          name: error.name,
        }
      }, { status: 401 });
    }
    
    if (!data?.user) {
      console.warn("[TEST-AUTH] ⚠️ Token válido mas sem dados de usuário");
      return NextResponse.json({
        error: "Token válido mas sem dados de usuário",
        data: data
      }, { status: 401 });
    }
    
    console.log("[TEST-AUTH] ✅ Token válido!");
    console.log("[TEST-AUTH] User ID:", data.user.id);
    console.log("[TEST-AUTH] Email:", data.user.email);
    console.log("[TEST-AUTH] Role:", (data.user.user_metadata as any)?.role || "não definido");
    console.log("[TEST-AUTH] Metadata:", JSON.stringify(data.user.user_metadata, null, 2));
    
    return NextResponse.json({
      success: true,
      user: {
        id: data.user.id,
        email: data.user.email,
        role: (data.user.user_metadata as any)?.role || "user",
      }
    });
  } catch (error) {
    console.error("[TEST-AUTH] Erro inesperado:", error);
    return NextResponse.json({
      error: "Erro inesperado",
      message: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}

