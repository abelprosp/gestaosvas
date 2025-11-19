import { NextRequest, NextResponse } from "next/server";
import { createApiHandler } from "@/lib/utils/apiHandler";
import { createServerClient } from "@/lib/supabase/server";
import { HttpError } from "@/lib/utils/httpError";
import { mapContractRow, contractUpdatePayload } from "@/lib/utils/mappers";

export const POST = createApiHandler(async (req, { params }) => {
  const supabase = createServerClient();
  const updatePayload = contractUpdatePayload({ status: "CANCELLED" });
  const { data, error } = await supabase
    .from("contracts")
    .update(updatePayload)
    .eq("id", params.id)
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





