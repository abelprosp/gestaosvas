import { NextRequest, NextResponse } from "next/server";

interface RateLimitOptions {
  windowMs: number; // Janela de tempo em milissegundos
  maxRequests: number; // Número máximo de requisições por janela
  identifier?: (req: NextRequest) => string; // Função para identificar o cliente
}

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

// Armazenamento em memória (em produção, considere usar Redis/Vercel KV)
const rateLimitStore = new Map<string, RateLimitEntry>();

// Última limpeza executada (para evitar limpeza excessiva)
let lastCleanup = Date.now();
const CLEANUP_INTERVAL = 60000; // Limpa a cada 1 minuto

/**
 * Limpa entradas expiradas do store (lazy cleanup)
 */
function cleanupExpiredEntries() {
  const now = Date.now();
  
  // Só limpa se passou tempo suficiente desde a última limpeza
  if (now - lastCleanup < CLEANUP_INTERVAL) {
    return;
  }
  
  lastCleanup = now;
  
  for (const [key, entry] of rateLimitStore.entries()) {
    if (entry.resetAt < now) {
      rateLimitStore.delete(key);
    }
  }
}

/**
 * Identifica o cliente baseado no IP ou token de autenticação
 */
function defaultIdentifier(req: NextRequest): string {
  // Tenta usar o IP do cliente
  const forwarded = req.headers.get("x-forwarded-for");
  const ip = forwarded ? forwarded.split(",")[0] : req.headers.get("x-real-ip") || "unknown";

  // Se houver token de autenticação, usa como identificador adicional
  const authHeader = req.headers.get("authorization");
  if (authHeader) {
    const token = authHeader.replace(/^Bearer\s+/i, "").trim();
    if (token) {
      // Usa hash do token para preservar privacidade
      return `${ip}:${token.slice(0, 8)}`;
    }
  }

  return ip;
}

/**
 * Verifica se a requisição excede o limite de taxa
 */
export function checkRateLimit(
  req: NextRequest,
  options: RateLimitOptions
): { allowed: boolean; remaining: number; resetAt: number } {
  // Limpa entradas expiradas periodicamente (lazy cleanup)
  cleanupExpiredEntries();

  const identifier = (options.identifier || defaultIdentifier)(req);
  const now = Date.now();
  const entry = rateLimitStore.get(identifier);

  if (!entry || entry.resetAt < now) {
    // Nova janela de tempo
    const resetAt = now + options.windowMs;
    rateLimitStore.set(identifier, { count: 1, resetAt });
    return {
      allowed: true,
      remaining: options.maxRequests - 1,
      resetAt,
    };
  }

  // Incrementa contador
  entry.count += 1;

  if (entry.count > options.maxRequests) {
    // Limite excedido
    return {
      allowed: false,
      remaining: 0,
      resetAt: entry.resetAt,
    };
  }

  // Dentro do limite
  return {
    allowed: true,
    remaining: options.maxRequests - entry.count,
    resetAt: entry.resetAt,
  };
}

/**
 * Middleware de rate limiting
 */
export function rateLimit(options: RateLimitOptions) {
  return (req: NextRequest): NextResponse | null => {
    const result = checkRateLimit(req, options);

    if (!result.allowed) {
      const resetIn = Math.ceil((result.resetAt - Date.now()) / 1000);
      return NextResponse.json(
        {
          message: "Muitas requisições. Tente novamente mais tarde.",
          retryAfter: resetIn,
        },
        {
          status: 429,
          headers: {
            "Retry-After": String(resetIn),
            "X-RateLimit-Limit": String(options.maxRequests),
            "X-RateLimit-Remaining": "0",
            "X-RateLimit-Reset": String(result.resetAt),
          },
        }
      );
    }

    // Permite a requisição continuar (retorna null para indicar que não bloqueou)
    // Headers informativos podem ser adicionados no response handler
    return null;
  };
}

/**
 * Configurações pré-definidas de rate limiting
 */
export const RATE_LIMITS = {
  // Rate limit padrão para APIs
  API_DEFAULT: {
    windowMs: 60 * 1000, // 1 minuto
    maxRequests: 60, // 60 requisições por minuto
  },
  // Rate limit mais restritivo para login e criação de usuários
  AUTH_STRICT: {
    windowMs: 15 * 60 * 1000, // 15 minutos
    maxRequests: 5, // 5 requisições por 15 minutos
  },
  // Rate limit para rotas admin
  ADMIN: {
    windowMs: 60 * 1000, // 1 minuto
    maxRequests: 30, // 30 requisições por minuto
  },
  // Rate limit para busca de CNPJ (chamadas externas)
  CNPJ_LOOKUP: {
    windowMs: 60 * 1000, // 1 minuto
    maxRequests: 10, // 10 requisições por minuto
  },
} as const;

