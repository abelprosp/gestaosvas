import { NextResponse } from "next/server";
import { createApiHandler } from "@/lib/utils/apiHandler";
import { createServerClient } from "@/lib/supabase/server";
import { z } from "zod";
import { HttpError } from "@/lib/utils/httpError";

const migrateSchema = z.object({
  fromAccountId: z.string().uuid("ID da conta de origem inválido"),
  toAccountId: z.string().uuid("ID da conta de destino inválido"),
});

export const POST = createApiHandler(
  async (req) => {
    const body = await req.json();
    const { fromAccountId, toAccountId } = migrateSchema.parse(body);

    if (fromAccountId === toAccountId) {
      throw new HttpError(400, "Não é possível migrar para a mesma conta");
    }

    const supabase = createServerClient();

    // Buscar informações das contas
    const { data: fromAccount, error: fromError } = await supabase
      .from("tv_accounts")
      .select("id, email, max_slots")
      .eq("id", fromAccountId)
      .single();

    if (fromError) {
      throw fromError;
    }

    if (!fromAccount) {
      throw new HttpError(404, "Conta de origem não encontrada");
    }

    const { data: toAccount, error: toError } = await supabase
      .from("tv_accounts")
      .select("id, email, max_slots")
      .eq("id", toAccountId)
      .single();

    if (toError) {
      throw toError;
    }

    if (!toAccount) {
      throw new HttpError(404, "Conta de destino não encontrada");
    }

    // Buscar slots atribuídos na conta de origem
    const { data: assignedSlots, error: slotsError } = await supabase
      .from("tv_slots")
      .select("id, slot_number, username, password, client_id, sold_by, sold_at, starts_at, expires_at, notes, plan_type, has_telephony, status")
      .eq("tv_account_id", fromAccountId)
      .not("client_id", "is", null)
      .eq("status", "ASSIGNED");

    if (slotsError) {
      throw slotsError;
    }

    const slotsToMigrate = assignedSlots ?? [];
    const slotsCount = slotsToMigrate.length;

    if (slotsCount === 0) {
      throw new HttpError(400, `A conta ${fromAccount.email} não possui slots atribuídos para migrar`);
    }

    // Buscar slots disponíveis na conta de destino
    const { data: availableSlots, error: availableError } = await supabase
      .from("tv_slots")
      .select("id, slot_number")
      .eq("tv_account_id", toAccountId)
      .is("client_id", null)
      .eq("status", "AVAILABLE")
      .order("slot_number", { ascending: true });

    if (availableError) {
      throw availableError;
    }

    const availableCount = availableSlots?.length ?? 0;

    if (availableCount < slotsCount) {
      throw new HttpError(
        400,
        `A conta ${toAccount.email} possui apenas ${availableCount} slot(s) disponível(is), mas são necessários ${slotsCount} slot(s) para migrar os acessos de ${fromAccount.email}`
      );
    }

    // Verificar se a conta de destino tem capacidade suficiente (max_slots)
    const { data: allToSlots, error: allToError } = await supabase
      .from("tv_slots")
      .select("id")
      .eq("tv_account_id", toAccountId);

    if (allToError) {
      throw allToError;
    }

    const totalToSlots = allToSlots?.length ?? 0;
    const assignedToSlots = totalToSlots - availableCount;

    if (assignedToSlots + slotsCount > toAccount.max_slots) {
      throw new HttpError(
        400,
        `A conta ${toAccount.email} não possui capacidade suficiente. Após a migração, teria ${assignedToSlots + slotsCount} slot(s) atribuído(s), mas o máximo permitido é ${toAccount.max_slots}`
      );
    }

    // Selecionar os primeiros N slots disponíveis para migração
    const slotsToUse = availableSlots?.slice(0, slotsCount) ?? [];

    // Migrar os slots: atualizar cada slot de destino com os dados do slot de origem
    const migrations = slotsToMigrate.map((fromSlot, index) => {
      const toSlot = slotsToUse[index];
      return {
        slotId: toSlot.id,
        data: {
          client_id: fromSlot.client_id,
          sold_by: fromSlot.sold_by,
          sold_at: fromSlot.sold_at,
          starts_at: fromSlot.starts_at,
          expires_at: fromSlot.expires_at,
          notes: fromSlot.notes,
          plan_type: fromSlot.plan_type,
          has_telephony: fromSlot.has_telephony,
          username: fromSlot.username,
          password: fromSlot.password,
          status: "ASSIGNED" as const,
        },
      };
    });

    // Executar as migrações em uma transação
    for (const migration of migrations) {
      const { error: updateError } = await supabase
        .from("tv_slots")
        .update(migration.data)
        .eq("id", migration.slotId);

      if (updateError) {
        throw updateError;
      }
    }

    // Liberar os slots da conta de origem
    const fromSlotIds = slotsToMigrate.map(s => s.id);
    const { error: releaseError } = await supabase
      .from("tv_slots")
      .update({
        client_id: null,
        sold_by: null,
        sold_at: null,
        starts_at: new Date().toISOString().slice(0, 10),
        expires_at: null,
        notes: null,
        plan_type: null,
        has_telephony: null,
        status: "AVAILABLE",
      })
      .in("id", fromSlotIds);

    if (releaseError) {
      throw releaseError;
    }

    return NextResponse.json({
      message: `Migração concluída com sucesso`,
      migrated: {
        from: {
          email: fromAccount.email,
          slotsCount: slotsCount,
        },
        to: {
          email: toAccount.email,
          slotsCount: slotsCount,
        },
      },
    });
  },
  { requireAdmin: true }
);

