import { NextRequest, NextResponse } from "next/server";
import { createApiHandler } from "@/lib/utils/apiHandler";
import { createServerClient } from "@/lib/supabase/server";
import { PostgrestError } from "@supabase/supabase-js";
import { mapTVSlotHistoryRow } from "@/lib/utils/mappers";

const SCHEMA_ERROR_CODES = new Set(["PGRST200", "PGRST201", "PGRST202", "PGRST203", "PGRST204", "PGRST205"]);

function isSchemaMissing(error: unknown): error is PostgrestError {
  return Boolean((error as PostgrestError)?.code && SCHEMA_ERROR_CODES.has((error as PostgrestError).code));
}

export const GET = createApiHandler(async (req, { params }) => {
  const supabase = createServerClient();
  const slotId = params.id;
  const { data, error } = await supabase
    .from("tv_slot_history")
    .select("*")
    .eq("tv_slot_id", slotId)
    .order("created_at", { ascending: false });

  if (error) {
    if (isSchemaMissing(error)) {
      return NextResponse.json([]);
    }
    throw error;
  }

  return NextResponse.json((data ?? []).map(mapTVSlotHistoryRow));
});





