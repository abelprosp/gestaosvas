import { NextRequest, NextResponse } from "next/server";
import { requireAuth, requireAdmin, type AuthUser } from "@/lib/auth";
import { handleApiError } from "./errorHandler";

type Handler = (
  req: NextRequest,
  context: { user: AuthUser; params?: Record<string, string> }
) => Promise<NextResponse>;

interface ApiHandlerOptions {
  requireAuth?: boolean;
  requireAdmin?: boolean;
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
      let user: AuthUser | undefined;

      if (options.requireAuth) {
        try {
          console.log(`[createApiHandler] Verificando autenticação para ${req.url}`);
          const authResult = await requireAuth(req);
          if (authResult instanceof NextResponse) {
            console.log(`[createApiHandler] Falha na autenticação para ${req.url}`);
            return authResult; // Erro de autenticação
          }
          user = authResult.user;
          console.log(`[createApiHandler] Usuário autenticado: ${user.email} (role: ${user.role})`);

          if (options.requireAdmin && !requireAdmin(user)) {
            console.log(`[createApiHandler] Acesso negado - usuário ${user.email} não é admin`);
            return NextResponse.json(
              { message: "Permissão negada. Apenas administradores podem acessar esta rota." },
              { status: 403 }
            );
          }
        } catch (authError) {
          console.error(`[createApiHandler] Erro na autenticação para ${req.url}:`, authError);
          return handleApiError(authError);
        }
      }

      const params = context?.params
        ? typeof context.params === "object" && "then" in context.params
          ? await context.params
          : context.params
        : undefined;

      try {
        console.log(`[createApiHandler] Executando handler para ${req.url}`);
        const result = await handler(req, { user: user!, params });
        console.log(`[createApiHandler] Handler executado com sucesso para ${req.url}`);
        return result;
      } catch (handlerError) {
        console.error(`[createApiHandler] Erro no handler para ${req.url}:`, handlerError);
        return handleApiError(handlerError);
      }
    } catch (error) {
      console.error(`[createApiHandler] Erro não esperado para ${req.url}:`, error);
      return handleApiError(error);
    }
  };
}

