import { NextRequest, NextResponse } from "next/server";
import { createApiHandler } from "@/lib/utils/apiHandler";
import { createServerClient } from "@/lib/supabase/server";
import { PostgrestError } from "@supabase/supabase-js";
import { mapTVSlotRow, mapClientTVAssignment, mapTVSlotHistoryRow } from "@/lib/utils/mappers";
import { ClientTVAssignment } from "@/types";

const SCHEMA_ERROR_CODES = new Set(["PGRST200", "PGRST201", "PGRST202", "PGRST203", "PGRST204", "PGRST205"]);

function isSchemaMissing(error: unknown): error is PostgrestError {
  return Boolean((error as PostgrestError)?.code && SCHEMA_ERROR_CODES.has((error as PostgrestError).code));
}

function ensureTablesAvailable(error: PostgrestError) {
  if (isSchemaMissing(error)) {
    throw new Error(
      "Funcionalidade de TV indisponível. Execute o script supabase/schema.sql e atualize o cache do Supabase.",
    );
  }
}

export const GET = createApiHandler(async (req) => {
  const supabase = createServerClient();
  const { searchParams } = new URL(req.url);
  const availableOnly = searchParams.get("available") === "true";
  const clientId = searchParams.get("clientId") || undefined;
  const withHistory = searchParams.get("includeHistory") === "true";

  let query = supabase
    .from("tv_slots")
    .select("*, tv_accounts(*)")
    .order("email", { ascending: true, foreignTable: "tv_accounts" })
    .order("slot_number", { ascending: true });

  if (availableOnly) {
    query = query.eq("status", "AVAILABLE").is("client_id", null);
  }

  if (clientId) {
    query = query.eq("client_id", clientId);
  }

  const { data, error } = await query;

  if (error) {
    if (isSchemaMissing(error)) {
      return NextResponse.json([]);
    }
    throw error;
  }

  if (!withHistory) {
    return NextResponse.json((data ?? []).map((row) => mapTVSlotRow(row)));
  }

  const slotIds = (data ?? []).map((row) => row.id);

  const { data: historyData, error: historyError } = slotIds.length
    ? await supabase.from("tv_slot_history").select("*").in("tv_slot_id", slotIds).order("created_at", { ascending: false })
    : { data: [], error: null };

  if (historyError) {
    if (isSchemaMissing(historyError)) {
      return NextResponse.json((data ?? []).map((row) => mapTVSlotRow(row)));
    }
    throw historyError;
  }

  const historiesBySlot = new Map<string, typeof historyData>();
  (historyData ?? []).forEach((history) => {
    const list = historiesBySlot.get(history.tv_slot_id) ?? [];
    list.push(history);
    historiesBySlot.set(history.tv_slot_id, list);
  });

  const result = (data ?? []).map((row) => mapClientTVAssignment(row, historiesBySlot.get(row.id) ?? []));

  const assignmentsByClient = new Map<string, ClientTVAssignment[]>();
  result.forEach((assignment) => {
    const clientKey = assignment.clientId ?? ((assignment as any)?.client?.id ?? null);
    if (!clientKey) {
      return;
    }
    const list = assignmentsByClient.get(clientKey) ?? [];
    list.push(assignment);
    assignmentsByClient.set(clientKey, list);
  });

  assignmentsByClient.forEach((list) => {
    list.sort((a, b) => {
      const emailCompare = a.email.localeCompare(b.email, "pt-BR", { sensitivity: "base" });
      if (emailCompare !== 0) {
        return emailCompare;
      }
      return a.slotNumber - b.slotNumber;
    });

    list.forEach((item, index) => {
      item.profileLabel = `Perfil ${index + 1}`;
      item.history.sort((a, b) => (a.createdAt > b.createdAt ? -1 : 1));
    });
  });

  return NextResponse.json(result);
});





