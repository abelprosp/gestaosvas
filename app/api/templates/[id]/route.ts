import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createApiHandler } from "@/lib/utils/apiHandler";
import { createServerClient } from "@/lib/supabase/server";
import { HttpError } from "@/lib/utils/httpError";
import { mapTemplateRow, templateUpdatePayload } from "@/lib/utils/mappers";
import { validateRouteParamUUID } from "@/lib/utils/validation";
import { requirePasswordConfirmation } from "@/lib/auth";

const templateSchema = z.object({
  name: z.string().min(3),
  content: z.string().min(10),
  active: z.boolean().optional(),
});

const templateUpdateSchema = templateSchema.partial();

export const PUT = createApiHandler(async (req, { params, user }) => {
  // Validar UUID do parâmetro
  const templateId = validateRouteParamUUID(params.id, "id");
  
  const supabase = createServerClient();
  const body = await req.json();
  const payload = templateUpdateSchema.parse(body);
  const updatePayload = templateUpdatePayload(payload);
  const { data, error } = await supabase
    .from("contract_templates")
    .update(updatePayload)
    .eq("id", templateId)
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
    await requirePasswordConfirmation(req, user);

    // Validar UUID do parâmetro
    const templateId = validateRouteParamUUID(params.id, "id");
    
    const { error } = await supabase.from("contract_templates").delete().eq("id", templateId);

    if (error) {
      throw error;
    }

    return new NextResponse(null, { status: 204 });
  },
  { requireAdmin: true }
);




