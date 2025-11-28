import { NextRequest, NextResponse } from "next/server";
import { createApiHandler } from "@/lib/utils/apiHandler";
import { createServerClient } from "@/lib/supabase/server";
import { PostgrestError } from "@supabase/supabase-js";

const SCHEMA_ERROR_CODES = new Set(["PGRST200", "PGRST201", "PGRST202", "PGRST203", "PGRST204", "PGRST205"]);

function isSchemaMissing(error: unknown): error is PostgrestError {
  return Boolean((error as PostgrestError)?.code && SCHEMA_ERROR_CODES.has((error as PostgrestError).code));
}

export const GET = createApiHandler(async (req) => {
  const supabase = createServerClient();
  
  try {
    // Buscar todas as contas de TV com informações de slots
    const { data: accounts, error: accountsError } = await supabase
      .from("tv_accounts")
      .select("id, email, max_slots, created_at")
      .order("email", { ascending: true });

    if (accountsError && !isSchemaMissing(accountsError)) {
      throw accountsError;
    }

    if (!accounts || accounts.length === 0) {
      return NextResponse.json([]);
    }

    // Para cada conta, buscar informações dos slots
    const accountsWithInfo = await Promise.all(
      accounts.map(async (account) => {
        const { data: slots, error: slotsError } = await supabase
          .from("tv_slots")
          .select("id, status, client_id")
          .eq("tv_account_id", account.id);

        if (slotsError && !isSchemaMissing(slotsError)) {
          throw slotsError;
        }

        const totalSlots = slots?.length ?? 0;
        const availableSlots = slots?.filter((s) => s.status === "AVAILABLE" && !s.client_id).length ?? 0;
        const assignedSlots = slots?.filter((s) => s.status === "ASSIGNED" && s.client_id).length ?? 0;

        return {
          id: account.id,
          email: account.email,
          totalSlots,
          availableSlots,
          assignedSlots,
          createdAt: account.created_at,
        };
      })
    );

    // Ordenar: primeiro emails padrão (1a8, 2a9, etc), depois emails personalizados
    accountsWithInfo.sort((a, b) => {
      const aIsStandard = /^\d+a\d+@nexusrs\.com\.br$/.test(a.email);
      const bIsStandard = /^\d+a\d+@nexusrs\.com\.br$/.test(b.email);
      
      if (aIsStandard && !bIsStandard) return -1;
      if (!aIsStandard && bIsStandard) return 1;
      
      return a.email.localeCompare(b.email, "pt-BR", { sensitivity: "base" });
    });

    return NextResponse.json(accountsWithInfo);
  } catch (error) {
    if (isSchemaMissing(error as PostgrestError)) {
      return NextResponse.json([]);
    }
    throw error;
  }
});

