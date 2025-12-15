import { NextResponse } from "next/server";
import { createApiHandler } from "@/lib/utils/apiHandler";
import { createServerClient } from "@/lib/supabase/server";
import { PostgrestError } from "@supabase/supabase-js";

const SCHEMA_MISSING_CODES = new Set(["PGRST200", "PGRST201", "PGRST202", "PGRST203", "PGRST204", "PGRST205"]);

function isSchemaMissing(error: PostgrestError | null | undefined) {
  return Boolean(error?.code && SCHEMA_MISSING_CODES.has(error.code));
}

async function countTvSlots(planType: "ESSENCIAL" | "PREMIUM") {
  const supabase = createServerClient();
  const { count, error } = await supabase
    .from("tv_slots")
    .select("id", { count: "exact", head: true })
    .eq("status", "ASSIGNED")
    .not("client_id", "is", null)
    .eq("plan_type", planType);

  const pgError = error as PostgrestError | null;
  if (pgError && !isSchemaMissing(pgError)) {
    throw pgError;
  }
  return count ?? 0;
}

async function findServiceIdsByNameLike(patterns: string[]) {
  const supabase = createServerClient();
  let query = supabase.from("services").select("id, name").limit(2000);
  const or = patterns.map((p) => `name.ilike.%${p}%`).join(",");
  query = query.or(or);
  const { data, error } = await query;
  const pgError = error as PostgrestError | null;
  if (pgError && !isSchemaMissing(pgError)) {
    throw pgError;
  }
  return (data ?? []).map((row: { id: string }) => row.id);
}

async function countCloudAccessesByServiceIds(serviceIds: string[]) {
  if (!serviceIds.length) return 0;
  const supabase = createServerClient();
  const { count, error } = await supabase
    .from("cloud_accesses")
    .select("id", { count: "exact", head: true })
    .in("service_id", serviceIds)
    .eq("is_test", false);

  const pgError = error as PostgrestError | null;
  if (pgError && !isSchemaMissing(pgError)) {
    throw pgError;
  }
  return count ?? 0;
}

export const GET = createApiHandler(async () => {
  const [tvEssencial, tvPremium, hubServiceIds, teleServiceIds] = await Promise.all([
    countTvSlots("ESSENCIAL"),
    countTvSlots("PREMIUM"),
    // Nomes típicos: "Hub", "HubPlay", "Hub TV"
    findServiceIdsByNameLike(["hub", "hubplay"]),
    // Nomes típicos: "Tele", "Telemed", "Telepet"
    findServiceIdsByNameLike(["tele", "telemed", "telepet"]),
  ]);

  const [hub, tele] = await Promise.all([
    countCloudAccessesByServiceIds(hubServiceIds),
    countCloudAccessesByServiceIds(teleServiceIds),
  ]);

  return NextResponse.json({
    tvEssencial,
    tvPremium,
    hub,
    tele,
  });
});


