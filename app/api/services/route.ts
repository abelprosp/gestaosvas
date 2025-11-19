import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createApiHandler } from "@/lib/utils/apiHandler";
import { createServerClient } from "@/lib/supabase/server";
import { HttpError } from "@/lib/utils/httpError";
import { mapServiceRow, serviceInsertPayload, serviceUpdatePayload } from "@/lib/utils/mappers";

function normalizePriceInput(input: string | number): number {
  if (typeof input === "number") {
    return input;
  }
  const sanitized = input.replace(/\s/g, "").replace(/\./g, "").replace(",", ".");
  const parsed = Number(sanitized);
  if (Number.isNaN(parsed)) {
    throw new Error("Valor inválido");
  }
  return parsed;
}

const priceSchema = z
  .union([z.string(), z.number()])
  .transform((value) => normalizePriceInput(value))
  .refine((value) => value >= 0, { message: "Valor não pode ser negativo" });

const serviceSchema = z.object({
  name: z.string().min(2, "Informe ao menos 2 caracteres"),
  description: z.string().max(2000).optional(),
  price: priceSchema,
  allowCustomPrice: z.boolean().optional().default(false),
});

const serviceUpdateSchema = serviceSchema
  .partial()
  .superRefine((value, ctx) => {
    if (value.name === undefined && value.description === undefined && value.price === undefined) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Nenhuma alteração fornecida" });
    }
  });

export const GET = createApiHandler(async (req) => {
  const supabase = createServerClient();
  const { data, error } = await supabase.from("services").select("*").order("name", { ascending: true });
  if (error) {
    throw error;
  }
  return NextResponse.json((data ?? []).map(mapServiceRow));
});

export const POST = createApiHandler(
  async (req) => {
    const supabase = createServerClient();
    const body = await req.json();
    const payload = serviceSchema.parse(body);
    const insertPayload = serviceInsertPayload(payload);
    const { data, error } = await supabase.from("services").insert(insertPayload).select("*").maybeSingle();

    if (error) {
      throw error;
    }

    if (!data) {
      throw new HttpError(500, "Falha ao criar serviço");
    }

    return NextResponse.json(mapServiceRow(data), { status: 201 });
  },
  { requireAdmin: true }
);





