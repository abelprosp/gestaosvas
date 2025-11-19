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
    const { data, error } = await supabase
      .from("contracts")
      .select("id, title, status, client:clients(name)")
      .in("status", ["DRAFT", "SENT"])
      .limit(10)
      .order("created_at", { ascending: false });

    if (error) {
      if (isSchemaMissing(error as { code?: string })) {
        return NextResponse.json({ results: [] });
      }
      throw error;
    }

    return NextResponse.json({
      results: (data ?? []).map((contract: any) => ({
        id: contract.id,
        title: contract.title,
        status: contract.status,
        clientName: contract.client?.name ?? "-",
      })),
    });
  } catch (error) {
    if (isSchemaMissing(error as { code?: string })) {
      return NextResponse.json({ results: [] });
    }
    throw error;
  }
});





