import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createApiHandler } from "@/lib/utils/apiHandler";
import { createServerClient } from "@/lib/supabase/server";
import { HttpError } from "@/lib/utils/httpError";
import { mapTemplateRow, templateUpdatePayload } from "@/lib/utils/mappers";

const templateSchema = z.object({
  name: z.string().min(3),
  content: z.string().min(10),
  active: z.boolean().optional(),
});

const templateUpdateSchema = templateSchema.partial();
const templateDeleteSchema = z.object({
  password: z.string().min(1, "Informe sua senha para confirmar."),
});

export const PUT = createApiHandler(async (req, { params, user }) => {
  const supabase = createServerClient();
  const body = await req.json();
  const payload = templateUpdateSchema.parse(body);
  const updatePayload = templateUpdatePayload(payload);
  const { data, error } = await supabase
    .from("contract_templates")
    .update(updatePayload)
    .eq("id", params.id)
    .select("*")
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!data) {
    throw new HttpError(404, "Template não encontrado");
  }

  return NextResponse.json(mapTemplateRow(data));
});

export const DELETE = createApiHandler(
  async (req, { params, user }) => {
    const supabase = createServerClient();
    const body = await req.json().catch(() => ({}));
    const { password } = templateDeleteSchema.parse(body ?? {});

    if (!user.email) {
      throw new HttpError(400, "Conta sem e-mail. Faça login novamente.");
    }

    const { error: authError } = await supabase.auth.signInWithPassword({
      email: user.email,
      password,
    });

    if (authError) {
      throw new HttpError(401, "Senha incorreta. Tente novamente.");
    }

    const { error } = await supabase.from("contract_templates").delete().eq("id", params.id);

    if (error) {
      throw error;
    }

    return new NextResponse(null, { status: 204 });
  },
  { requireAdmin: true }
);





