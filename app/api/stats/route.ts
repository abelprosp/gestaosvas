import { NextRequest, NextResponse } from "next/server";
import { createApiHandler } from "@/lib/utils/apiHandler";
import { createServerClient } from "@/lib/supabase/server";

export const GET = createApiHandler(async (req) => {
  const supabase = createServerClient();

  const { count: totalClients, error: clientsError } = await supabase
    .from("clients")
    .select("id", { count: "exact", head: true });

  if (clientsError) throw clientsError;

  const { count: totalContracts, error: contractsError } = await supabase
    .from("contracts")
    .select("id", { count: "exact", head: true });

  if (contractsError) throw contractsError;

  const { count: activeTvSlots, error: tvSlotsError } = await supabase
    .from("tv_slots")
    .select("id", { count: "exact", head: true })
    .eq("status", "ASSIGNED");

  if (tvSlotsError) throw tvSlotsError;

  const { count: activeCloudAccesses, error: cloudAccessesError } = await supabase
    .from("cloud_accesses")
    .select("id", { count: "exact", head: true })
    .not("is_test", "eq", true)
    .gte("expires_at", new Date().toISOString().slice(0, 10));

  if (cloudAccessesError) throw cloudAccessesError;

  return NextResponse.json({
    totalClients: totalClients ?? 0,
    totalContracts: totalContracts ?? 0,
    activeTvSlots: activeTvSlots ?? 0,
    activeCloudAccesses: activeCloudAccesses ?? 0,
  });
});





