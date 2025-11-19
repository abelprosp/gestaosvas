import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createApiHandler } from "@/lib/utils/apiHandler";
import { createServerClient } from "@/lib/supabase/server";
import { HttpError } from "@/lib/utils/httpError";

const updateSchema = z
  .object({
    expiresAt: z.string().min(8).optional(),
    isTest: z.boolean().optional(),
    notes: z.string().optional(),
  })
  .refine((value) => Object.keys(value).length > 0, { message: "Nenhuma alteração fornecida." });

function mapCloudRow(row: any) {
  return {
    id: row.id,
    clientId: row.client_id,
    serviceId: row.service_id,
    expiresAt: row.expires_at,
    isTest: row.is_test,
    notes: row.notes,
    client: row.client ?? null,
    service: row.service ?? null,
  };
}

export const PATCH = createApiHandler(async (req, { params }) => {
  const supabase = createServerClient();
  const body = await req.json();
  const payload = updateSchema.parse(body);
  const updatePayload = {
    ...(payload.expiresAt !== undefined ? { expires_at: payload.expiresAt } : {}),
    ...(payload.isTest !== undefined ? { is_test: payload.isTest } : {}),
    ...(payload.notes !== undefined ? { notes: payload.notes || null } : {}),
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await supabase
    .from("cloud_accesses")
    .update(updatePayload)
    .eq("id", params.id)
    .select(
      "id, client_id, service_id, expires_at, is_test, notes, client:clients(id, name, email, document), service:services(id, name)",
    )
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!data) {
    throw new HttpError(404, "Acesso não encontrado.");
  }

  return NextResponse.json(mapCloudRow(data));
});

export const DELETE = createApiHandler(
  async (req, { params }) => {
    const supabase = createServerClient();
    const { error } = await supabase.from("cloud_accesses").delete().eq("id", params.id);

    if (error) {
      throw error;
    }

    return new NextResponse(null, { status: 204 });
  },
  { requireAdmin: true }
);





