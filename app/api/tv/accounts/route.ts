import { NextRequest, NextResponse } from "next/server";
import { createApiHandler } from "@/lib/utils/apiHandler";
import { createServerClient } from "@/lib/supabase/server";
import { mapTVAccountRow, mapTVSlotRow } from "@/lib/utils/mappers";

export const GET = createApiHandler(async (req) => {
  const supabase = createServerClient();
  const { data, error } = await supabase
    .from("tv_accounts")
    .select("*, tv_slots(*)")
    .order("email", { ascending: true })
    .order("slot_number", { ascending: true, foreignTable: "tv_slots" });

  if (error) {
    throw error;
  }

  const formatted = (data ?? []).map((account) => ({
    account: mapTVAccountRow(account),
    slots: (account.tv_slots ?? []).map((slot: any) => mapTVSlotRow({ ...slot, tv_accounts: account })),
  }));

  return NextResponse.json(formatted);
});





