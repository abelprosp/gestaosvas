import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { rateLimit, RATE_LIMITS } from "@/lib/utils/rateLimit";

export function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  // Ignorar arquivos estáticos do Next.js (já são excluídos pelo matcher, mas garantir)
  if (
    pathname.startsWith("/_next/") ||
    pathname.startsWith("/favicon.ico") ||
    pathname.match(/\.(svg|png|jpg|jpeg|gif|webp|woff|woff2|ttf|eot|css|js)$/i)
  ) {
    return NextResponse.next();
  }

  // Aplicar rate limiting em rotas específicas
  if (pathname.startsWith("/api/")) {
    // Ignorar health check (não precisa de rate limiting)
    if (pathname.startsWith("/api/health")) {
      return NextResponse.next();
    }

    // Ignorar auth (não aplicamos rate limiting aqui)
    if (pathname.startsWith("/api/auth")) {
      return NextResponse.next();
    }

    // Rate limiting específico para busca de CNPJ (chamadas externas custosas)
    if (pathname.match(/^\/api\/clients\/lookup\/cnpj\/[^/]+$/)) {
      const rateLimitResponse = rateLimit(RATE_LIMITS.CNPJ_LOOKUP)(request);
      if (rateLimitResponse) {
        return rateLimitResponse; // Bloqueia requisição
      }
      // Continua para processamento normal
      return NextResponse.next();
    }

    // Rate limiting padrão para todas as outras rotas da API
    const rateLimitResponse = rateLimit(RATE_LIMITS.API_DEFAULT)(request);
    if (rateLimitResponse) {
      return rateLimitResponse; // Bloqueia requisição
    }

    // A autenticação será verificada em cada rota da API
    return NextResponse.next();
  }

  // Para rotas do frontend, deixamos o AuthContext gerenciar a autenticação
  // O middleware não verifica cookies porque o Supabase usa localStorage
  // O redirecionamento é feito pelo componente de login e AuthContext
  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - _next/webpack-hmr (HMR)
     * - favicon.ico (favicon file)
     * - public folder files
     */
    "/((?!_next/static|_next/image|_next/webpack-hmr|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|woff|woff2|ttf|eot|css|js)$).*)",
  ],
};



