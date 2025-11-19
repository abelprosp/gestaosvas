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
    const [clientsCount, contractsCount, tvSlotsCount, servicesCount] = await Promise.all([
      supabase.from("clients").select("id", { count: "exact", head: true }),
      supabase.from("contracts").select("id", { count: "exact", head: true }),
      supabase.from("tv_slots").select("id", { count: "exact", head: true }).eq("status", "ASSIGNED"),
      supabase.from("services").select("id", { count: "exact", head: true }),
    ]);

    return NextResponse.json({
      clients: clientsCount.count ?? 0,
      contracts: contractsCount.count ?? 0,
      tvActive: tvSlotsCount.count ?? 0,
      services: servicesCount.count ?? 0,
    });
  } catch (error) {
    if (isSchemaMissing(error as { code?: string })) {
      return NextResponse.json({ clients: 0, contracts: 0, tvActive: 0, services: 0 });
    }
    throw error;
  }
});





