import { NextResponse } from "next/server";
import { HttpError } from "./httpError";
import { isProduction, getSafeErrorMessage } from "./privacy";

/**
 * Sanitiza mensagens de erro do Supabase para não expor estrutura do banco
 */
function sanitizeSupabaseError(message: string): string {
  if (!isProduction()) {
    return message; // Em desenvolvimento, mostrar mensagem completa
  }

  // Remover nomes de tabelas e detalhes técnicos
  let sanitized = message
    // Ocultar nomes de tabelas
    .replace(/relation ['"]([\w_]+)['"]/gi, "tabela")
    .replace(/table ['"]([\w_]+)['"]/gi, "tabela")
    .replace(/column ['"]([\w_]+)['"]/gi, "campo")
    // Ocultar detalhes de constraint
    .replace(/constraint ['"]([\w_]+)['"]/gi, "restrição")
    // Ocultar códigos de erro específicos
    .replace(/\(SQLSTATE [\w\d]+\)/gi, "")
    // Simplificar mensagens de erro comuns
    .replace(/does not exist/gi, "não encontrado")
    .replace(/already exists/gi, "já existe")
    .replace(/violates foreign key constraint/gi, "viola restrição de integridade")
    .replace(/violates unique constraint/gi, "viola restrição de unicidade")
    .replace(/violates not-null constraint/gi, "campo obrigatório não informado")
    .trim();

  // Se a mensagem foi muito alterada, retornar mensagem genérica
  if (sanitized.length < message.length * 0.3) {
    return "Erro ao processar operação no banco de dados.";
  }

  return sanitized;
}

export function handleApiError(error: unknown): NextResponse {
  console.error("[handleApiError] Erro capturado:", {
    error,
    type: typeof error,
    isHttpError: error instanceof HttpError,
    isError: error instanceof Error,
    message: error instanceof Error ? error.message : String(error),
    stack: error instanceof Error ? error.stack : undefined,
  });

  if (error instanceof HttpError) {
    // Em produção, não expor detalhes sensíveis para erros 5xx
    const shouldHideDetails = isProduction() && error.status >= 500;
    return NextResponse.json(
      {
        message: error.message,
        ...(shouldHideDetails ? {} : { details: error.details }),
      },
      { status: error.status }
    );
  }

  // Tratar erros do Supabase
  if (error && typeof error === "object" && "message" in error) {
    const supabaseError = error as { message?: string; status?: number; name?: string };
    const status = supabaseError.status || 500;
    const isServerError = status >= 500;
    
    // Sanitizar mensagem do Supabase
    const rawMessage = supabaseError.message || "Erro ao processar requisição";
    const sanitizedMessage = sanitizeSupabaseError(rawMessage);
    
    // Em produção, mensagem genérica para erros de servidor
    const message = isProduction() && isServerError
      ? "Erro ao processar requisição"
      : sanitizedMessage;
    
    return NextResponse.json(
      {
        message,
        ...(isProduction() && isServerError ? {} : { details: { name: supabaseError.name } }),
      },
      { status }
    );
  }

  // Tratar erros genéricos
  const message = getSafeErrorMessage(
    error instanceof Error ? error : new Error(String(error)),
    "Erro interno do servidor"
  );
  
  console.error("[handleApiError] Erro não tratado, retornando 500:", message);
  return NextResponse.json(
    {
      message: isProduction() ? "Erro interno do servidor" : message,
      ...(isProduction() ? {} : { details: { originalMessage: message } }),
    },
    { status: 500 }
  );
}





