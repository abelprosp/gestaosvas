import { NextRequest, NextResponse } from "next/server";
import { createApiHandler } from "@/lib/utils/apiHandler";
import { createServerClient } from "@/lib/supabase/server";
import { HttpError } from "@/lib/utils/httpError";
import { PostgrestError } from "@supabase/supabase-js";
import { mapTVSlotRow } from "@/lib/utils/mappers";
import { generateNumericPassword } from "@/lib/utils/password";
import { validateRouteParamUUID } from "@/lib/utils/validation";

const SCHEMA_ERROR_CODES = new Set(["PGRST200", "PGRST201", "PGRST202", "PGRST203", "PGRST204", "PGRST205"]);

function isSchemaMissing(error: unknown): error is PostgrestError {
  return Boolean((error as PostgrestError)?.code && SCHEMA_ERROR_CODES.has((error as PostgrestError).code));
}

function ensureTablesAvailable(error: PostgrestError) {
  if (isSchemaMissing(error)) {
    throw new HttpError(
      503,
      "Funcionalidade de TV indisponível. Execute o script supabase/schema.sql e atualize o cache do Supabase.",
    );
  }
}

export const POST = createApiHandler(
  async (req, { params }) => {
    // Validar UUID do parâmetro
    const slotId = validateRouteParamUUID(params.id, "id");
    
    const supabase = createServerClient();

    const { data, error } = await supabase
      .from("tv_slots")
      .update({
        status: "USED",
        client_id: null,
        sold_by: null,
        sold_at: null,
        expires_at: null,
        notes: null,
        password: generateNumericPassword(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", slotId)
      .select("*, tv_accounts(*)")
      .maybeSingle();

    if (error) {
      ensureTablesAvailable(error as PostgrestError);
      throw error;
    }

    if (!data) {
      throw new HttpError(404, "Slot não encontrado");
    }

    const { error: historyError } = await supabase.from("tv_slot_history").insert({
      tv_slot_id: slotId,
      action: "RELEASED",
      metadata: {},
    });

    if (historyError && !isSchemaMissing(historyError)) {
      throw historyError;
    }

    return NextResponse.json(mapTVSlotRow(data));
  },
  { requireAdmin: true }
);





