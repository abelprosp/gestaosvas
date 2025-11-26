import { NextRequest, NextResponse } from "next/server";
import { createApiHandler } from "@/lib/utils/apiHandler";
import { createServerClient } from "@/lib/supabase/server";
import { HttpError } from "@/lib/utils/httpError";
import { PostgrestError } from "@supabase/supabase-js";

const SCHEMA_ERROR_CODES = new Set(["PGRST200", "PGRST201", "PGRST202", "PGRST203", "PGRST204", "PGRST205"]);

function isSchemaMissing(error: unknown): error is PostgrestError {
  return Boolean((error as PostgrestError)?.code && SCHEMA_ERROR_CODES.has((error as PostgrestError).code));
}

export const POST = createApiHandler(
  async (req) => {
    const supabase = createServerClient();
    const firstEmail = "1a8@nexusrs.com.br";

    // Buscar ou criar o email 1a8
    let { data: account, error: accountError } = await supabase
      .from("tv_accounts")
      .select("id")
      .eq("email", firstEmail)
      .maybeSingle();

    if (accountError && !isSchemaMissing(accountError)) {
      throw accountError;
    }

    let accountId: string;

    if (!account) {
      // Criar o email 1a8
      const { data: newAccount, error: createError } = await supabase
        .from("tv_accounts")
        .insert({ email: firstEmail })
        .select("id")
        .single();

      if (createError) {
        throw createError;
      }

      accountId = newAccount.id;
    } else {
      accountId = account.id;
    }

    // Deletar todos os slots que não pertencem ao 1a8
    const { error: deleteSlotsError } = await supabase
      .from("tv_slots")
      .delete()
      .neq("tv_account_id", accountId);

    if (deleteSlotsError && !isSchemaMissing(deleteSlotsError)) {
      throw deleteSlotsError;
    }

    // Deletar todos os emails que não são o 1a8
    const { error: deleteAccountsError } = await supabase
      .from("tv_accounts")
      .delete()
      .neq("email", firstEmail);

    if (deleteAccountsError && !isSchemaMissing(deleteAccountsError)) {
      throw deleteAccountsError;
    }

    // Garantir que o 1a8 tenha exatamente 8 slots disponíveis
    // Primeiro, deletar slots extras se houver mais de 8
    const { error: deleteExtraError } = await supabase
      .from("tv_slots")
      .delete()
      .eq("tv_account_id", accountId)
      .gt("slot_number", 8);

    if (deleteExtraError && !isSchemaMissing(deleteExtraError)) {
      throw deleteExtraError;
    }

    // Verificar quantos slots existem
    const { data: existingSlots, error: countError } = await supabase
      .from("tv_slots")
      .select("slot_number")
      .eq("tv_account_id", accountId);

    if (countError && !isSchemaMissing(countError)) {
      throw countError;
    }

    const existingSlotNumbers = new Set((existingSlots ?? []).map((s: any) => s.slot_number));

    // Criar slots faltantes (1 a 8)
    const slotsToInsert = [];
    for (let i = 1; i <= 8; i++) {
      if (!existingSlotNumbers.has(i)) {
        slotsToInsert.push({
          tv_account_id: accountId,
          slot_number: i,
          username: `#${i}`,
          status: "AVAILABLE",
          password: Math.floor(1000 + Math.random() * 9000).toString(), // 4 dígitos
        });
      }
    }

    if (slotsToInsert.length > 0) {
      const { error: insertError } = await supabase
        .from("tv_slots")
        .insert(slotsToInsert);

      if (insertError && !isSchemaMissing(insertError)) {
        throw insertError;
      }
    }

    // Resetar todos os slots do 1a8 para AVAILABLE
    const { error: resetError } = await supabase
      .from("tv_slots")
      .update({
        status: "AVAILABLE",
        client_id: null,
        sold_by: null,
        sold_at: null,
        expires_at: null,
        notes: null,
        plan_type: null,
        has_telephony: null,
      })
      .eq("tv_account_id", accountId);

    if (resetError && !isSchemaMissing(resetError)) {
      throw resetError;
    }

    return NextResponse.json({
      message: "Sistema resetado com sucesso. Todos os emails foram removidos exceto 1a8@nexusrs.com.br",
      nextEmail: firstEmail,
      availableSlots: 8,
    });
  },
  { requireAdmin: true }
);

