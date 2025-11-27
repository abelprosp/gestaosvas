/**
 * Utilitários para proteger informações sensíveis em logs e respostas
 */

/**
 * Mascara um email, mostrando apenas os primeiros caracteres
 * Exemplo: "usuario@example.com" -> "us***@example.com"
 */
export function maskEmail(email?: string): string {
  if (!email) return "N/A";
  const [local, domain] = email.split("@");
  if (!domain) return "***";
  
  if (local.length <= 2) {
    return `***@${domain}`;
  }
  
  const maskedLocal = `${local.substring(0, 2)}***`;
  return `${maskedLocal}@${domain}`;
}

/**
 * Remove query parameters de uma URL para evitar expor tokens ou dados sensíveis
 */
export function sanitizeUrl(url: string): string {
  try {
    const parsed = new URL(url);
    parsed.search = ""; // Remove query params
    parsed.hash = ""; // Remove hash
    return parsed.pathname; // Retorna apenas o path
  } catch {
    // Se não for uma URL válida, retorna apenas a parte antes do '?'
    return url.split("?")[0].split("#")[0];
  }
}

/**
 * Remove campos sensíveis de um objeto antes de logar
 */
export function sanitizeForLogging(data: any, sensitiveFields: string[] = ["password", "token", "secret", "key", "authorization"]): any {
  if (data === null || data === undefined) {
    return data;
  }

  if (typeof data !== "object") {
    return data;
  }

  if (Array.isArray(data)) {
    return data.map(item => sanitizeForLogging(item, sensitiveFields));
  }

  const sanitized: any = {};
  for (const [key, value] of Object.entries(data)) {
    const lowerKey = key.toLowerCase();
    const isSensitive = sensitiveFields.some(field => lowerKey.includes(field.toLowerCase()));
    
    if (isSensitive) {
      sanitized[key] = "***REDACTED***";
    } else if (typeof value === "object" && value !== null) {
      sanitized[key] = sanitizeForLogging(value, sensitiveFields);
    } else {
      sanitized[key] = value;
    }
  }

  return sanitized;
}

/**
 * Verifica se está em ambiente de produção
 */
export function isProduction(): boolean {
  return process.env.NODE_ENV === "production";
}

/**
 * Retorna uma mensagem de erro genérica em produção, detalhada em desenvolvimento
 */
export function getSafeErrorMessage(error: Error, defaultMessage: string = "Erro interno do servidor"): string {
  if (isProduction()) {
    return defaultMessage;
  }
  return error.message || defaultMessage;
}

