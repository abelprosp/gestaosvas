import { NextRequest, NextResponse } from "next/server";
import { createApiHandler } from "@/lib/utils/apiHandler";
import { createServerClient } from "@/lib/supabase/server";
import { HttpError } from "@/lib/utils/httpError";
import { mapContractRow, contractUpdatePayload } from "@/lib/utils/mappers";
import { validateRouteParamUUID } from "@/lib/utils/validation";

export const POST = createApiHandler(async (req, { params }) => {
  // Validar UUID do parâmetro
  const contractId = validateRouteParamUUID(params.id, "id");
  
  const supabase = createServerClient();
  const updatePayload = contractUpdatePayload({ status: "CANCELLED" });
  const { data, error } = await supabase
    .from("contracts")
    .update(updatePayload)
    .eq("id", contractId)
    .select("*, client:clients(*), template:contract_templates(*)")
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!data) {
    throw new HttpError(404, "Contrato não encontrado");
  }

  return NextResponse.json({ contract: mapContractRow(data), message: "Contrato cancelado" });
});





