import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createApiHandler } from "@/lib/utils/apiHandler";
import { createServerClient } from "@/lib/supabase/server";
import { HttpError } from "@/lib/utils/httpError";

const requestSchema = z.object({
  action: z.string().min(1),
  payload: z.record(z.string(), z.any()).optional(),
});

export const POST = createApiHandler(async (req, { user }) => {
  const supabase = createServerClient();
  const body = await req.json();
  const { action, payload } = requestSchema.parse(body);

  if (!user) {
    throw new HttpError(401, "Usuário não autenticado.");
  }

  const { error } = await supabase.from("action_requests").insert({
    user_id: user.id,
    action,
    payload: payload ?? null,
  });

  if (error) {
    throw error;
  }

  return NextResponse.json({ message: "Solicitação registrada com sucesso." }, { status: 201 });
});





