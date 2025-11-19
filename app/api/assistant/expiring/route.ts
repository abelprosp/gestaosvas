import { NextRequest, NextResponse } from "next/server";
import { createApiHandler } from "@/lib/utils/apiHandler";
import { createServerClient } from "@/lib/supabase/server";

const SCHEMA_ERROR_CODES = new Set(["PGRST200", "PGRST201", "PGRST202", "PGRST203", "PGRST204", "PGRST205"]);

function isSchemaMissing(error: unknown): boolean {
  return Boolean((error as { code?: string })?.code && SCHEMA_ERROR_CODES.has((error as { code: string }).code));
}

export const GET = createApiHandler(async (req) => {
  const supabase = createServerClient();
  const { searchParams } = new URL(req.url);
  const days = Number(searchParams.get("days") ?? "30");

  try {
    const targetDate = new Date();
    targetDate.setDate(targetDate.getDate() + days);
    const targetDateStr = targetDate.toISOString().slice(0, 10);

    const [cloudExpiring, tvExpiring] = await Promise.all([
      supabase
        .from("cloud_accesses")
        .select("id, expires_at, client:clients(name), service:services(name)")
        .lte("expires_at", targetDateStr)
        .gte("expires_at", new Date().toISOString().slice(0, 10))
        .limit(10),
      supabase
        .from("tv_slots")
        .select("id, expires_at, client:clients(name)")
        .lte("expires_at", targetDateStr)
        .gte("expires_at", new Date().toISOString().slice(0, 10))
        .eq("status", "ASSIGNED")
        .not("expires_at", "is", null)
        .limit(10),
    ]);

    const cloudResults = (cloudExpiring.data ?? []).map((access: any) => ({
      type: "cloud" as const,
      expiresAt: access.expires_at,
      clientName: access.client?.name ?? "-",
      serviceName: access.service?.name ?? "-",
    }));

    const tvResults = (tvExpiring.data ?? []).map((slot: any) => ({
      type: "tv" as const,
      expiresAt: slot.expires_at,
      clientName: slot.client?.name ?? "-",
      serviceName: "TV",
    }));

    return NextResponse.json({ results: [...cloudResults, ...tvResults].slice(0, 10) });
  } catch (error) {
    if (isSchemaMissing(error as { code?: string })) {
      return NextResponse.json({ results: [] });
    }
    throw error;
  }
});





