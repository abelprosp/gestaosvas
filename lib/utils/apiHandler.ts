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
  return async (
    req: NextRequest,
    context?: { params?: Promise<Record<string, string>> | Record<string, string> }
  ) => {
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

      if (options.requireAuth) {
        try {
          const sanitizedUrl = sanitizeUrl(req.url);
          console.log(`[createApiHandler] Verificando autenticação para ${sanitizedUrl}`);
          const authResult = await requireAuth(req);
          if (authResult instanceof NextResponse) {
            console.log(`[createApiHandler] Falha na autenticação para ${sanitizedUrl}`);
            return authResult; // Erro de autenticação
          }
          user = authResult.user;
          console.log(`[createApiHandler] Usuário autenticado: ${maskEmail(user.email)} (role: ${user.role})`);

          if (options.requireAdmin && !requireAdmin(user)) {
            console.log(`[createApiHandler] Acesso negado - usuário ${maskEmail(user.email)} não é admin`);
            return NextResponse.json(
              { message: "Permissão negada. Apenas administradores podem acessar esta rota." },
              { status: 403 }
            );
          }
        } catch (authError) {
          const sanitizedUrl = sanitizeUrl(req.url);
          console.error(`[createApiHandler] Erro na autenticação para ${sanitizedUrl}:`, authError);
          return handleApiError(authError);
        }
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

