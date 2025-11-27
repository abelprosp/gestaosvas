import { NextRequest, NextResponse } from "next/server";
import { createApiHandler } from "@/lib/utils/apiHandler";
import { createServerClient } from "@/lib/supabase/server";
import { HttpError } from "@/lib/utils/httpError";
import { mapContractRow, contractUpdatePayload } from "@/lib/utils/mappers";
import { sendToZapsign } from "@/lib/services/zapsignSimulator";
import { validateRouteParamUUID } from "@/lib/utils/validation";

export const POST = createApiHandler(async (req, { params }) => {
  // Validar UUID do parâmetro
  const contractId = validateRouteParamUUID(params.id, "id");
  
  const supabase = createServerClient();
  const { data: contractRow, error } = await supabase
    .from("contracts")
    .select("*, client:clients(*)")
    .eq("id", contractId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!contractRow) {
    throw new HttpError(404, "Contrato não encontrado");
  }

  if (contractRow.status === "CANCELLED") {
    throw new HttpError(400, "Contrato cancelado não pode ser enviado");
  }

  const result = await sendToZapsign({
    contractId: contractRow.id,
    title: contractRow.title,
    clientName: contractRow.client?.name ?? "",
    clientEmail: contractRow.client?.email ?? "",
  });

  const updatePayload = contractUpdatePayload({
    status: "SENT",
    sentAt: new Date().toISOString(),
    signUrl: result.signUrl,
    externalId: result.externalId,
  });

  const { data: updatedRow, error: updateError } = await supabase
    .from("contracts")
    .update(updatePayload)
    .eq("id", contractRow.id)
    .select("*, client:clients(*), template:contract_templates(*)")
    .maybeSingle();

  if (updateError) {
    throw updateError;
  }

  return NextResponse.json({ contract: mapContractRow(updatedRow!), message: result.message });
});





