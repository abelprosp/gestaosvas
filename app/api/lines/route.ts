import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createApiHandler } from "@/lib/utils/apiHandler";
import { createServerClient } from "@/lib/supabase/server";
import { HttpError } from "@/lib/utils/httpError";
import { lineInsertPayload, lineUpdatePayload, mapLineRow } from "@/lib/utils/mappers";

const lineSchema = z.object({
  clientId: z.string().uuid(),
  nickname: z.string().optional(),
  phoneNumber: z.string().min(8),
  type: z.enum(["TITULAR", "DEPENDENTE"]).default("TITULAR"),
  document: z.string().optional(),
  notes: z.string().optional(),
});

const lineUpdateSchema = lineSchema.partial().extend({
  clientId: z.string().uuid().optional(),
});

export const GET = createApiHandler(async (req) => {
  const supabase = createServerClient();
  const { searchParams } = new URL(req.url);
  const clientId = searchParams.get("clientId") || undefined;

  let query = supabase.from("lines").select("*").order("created_at", { ascending: false });
  if (clientId) {
    query = query.eq("client_id", clientId);
  }

  const { data, error } = await query;

  if (error) {
    throw error;
  }

  return NextResponse.json((data ?? []).map(mapLineRow));
});

export const POST = createApiHandler(async (req) => {
  const supabase = createServerClient();
  const body = await req.json();
  const payload = lineSchema.parse(body);
  const insertPayload = lineInsertPayload(payload);
  const { data, error } = await supabase
    .from("lines")
    .insert(insertPayload)
    .select("*")
    .maybeSingle();

  if (error) {
    throw error;
  }

  return NextResponse.json(mapLineRow(data!), { status: 201 });
});





