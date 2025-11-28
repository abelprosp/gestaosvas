import { NextRequest, NextResponse } from "next/server";
import { createApiHandler } from "@/lib/utils/apiHandler";
import { createServerClient } from "@/lib/supabase/server";
import { mapTVAccountRow } from "@/lib/utils/mappers";
import { z } from "zod";
import { HttpError } from "@/lib/utils/httpError";
import { PostgrestError } from "@supabase/supabase-js";
import { validateRouteParamUUID } from "@/lib/utils/validation";

function isUniqueViolation(error: PostgrestError) {
  return error.code === "23505";
}

const updateAccountSchema = z.object({
  email: z.string().trim().min(1, "Email não pode estar vazio").email("Email inválido").optional(),
  maxSlots: z.number().int().min(1).max(8).optional(),
});

export const PATCH = createApiHandler(
  async (req, { params }) => {
    // Validar UUID do parâmetro
    const accountId = validateRouteParamUUID(params.id, "id");
    const body = await req.json();
    const { email, maxSlots } = updateAccountSchema.parse(body);

    const supabase = createServerClient();

    const updateData: Record<string, unknown> = {};

    // Se email foi fornecido, verificar se já existe em outra conta
    if (email !== undefined) {
      const { data: existing, error: checkError } = await supabase
        .from("tv_accounts")
        .select("id")
        .eq("email", email.toLowerCase().trim())
        .neq("id", accountId)
        .maybeSingle();

      if (checkError) {
        throw checkError;
      }

      if (existing) {
        throw new HttpError(
          409,
          "Este e-mail já está cadastrado em outra conta de TV. Cada e-mail deve ser único no sistema."
        );
      }

      updateData.email = email.toLowerCase().trim();
    }

    // Se maxSlots foi fornecido, atualizar
    if (maxSlots !== undefined) {
      // Verificar quantos slots estão atribuídos
      const { data: assignedSlots, error: slotsError } = await supabase
        .from("tv_slots")
        .select("id")
        .eq("tv_account_id", accountId)
        .not("client_id", "is", null);

      if (slotsError) {
        throw slotsError;
      }

      const assignedCount = assignedSlots?.length ?? 0;

      if (maxSlots < assignedCount) {
        throw new HttpError(
          400,
          `Não é possível reduzir para ${maxSlots} slots. Esta conta possui ${assignedCount} slot(s) atribuído(s) a cliente(s).`
        );
      }

      updateData.max_slots = maxSlots;

      // Se maxSlots foi reduzido, remover slots extras que não estão atribuídos
      const { data: allSlots, error: allSlotsError } = await supabase
        .from("tv_slots")
        .select("id, slot_number, client_id")
        .eq("tv_account_id", accountId)
        .order("slot_number", { ascending: true });

      if (allSlotsError) {
        throw allSlotsError;
      }

      if (allSlots && allSlots.length > maxSlots) {
        // Encontrar slots que podem ser removidos (não atribuídos e acima do maxSlots)
        const slotsToRemove = allSlots
          .filter(slot => slot.slot_number > maxSlots && !slot.client_id)
          .map(slot => slot.id);

        if (slotsToRemove.length > 0) {
          const { error: deleteError } = await supabase
            .from("tv_slots")
            .delete()
            .in("id", slotsToRemove);

          if (deleteError) {
            throw deleteError;
          }
        }

        // Se ainda há slots acima do maxSlots que estão atribuídos, apenas renumerar os disponíveis
        // (não podemos remover slots atribuídos)
        const availableSlotsAboveMax = allSlots
          .filter(slot => slot.slot_number > maxSlots && !slot.client_id);

        if (availableSlotsAboveMax.length > 0) {
          // Remover os disponíveis acima do max
          const idsToRemove = availableSlotsAboveMax.map(s => s.id);
          const { error: removeError } = await supabase
            .from("tv_slots")
            .delete()
            .in("id", idsToRemove);

          if (removeError) {
            throw removeError;
          }
        }
      }

      // Se maxSlots foi aumentado, criar novos slots
      if (allSlots && allSlots.length < maxSlots) {
        const currentMaxSlot = allSlots.length > 0 
          ? Math.max(...allSlots.map(s => s.slot_number))
          : 0;

        const slotsToCreate = [];
        for (let i = currentMaxSlot + 1; i <= maxSlots; i++) {
          slotsToCreate.push({
            tv_account_id: accountId,
            slot_number: i,
            username: `#${i}`,
            status: "AVAILABLE",
            password: require("@/lib/utils/password").generateNumericPassword(),
          });
        }

        if (slotsToCreate.length > 0) {
          const { error: createError } = await supabase
            .from("tv_slots")
            .insert(slotsToCreate);

          if (createError) {
            throw createError;
          }
        }
      }
    }

    if (Object.keys(updateData).length === 0) {
      throw new HttpError(400, "Nenhuma alteração fornecida");
    }

    // Atualizar a conta
    const { data: account, error: updateError } = await supabase
      .from("tv_accounts")
      .update(updateData)
      .eq("id", accountId)
      .select("id, email, max_slots, created_at")
      .single();

    if (updateError) {
      // Se for erro de constraint única (pode acontecer em race conditions)
      if (isUniqueViolation(updateError as PostgrestError)) {
        throw new HttpError(
          409,
          "Este e-mail já está cadastrado em outra conta de TV. Cada e-mail deve ser único no sistema."
        );
      }
      throw updateError;
    }

    if (!account) {
      throw new HttpError(404, "Conta não encontrada");
    }

    return NextResponse.json(mapTVAccountRow(account));
  },
  { requireAdmin: true }
);

export const DELETE = createApiHandler(
  async (req, { params }) => {
    // Validar UUID do parâmetro
    const accountId = validateRouteParamUUID(params.id, "id");
    const supabase = createServerClient();

    // Verificar se a conta existe
    const { data: account, error: fetchError } = await supabase
      .from("tv_accounts")
      .select("id, email")
      .eq("id", accountId)
      .maybeSingle();

    if (fetchError) {
      throw fetchError;
    }

    if (!account) {
      throw new HttpError(404, "Conta não encontrada");
    }

    // Verificar se há slots atribuídos a clientes (apenas para informar)
    const { data: assignedSlots, error: slotsError } = await supabase
      .from("tv_slots")
      .select("id, client_id")
      .eq("tv_account_id", accountId)
      .not("client_id", "is", null);

    if (slotsError) {
      throw slotsError;
    }

    const assignedCount = assignedSlots?.length ?? 0;

    // Deletar a conta (os slots serão deletados automaticamente por cascade)
    const { error: deleteError } = await supabase
      .from("tv_accounts")
      .delete()
      .eq("id", accountId);

    if (deleteError) {
      throw deleteError;
    }

    return NextResponse.json({
      message: "Conta removida com sucesso",
      deletedAccount: {
        id: account.id,
        email: account.email,
      },
      slotsRemoved: assignedCount > 0 ? `${assignedCount} slot(s) atribuído(s) também foram removido(s)` : undefined,
    });
  },
  { requireAdmin: true }
);


