import { NextRequest, NextResponse } from "next/server";
import { createApiHandler } from "@/lib/utils/apiHandler";
import { createServerClient } from "@/lib/supabase/server";
import { PostgrestError } from "@supabase/supabase-js";
import { mapTVSlotRow } from "@/lib/utils/mappers";

const SCHEMA_ERROR_CODES = new Set(["PGRST200", "PGRST201", "PGRST202", "PGRST203", "PGRST204", "PGRST205"]);

function isSchemaMissing(error: unknown): error is PostgrestError {
  return Boolean((error as PostgrestError)?.code && SCHEMA_ERROR_CODES.has((error as PostgrestError).code));
}

export const GET = createApiHandler(async (req) => {
  const supabase = createServerClient();
  const { searchParams } = new URL(req.url);
  const searchRaw = searchParams.get("search")?.trim() || "";
  const page = Number(searchParams.get("page") ?? "1");
  const limit = Number(searchParams.get("limit") ?? "50");
  const safePage = Number.isFinite(page) && page > 0 ? Math.floor(page) : 1;
  const safeLimit = Number.isFinite(limit) && limit > 0 ? Math.floor(limit) : 50;
  const offset = (safePage - 1) * safeLimit;

  let query = supabase
    .from("tv_slots")
    .select("*, client_id, tv_accounts(*), client:clients(name, id, email, phone, document)", { count: "exact" })
    .eq("status", "ASSIGNED")
    .not("client_id", "is", null)
    .order("email", { ascending: true, foreignTable: "tv_accounts" })
    .order("slot_number", { ascending: true });

  if (searchRaw) {
    const ilike = `%${searchRaw}%`;

    query = query.or(
      [
        `username.ilike.${ilike}`,
        `sold_by.ilike.${ilike}`,
        `notes.ilike.${ilike}`,
        `plan_type.ilike.${ilike}`,
        `status.ilike.${ilike}`,
        `slot_number::text.ilike.${ilike}`,
      ].join(","),
    );

    query = query.or([`email.ilike.${ilike}`].join(","), { foreignTable: "tv_accounts" });

    const { data: clientIdsData, error: clientIdsError } = await supabase
      .from("clients")
      .select("id")
      .or(
        [`name.ilike.${ilike}`, `email.ilike.${ilike}`, `phone.ilike.${ilike}`, `document.ilike.${ilike}`].join(","),
      )
      .limit(500);

    if (clientIdsError) {
      throw clientIdsError;
    }

    const matchingClientIds = (clientIdsData ?? []).map((item: { id: string }) => item.id);
    if (matchingClientIds.length > 0) {
      query = query.or(
        matchingClientIds.map((id, index) => `client_id.eq.${id}${index === matchingClientIds.length - 1 ? "" : ""}`).join(","),
      );
    }
  }

  query = query.range(offset, offset + safeLimit - 1);

  let { data, error, count } = await query;

  if (error) {
    if (isSchemaMissing(error)) {
      return NextResponse.json({ data: [], page: safePage, limit: safeLimit, total: 0, totalPages: 1 });
    }
    throw error;
  }

  // Filtrar apenas slots atribuídos a clientes
  data = (data ?? []).filter((slot) => {
    return slot.status === "ASSIGNED" && slot.client_id !== null;
  });

  const formatted = (data ?? []).map((row) => {
    const mapped = mapTVSlotRow(row);
    
    return {
      id: mapped.id,
      slotNumber: mapped.slotNumber,
      username: mapped.username,
      email: mapped.account?.email ?? "",
      status: mapped.status,
      password: mapped.password,
      soldBy: mapped.soldBy,
      soldAt: mapped.soldAt,
      startsAt: mapped.startsAt,
      expiresAt: mapped.expiresAt,
      notes: mapped.notes,
      planType: mapped.planType ?? null,
      hasTelephony: mapped.hasTelephony ?? null,
      client: row.client ?? null,
      clientId: mapped.clientId ?? null,
      profileLabel: null as string | null,
      document: row.client?.document ?? null,
    };
  });

  const grouped = new Map<string, typeof formatted>();
  formatted.forEach((record) => {
    const key = record.clientId ?? record.client?.id ?? null;
    if (!key) {
      return;
    }
    const list = grouped.get(key) ?? [];
    list.push(record);
    grouped.set(key, list);
  });

  grouped.forEach((list) => {
    list.sort((a, b) => {
      const emailCompare = a.email.localeCompare(b.email, "pt-BR", { sensitivity: "base" });
      if (emailCompare !== 0) {
        return emailCompare;
      }
      return a.slotNumber - b.slotNumber;
    });
    list.forEach((item, index) => {
      item.profileLabel = `Perfil ${index + 1}`;
    });
  });

  const total = count ?? formatted.length;
  const totalPages = Math.max(1, Math.ceil(total / safeLimit));

  return NextResponse.json({
    data: formatted,
    page: safePage,
    limit: safeLimit,
    total,
    totalPages,
  });
});





