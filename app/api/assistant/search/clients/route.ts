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
  const query = searchParams.get("q")?.trim() || "";

  if (!query || query.length < 2) {
    return NextResponse.json({ results: [] });
  }

  try {
    const ilike = `%${query}%`;
    const { data, error } = await supabase
      .from("clients")
      .select("id, name, document, email")
      .or(`name.ilike.${ilike},document.ilike.${ilike},email.ilike.${ilike}`)
      .limit(10);

    if (error) {
      if (isSchemaMissing(error as { code?: string })) {
        return NextResponse.json({ results: [] });
      }
      throw error;
    }

    return NextResponse.json({
      results: (data ?? []).map((client) => ({
        id: client.id,
        name: client.name,
        document: client.document,
        email: client.email,
      })),
    });
  } catch (error) {
    if (isSchemaMissing(error as { code?: string })) {
      return NextResponse.json({ results: [] });
    }
    throw error;
  }
});





