import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createApiHandler } from "@/lib/utils/apiHandler";
import { createServerClient } from "@/lib/supabase/server";
import { HttpError } from "@/lib/utils/httpError";
import { lineUpdatePayload, mapLineRow } from "@/lib/utils/mappers";
import { validateRouteParamUUID } from "@/lib/utils/validation";

const lineUpdateSchema = z
  .object({
    clientId: z.string().uuid().optional(),
    nickname: z.string().optional(),
    phoneNumber: z.string().min(8).optional(),
    type: z.enum(["TITULAR", "DEPENDENTE"]).optional(),
    document: z.string().optional(),
    notes: z.string().optional(),
  })
  .partial();

export const PUT = createApiHandler(async (req, { params }) => {
  // Validar UUID do parâmetro
  const lineId = validateRouteParamUUID(params.id, "id");
  
  const supabase = createServerClient();
  const body = await req.json();
  const payload = lineUpdateSchema.parse(body);
  const updatePayload = lineUpdatePayload(payload);
  const { data, error } = await supabase
    .from("lines")
    .update(updatePayload)
    .eq("id", lineId)
    .select("*")
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!data) {
    throw new HttpError(404, "Linha não encontrada");
  }

  return NextResponse.json(mapLineRow(data));
});

export const DELETE = createApiHandler(async (req, { params }) => {
  // Validar UUID do parâmetro
  const lineId = validateRouteParamUUID(params.id, "id");
  
  const supabase = createServerClient();
  const { error } = await supabase.from("lines").delete().eq("id", lineId);

  if (error) {
    throw error;
  }

  return new NextResponse(null, { status: 204 });
});





