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

async function countTvTelephonySlots() {
  const supabase = createServerClient();
  const { count, error } = await supabase
    .from("tv_slots")
    .select("id", { count: "exact", head: true })
    .eq("status", "ASSIGNED")
    .not("client_id", "is", null)
    .eq("has_telephony", true);

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

async function countAllCloudAccesses(excludedServiceIds: string[] = []) {
  const supabase = createServerClient();
  let query = supabase
    .from("cloud_accesses")
    .select("id", { count: "exact", head: true })
    .eq("is_test", false)
    .gte("expires_at", new Date().toISOString().slice(0, 10));

  if (excludedServiceIds.length > 0) {
    const formatted = excludedServiceIds.map((id) => `"${id}"`).join(",");
    query = query.not("service_id", "in", `(${formatted})`);
  }

  const { count, error } = await query;

  const pgError = error as PostgrestError | null;
  if (pgError && !isSchemaMissing(pgError)) {
    throw pgError;
  }
  return count ?? 0;
}

export const GET = createApiHandler(async () => {
  const [tvEssencial, tvPremium, tvTelephony, hiddenServiceIds] = await Promise.all([
    countTvSlots("ESSENCIAL"),
    countTvSlots("PREMIUM"),
    countTvTelephonySlots(),
    // Serviços ocultos: Hub/Telemedicina
    findServiceIdsByNameLike(["hub", "hubplay", "telemedicina", "telepet"]),
  ]);

  const cloud = await countAllCloudAccesses(hiddenServiceIds);

  return NextResponse.json({
    tvEssencial,
    tvPremium,
    tvTelephony,
    cloud,
  });
});

