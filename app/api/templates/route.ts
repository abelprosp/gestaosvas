import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createApiHandler } from "@/lib/utils/apiHandler";
import { createServerClient } from "@/lib/supabase/server";
import { HttpError } from "@/lib/utils/httpError";
import { mapTemplateRow, templateInsertPayload, templateUpdatePayload } from "@/lib/utils/mappers";

const templateSchema = z.object({
  name: z.string().min(3),
  content: z.string().min(10),
  active: z.boolean().optional(),
});

const templateUpdateSchema = templateSchema.partial();

export const GET = createApiHandler(async (req) => {
  const supabase = createServerClient();
  const { data, error } = await supabase
    .from("contract_templates")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    throw error;
  }

  return NextResponse.json((data ?? []).map(mapTemplateRow));
});

export const POST = createApiHandler(async (req) => {
  const supabase = createServerClient();
  const body = await req.json();
  const payload = templateSchema.parse(body);
  const insertPayload = templateInsertPayload(payload);
  const { data, error } = await supabase
    .from("contract_templates")
    .insert(insertPayload)
    .select("*")
    .maybeSingle();

  if (error) {
    throw error;
  }

  return NextResponse.json(mapTemplateRow(data!), { status: 201 });
});





