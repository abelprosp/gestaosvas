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
        const authResult = await requireAuth(req);
        if (authResult instanceof NextResponse) {
          return authResult; // Erro de autenticação
        }
        user = authResult.user;

        if (options.requireAdmin && !requireAdmin(user)) {
          return NextResponse.json({ message: "Permissão negada" }, { status: 403 });
        }
      }

      const params = context?.params
        ? typeof context.params === "object" && "then" in context.params
          ? await context.params
          : context.params
        : undefined;

      return await handler(req, { user: user!, params });
    } catch (error) {
      return handleApiError(error);
    }
  };
}

