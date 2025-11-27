import { NextRequest, NextResponse } from "next/server";
import { createApiHandler } from "@/lib/utils/apiHandler";
import { createServerClient } from "@/lib/supabase/server";
import { HttpError } from "@/lib/utils/httpError";
import { mapContractRow, mapClientRow, mapLineRow, mapTemplateRow, contractUpdatePayload } from "@/lib/utils/mappers";
import { validateRouteParamUUID } from "@/lib/utils/validation";

export const GET = createApiHandler(async (req, { params }) => {
  // Validar UUID do parâmetro
  const contractId = validateRouteParamUUID(params.id, "id");
  
  const supabase = createServerClient();
  const { data, error } = await supabase
    .from("contracts")
    .select("*, client:clients(*, lines(*)), template:contract_templates(*)")
    .eq("id", contractId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!data) {
    throw new HttpError(404, "Contrato não encontrado");
  }

  const contract = mapContractRow(data);
  const clientLines = data.client?.lines ? data.client.lines.map(mapLineRow) : [];
  const client = data.client ? { ...mapClientRow(data.client), lines: clientLines } : undefined;
  const template = data.template ? mapTemplateRow(data.template) : undefined;

  return NextResponse.json({ ...contract, client, template });
});





