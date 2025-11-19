import { NextRequest, NextResponse } from "next/server";
import { createApiHandler } from "@/lib/utils/apiHandler";
import { createServerClient } from "@/lib/supabase/server";

const SCHEMA_ERROR_CODES = new Set(["PGRST200", "PGRST201", "PGRST202", "PGRST203", "PGRST204", "PGRST205"]);

function isSchemaMissing(error: unknown): boolean {
  return Boolean((error as { code?: string })?.code && SCHEMA_ERROR_CODES.has((error as { code: string }).code));
}

export const GET = createApiHandler(async (req) => {
  const supabase = createServerClient();

  try {
    const { data: allSlots, error: fetchError } = await supabase
      .from("tv_slots")
      .select("id, status, tv_accounts(email)")
      .eq("status", "AVAILABLE")
      .is("client_id", null);

    if (fetchError) {
      if (isSchemaMissing(fetchError as { code?: string })) {
        return NextResponse.json({ count: 0 });
      }
      throw fetchError;
    }

    if (!allSlots || allSlots.length === 0) {
      return NextResponse.json({ count: 0 });
    }

    const slotIds = allSlots.map((slot: any) => slot.id);
    const { data: assignedHistory } = await supabase
      .from("tv_slot_history")
      .select("tv_slot_id")
      .eq("action", "ASSIGNED")
      .in("tv_slot_id", slotIds);

    const usedSlotIds = new Set((assignedHistory ?? []).map((h: any) => h.tv_slot_id));
    const availableCount = allSlots.filter((slot: any) => !usedSlotIds.has(slot.id)).length;

    return NextResponse.json({ count: availableCount });
  } catch (error) {
    if (isSchemaMissing(error as { code?: string })) {
      return NextResponse.json({ count: 0 });
    }
    throw error;
  }
});





