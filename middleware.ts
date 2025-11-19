import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Rate limiting removido temporariamente do middleware para compatibilidade com Edge Runtime
// O rate limiting pode ser implementado diretamente nas rotas da API se necessário
// TODO: Implementar rate limiting compatível com Edge Runtime ou mover para rotas individuais

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

export function middleware(request: NextRequest) {
  try {
    const pathname = request.nextUrl.pathname;

    // Ignorar arquivos estáticos do Next.js (já são excluídos pelo matcher, mas garantir)
    if (
      pathname.startsWith("/_next/") ||
      pathname.startsWith("/favicon.ico") ||
      pathname.match(/\.(svg|png|jpg|jpeg|gif|webp|woff|woff2|ttf|eot|css|js)$/i)
    ) {
      return NextResponse.next();
    }

    // Para rotas da API, a autenticação será verificada em cada rota individual
    // O rate limiting pode ser implementado diretamente nas rotas se necessário
    
    // Para rotas do frontend, deixamos o AuthContext gerenciar a autenticação
    // O middleware não verifica cookies porque o Supabase usa localStorage
    // O redirecionamento é feito pelo componente de login e AuthContext
    return NextResponse.next();
  } catch (error) {
    // Se houver algum erro, permite a requisição continuar
    // Isso evita que o middleware quebre completamente a aplicação
    console.error("Middleware error:", error);
    return NextResponse.next();
  }
}



