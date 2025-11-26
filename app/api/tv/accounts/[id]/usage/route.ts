import { NextRequest, NextResponse } from "next/server";
import { createApiHandler } from "@/lib/utils/apiHandler";
import { createServerClient } from "@/lib/supabase/server";
import { PostgrestError } from "@supabase/supabase-js";

const SCHEMA_ERROR_CODES = new Set(["PGRST200", "PGRST201", "PGRST202", "PGRST203", "PGRST204", "PGRST205"]);

function isSchemaMissing(error: unknown): error is PostgrestError {
  return Boolean((error as PostgrestError)?.code && SCHEMA_ERROR_CODES.has((error as PostgrestError).code));
}

export const GET = createApiHandler(
  async (req, { params }) => {
    const accountId = params.id;
    const supabase = createServerClient();

    // Buscar todos os slots da conta
    const { data: slots, error: slotsError } = await supabase
      .from("tv_slots")
      .select("id, status, client_id")
      .eq("tv_account_id", accountId);

    if (slotsError) {
      if (isSchemaMissing(slotsError)) {
        return NextResponse.json({ totalSlots: 0, assignedSlots: 0 });
      }
      throw slotsError;
    }

    const totalSlots = slots?.length ?? 0;
    const assignedSlots = slots?.filter((s) => s.status === "ASSIGNED" && s.client_id).length ?? 0;

    return NextResponse.json({
      totalSlots,
      assignedSlots,
    });
  },
  { requireAdmin: true }
);

