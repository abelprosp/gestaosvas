import { NextResponse } from "next/server";
import { HttpError } from "./httpError";

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
    return NextResponse.json(
      {
        message: error.message,
        details: error.details,
      },
      { status: error.status }
    );
  }

  // Tratar erros do Supabase
  if (error && typeof error === "object" && "message" in error) {
    const supabaseError = error as { message?: string; status?: number; name?: string };
    const status = supabaseError.status || 500;
    return NextResponse.json(
      {
        message: supabaseError.message || "Erro ao processar requisição",
        details: { name: supabaseError.name },
      },
      { status }
    );
  }

  // Tratar erros genéricos
  const message = error instanceof Error ? error.message : String(error);
  console.error("[handleApiError] Erro não tratado, retornando 500:", message);
  return NextResponse.json(
    {
      message: "Erro interno do servidor",
      details: { originalMessage: message },
    },
    { status: 500 }
  );
}





