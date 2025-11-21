import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createApiHandler } from "@/lib/utils/apiHandler";
import { createServerClient } from "@/lib/supabase/server";
import { HttpError } from "@/lib/utils/httpError";
import { PostgrestError } from "@supabase/supabase-js";
import { mapTVSlotRow } from "@/lib/utils/mappers";
import { generateNumericPassword } from "@/lib/utils/password";

const SCHEMA_ERROR_CODES = new Set(["PGRST200", "PGRST201", "PGRST202", "PGRST203", "PGRST204", "PGRST205"]);

function isSchemaMissing(error: unknown): error is PostgrestError {
  return Boolean((error as PostgrestError)?.code && SCHEMA_ERROR_CODES.has((error as PostgrestError).code));
}

function ensureTablesAvailable(error: PostgrestError) {
  if (isSchemaMissing(error)) {
    throw new HttpError(
      503,
      "Funcionalidade de TV indisponível. Execute o script supabase/schema.sql e atualize o cache do Supabase.",
    );
  }
}

const PLAN_TYPE_ENUM = z.enum(["ESSENCIAL", "PREMIUM"]);

const updateSchema = z
  .object({
    soldBy: z.string().optional(),
    soldAt: z.string().optional(),
    startsAt: z.string().optional().nullable(),
    expiresAt: z.string().optional().nullable(),
    status: z.enum(["AVAILABLE", "ASSIGNED", "INACTIVE", "SUSPENDED"]).optional(),
    notes: z.string().optional().nullable(),
    planType: PLAN_TYPE_ENUM.optional().nullable(),
    hasTelephony: z.boolean().optional().nullable(),
    password: z
      .string()
      .regex(/^\d{4}$/, { message: "A senha deve conter exatamente 4 dígitos." })
      .optional(),
  })
  .refine((value) => Object.keys(value).length > 0, { message: "Nenhuma alteração fornecida" });

export const PATCH = createApiHandler(async (req, { params, user }) => {
  const supabase = createServerClient();
  const slotId = params.id;
  const body = await req.json();
  const payload = updateSchema.parse(body);
  const isAdmin = user.role === "admin";

  if (!isAdmin) {
    const forbiddenKeys = Object.keys(payload).filter(
      (key) => !["notes"].includes(key) && (payload as Record<string, unknown>)[key] !== undefined,
    );
    if (forbiddenKeys.length > 0) {
      throw new HttpError(403, "Apenas administradores podem alterar esses campos.");
    }
  }

  const updateData: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (payload.soldBy !== undefined) updateData.sold_by = payload.soldBy;
  if (payload.soldAt !== undefined) updateData.sold_at = payload.soldAt;
  if (payload.expiresAt !== undefined) updateData.expires_at = payload.expiresAt;
  if (payload.startsAt !== undefined) {
    updateData.starts_at = payload.startsAt && payload.startsAt.trim().length ? payload.startsAt : null;
  }
  if (payload.planType !== undefined) {
    updateData.plan_type = payload.planType ?? null;
  }
  if (payload.hasTelephony !== undefined) {
    updateData.has_telephony = payload.hasTelephony ?? null;
  }
  let shouldRandomize = false;
  if (payload.status !== undefined) {
    updateData.status = payload.status;
    if (payload.status !== "ASSIGNED") {
      shouldRandomize = true;
    }
  }
  if (payload.notes !== undefined) updateData.notes = payload.notes;
  if (payload.password !== undefined) {
    updateData.password = payload.password;
    shouldRandomize = false;
  } else if (shouldRandomize) {
    updateData.password = generateNumericPassword();
  }

  const { data, error } = await supabase
    .from("tv_slots")
    .update(updateData)
    .eq("id", slotId)
    .select("*, tv_accounts(*)")
    .maybeSingle();

  if (error) {
    ensureTablesAvailable(error as PostgrestError);
    throw error;
  }

  if (!data) {
    throw new HttpError(404, "Slot não encontrado");
  }

  const { error: historyError } = await supabase.from("tv_slot_history").insert({
    tv_slot_id: slotId,
    action: "UPDATED",
    metadata: updateData,
  });

  if (historyError && !isSchemaMissing(historyError)) {
    throw historyError;
  }

  return NextResponse.json(mapTVSlotRow(data));
});





