import { NextRequest, NextResponse } from "next/server";
import { requireAuth, requireAdmin, type AuthUser } from "@/lib/auth";
import { handleApiError } from "./errorHandler";
import { sanitizeUrl, maskEmail } from "./privacy";
import { rateLimit, RATE_LIMITS, type RateLimitOptions } from "./rateLimit";

type Handler = (
  req: NextRequest,
  context: { user: AuthUser; params?: Record<string, string> }
) => Promise<NextResponse>;

interface ApiHandlerOptions {
  requireAuth?: boolean;
  requireAdmin?: boolean;
  rateLimit?: RateLimitOptions;
}

export function createApiHandler(
  handler: Handler,
  options: ApiHandlerOptions = { requireAuth: true }
) {
  console.log(`[createApiHandler] Criando handler com options:`, JSON.stringify(options));
  
  return async (
    req: NextRequest,
    context?: { params?: Promise<Record<string, string>> | Record<string, string> }
  ) => {
    console.log(`[createApiHandler] Handler chamado para: ${req.url}`);
    console.log(`[createApiHandler] Options recebidas:`, JSON.stringify(options));
    try {
      // Aplicar rate limiting se configurado
      if (options.rateLimit) {
        const rateLimitResult = rateLimit(options.rateLimit)(req);
        if (rateLimitResult) {
          return rateLimitResult; // Retorna 429 se excedido
        }
      }

      // Aplicar rate limiting padrão para rotas admin
      if (options.requireAdmin && !options.rateLimit) {
        const rateLimitResult = rateLimit(RATE_LIMITS.ADMIN)(req);
        if (rateLimitResult) {
          return rateLimitResult;
        }
      }

      let user: AuthUser | undefined;

      // Se requireAdmin é true, requireAuth também deve ser true (não pode verificar admin sem autenticar)
      const shouldRequireAuth = options.requireAuth !== false && (options.requireAuth === true || options.requireAdmin === true);

      console.log(`[createApiHandler] Iniciando - requireAuth: ${options.requireAuth}, requireAdmin: ${options.requireAdmin}, shouldRequireAuth: ${shouldRequireAuth}`);

      if (shouldRequireAuth) {
        try {
          const sanitizedUrl = sanitizeUrl(req.url);
          console.log(`[createApiHandler] 🔐 Verificando autenticação para ${sanitizedUrl}`);
          console.log(`[createApiHandler] Headers Authorization presente:`, req.headers.get("authorization") ? "SIM" : "NÃO");
          const authResult = await requireAuth(req);
          if (authResult instanceof NextResponse) {
            console.log(`[createApiHandler] ❌ Falha na autenticação para ${sanitizedUrl}`);
            console.log(`[createApiHandler] Resposta de erro:`, authResult.status, await authResult.clone().json().catch(() => "Não foi possível ler resposta"));
            return authResult; // Erro de autenticação
          }
          user = authResult.user;
          console.log(`[createApiHandler] Usuário autenticado: ${maskEmail(user.email)} (role: ${user.role})`);
          console.log(`[createApiHandler] User definido após autenticação:`, user ? "SIM" : "NÃO");

          if (options.requireAdmin && !requireAdmin(user)) {
            console.log(`[createApiHandler] Acesso negado - usuário ${maskEmail(user.email)} não é admin (role: ${user.role})`);
            return NextResponse.json(
              { message: "Permissão negada. Apenas administradores podem acessar esta rota." },
              { status: 403 }
            );
          }
          
          // Log adicional para debug
          if (options.requireAdmin) {
            console.log(`[createApiHandler] ✅ Verificação de admin OK - usuário ${maskEmail(user.email)} é admin (role: ${user.role})`);
          }
        } catch (authError) {
          const sanitizedUrl = sanitizeUrl(req.url);
          console.error(`[createApiHandler] Erro na autenticação para ${sanitizedUrl}:`, authError);
          return handleApiError(authError);
        }
      } else {
        console.log(`[createApiHandler] ⚠️ requireAuth é false, pulando autenticação`);
      }

      const params = context?.params
        ? typeof context.params === "object" && "then" in context.params
          ? await context.params
          : context.params
        : undefined;

      try {
        // Validar tamanho do payload antes de processar
        const contentLength = req.headers.get("content-length");
        const MAX_PAYLOAD_SIZE = 2 * 1024 * 1024; // 2MB (mesmo limite do Next.js)
        if (contentLength && parseInt(contentLength) > MAX_PAYLOAD_SIZE) {
          return NextResponse.json(
            { message: "Payload muito grande. Tamanho máximo: 2MB" },
            { status: 413 }
          );
        }

        const sanitizedUrl = sanitizeUrl(req.url);
        console.log(`[createApiHandler] Executando handler para ${sanitizedUrl}`);
        console.log(`[createApiHandler] User antes de executar handler:`, user ? `${maskEmail(user.email)} (role: ${user.role})` : "UNDEFINED");
        console.log(`[createApiHandler] requireAuth: ${options.requireAuth}, requireAdmin: ${options.requireAdmin}`);
        
        // Se requireAuth ou requireAdmin, garantir que user está definido
        if (shouldRequireAuth && !user) {
          console.error(`[createApiHandler] ERRO: user é undefined mas requireAuth/requireAdmin está ativo`);
          console.error(`[createApiHandler] Stack trace:`, new Error().stack);
          return NextResponse.json(
            { message: "Erro de autenticação. Por favor, faça login novamente." },
            { status: 401 }
          );
        }
        
        const result = await handler(req, { user: user!, params });
        console.log(`[createApiHandler] Handler executado com sucesso para ${sanitizedUrl}`);
        return result;
      } catch (handlerError) {
        const sanitizedUrl = sanitizeUrl(req.url);
        console.error(`[createApiHandler] Erro no handler para ${sanitizedUrl}:`, handlerError);
        return handleApiError(handlerError);
      }
    } catch (error) {
      const sanitizedUrl = sanitizeUrl(req.url);
      console.error(`[createApiHandler] Erro não esperado para ${sanitizedUrl}:`, error);
      return handleApiError(error);
    }
  };
}

