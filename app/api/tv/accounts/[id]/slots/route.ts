import { NextRequest, NextResponse } from "next/server";
import { createApiHandler } from "@/lib/utils/apiHandler";
import { createServerClient } from "@/lib/supabase/server";
import { mapTVSlotRow } from "@/lib/utils/mappers";
import { PostgrestError } from "@supabase/supabase-js";

const SCHEMA_ERROR_CODES = new Set(["PGRST200", "PGRST201", "PGRST202", "PGRST203", "PGRST204", "PGRST205"]);

function isSchemaMissing(error: unknown): error is PostgrestError {
  return Boolean((error as PostgrestError)?.code && SCHEMA_ERROR_CODES.has((error as PostgrestError).code));
}

export const GET = createApiHandler(
  async (req, { params }) => {
    const accountId = params.id;
    const supabase = createServerClient();

    const { data: slots, error } = await supabase
      .from("tv_slots")
      .select("*, tv_accounts(*), client:clients(id, name, email, document)")
      .eq("tv_account_id", accountId)
      .order("slot_number", { ascending: true });

    if (error) {
      if (isSchemaMissing(error)) {
        return NextResponse.json([]);
      }
      throw error;
    }

    const formatted = (slots ?? []).map((slot) => {
      const mapped = mapTVSlotRow(slot);
      return {
        id: mapped.id,
        slotNumber: mapped.slotNumber,
        username: mapped.username,
        status: mapped.status,
        clientId: mapped.clientId,
        client: slot.client ?? null,
        planType: mapped.planType,
        soldBy: mapped.soldBy,
        soldAt: mapped.soldAt,
        expiresAt: mapped.expiresAt,
        notes: mapped.notes,
        hasTelephony: mapped.hasTelephony,
      };
    });

    return NextResponse.json(formatted);
  },
  { requireAdmin: true }
);

