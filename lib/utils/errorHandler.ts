import { NextResponse } from "next/server";
import { HttpError } from "./httpError";

export function handleApiError(error: unknown): NextResponse {
  if (error instanceof HttpError) {
    return NextResponse.json(
      {
        message: error.message,
        details: error.details,
      },
      { status: error.status }
    );
  }

  console.error("Unhandled error", error);
  return NextResponse.json(
    { message: "Erro interno do servidor" },
    { status: 500 }
  );
}





