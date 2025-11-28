import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createApiHandler } from "@/lib/utils/apiHandler";
import { createServerClient } from "@/lib/supabase/server";
import { HttpError } from "@/lib/utils/httpError";
import { PostgrestError } from "@supabase/supabase-js";
import { mapTVSlotRow } from "@/lib/utils/mappers";
import { generateNumericPassword } from "@/lib/utils/password";
import { validateRouteParamUUID } from "@/lib/utils/validation";

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
    username: z.string().trim().min(1).max(100).optional().nullable(),
  })
  .refine((value) => Object.keys(value).length > 0, { message: "Nenhuma alteração fornecida" });

export const PATCH = createApiHandler(async (req, { params, user }) => {
  // Validar UUID do parâmetro
  const slotId = validateRouteParamUUID(params.id, "id");
  
  const supabase = createServerClient();
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
  if (payload.username !== undefined) {
    updateData.custom_username = payload.username && payload.username.trim().length > 0 
      ? payload.username.trim() 
      : null;
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

export const DELETE = createApiHandler(async (req, { params, user }) => {
  // Validar UUID do parâmetro
  const slotId = validateRouteParamUUID(params.id, "id");
  
  const supabase = createServerClient();
  const isAdmin = user.role === "admin";

  if (!isAdmin) {
    throw new HttpError(403, "Apenas administradores podem remover slots.");
  }

  // Verificar se o slot existe e obter informações
  const { data: slot, error: fetchError } = await supabase
    .from("tv_slots")
    .select("id, slot_number, status, client_id, tv_account_id, tv_accounts(email)")
    .eq("id", slotId)
    .maybeSingle();

  if (fetchError) {
    ensureTablesAvailable(fetchError as PostgrestError);
    throw fetchError;
  }

  if (!slot) {
    throw new HttpError(404, "Slot não encontrado");
  }

  // Se o slot está atribuído a um cliente, não permitir remoção direta
  // O usuário deve primeiro liberar o slot
  if (slot.status === "ASSIGNED" && slot.client_id) {
    throw new HttpError(400, "Não é possível remover um slot que está atribuído a um cliente. Libere o slot primeiro.");
  }

  // Deletar o slot
  const { error: deleteError } = await supabase
    .from("tv_slots")
    .delete()
    .eq("id", slotId);

  if (deleteError) {
    ensureTablesAvailable(deleteError as PostgrestError);
    throw deleteError;
  }

  // Registrar no histórico (se possível)
  try {
    await supabase.from("tv_slot_history").insert({
      tv_slot_id: slotId,
      action: "DELETED",
      metadata: {
        slot_number: slot.slot_number,
        email: (slot.tv_accounts as any)?.email,
      },
    });
  } catch (historyError) {
    // Ignorar erros de histórico
    console.warn("Erro ao registrar histórico de remoção:", historyError);
  }

  return NextResponse.json({
    message: "Slot removido com sucesso",
    deletedSlot: {
      id: slot.id,
      slotNumber: slot.slot_number,
      email: (slot.tv_accounts as any)?.email,
    },
  });
}, { requireAdmin: true });

