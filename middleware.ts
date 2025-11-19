import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Middleware minimalista para compatibilidade máxima com Edge Runtime
// Rate limiting removido - pode ser implementado nas rotas individuais se necessário
// Autenticação é gerenciada pelo AuthContext no frontend e nas rotas da API

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

export function middleware(_request: NextRequest) {
  // Middleware minimalista - apenas passa as requisições
  // Toda lógica de autenticação e rate limiting está nas rotas individuais
  return NextResponse.next();
}



