import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createApiHandler } from "@/lib/utils/apiHandler";
import { createServerClient } from "@/lib/supabase/server";
import { HttpError } from "@/lib/utils/httpError";
import { PostgrestError } from "@supabase/supabase-js";
import { mapClientRow, clientInsertPayload, clientUpdatePayload } from "@/lib/utils/mappers";
import { assignMultipleSlotsToClient, assignSlotToClient, releaseSlotsForClient } from "@/lib/services/tvAssignments";
import { TVPlanType } from "@/types";

type ServiceSelection = {
  serviceId: string;
  customPrice?: number | null;
};

const costCenterSchema = z.enum(["LUXUS", "NEXUS"]);

const clientSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  phone: z.string().optional(),
  document: z.string().min(5),
  costCenter: costCenterSchema,
  companyName: z.string().optional(),
  notes: z.string().optional(),
  address: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
});

const serviceSelectionSchema = z.object({
  serviceId: z.string().uuid(),
  customPrice: z.number().min(0).nullable().optional(),
});

const tvPlanTypeSchema = z.enum(["ESSENCIAL", "PREMIUM"]);

const tvSetupSchema = z
  .object({
    quantity: z.number().int().min(1).max(50).optional(),
    planType: tvPlanTypeSchema.optional(),
    soldBy: z.string().min(1, "Responsável é obrigatório."),
    soldAt: z.string().optional(),
    startsAt: z.string().optional(),
    expiresAt: z.string().min(1, "Informe uma data de vencimento."),
    notes: z.string().optional(),
  })
  .optional();

const cloudSetupSchema = z.object({
  serviceId: z.string().uuid(),
  expiresAt: z.string().min(8, "Informe a data de vencimento."),
  isTest: z.boolean().optional(),
  notes: z.string().optional(),
});

const clientCreateSchema = clientSchema.extend({
  serviceIds: z.array(z.string().uuid()).optional(),
  serviceSelections: z.array(serviceSelectionSchema).optional(),
  tvSetup: tvSetupSchema,
  cloudSetups: z.array(cloudSetupSchema).optional(),
});

const SCHEMA_MISSING_CODES = new Set(["PGRST200", "PGRST201", "PGRST202", "PGRST203", "PGRST204", "PGRST205"]);

function isSchemaMissing(error: unknown): error is PostgrestError {
  return Boolean((error as PostgrestError)?.code && SCHEMA_MISSING_CODES.has((error as PostgrestError).code));
}

function sanitizeDocument(document: string): string {
  const digits = document.replace(/\D/g, "");
  if (digits.length === 11 || digits.length === 14) {
    return digits;
  }
  throw new HttpError(400, "Informe um CPF ou CNPJ válido.");
}

function documentLengthPattern(length: number) {
  return "_".repeat(length);
}

function isUniqueViolation(error: PostgrestError) {
  return error.code === "23505";
}

async function syncClientServices(clientId: string, selections: ServiceSelection[]) {
  const supabase = createServerClient();
  const uniqueSelections = new Map<string, ServiceSelection>();
  selections.forEach((selection) => {
    if (selection?.serviceId) {
      uniqueSelections.set(selection.serviceId, selection);
    }
  });

  const { error: deleteError } = await supabase.from("client_services").delete().eq("client_id", clientId);
  if (deleteError) {
    if (isSchemaMissing(deleteError)) {
      console.warn(
        "[syncClientServices] Tabela client_services indisponível. Execute as migrações do Supabase para habilitar a gestão de serviços.",
      );
      return;
    }
    throw deleteError;
  }

  if (!uniqueSelections.size) {
    return;
  }

  const rows = Array.from(uniqueSelections.values()).map((selection) => ({
    client_id: clientId,
    service_id: selection.serviceId,
    custom_price: selection.customPrice ?? null,
  }));

  const { error: insertError } = await supabase.from("client_services").insert(rows);

  if (insertError) {
    if (isSchemaMissing(insertError)) {
      console.warn(
        "[syncClientServices] Tabela client_services indisponível. Execute as migrações do Supabase para habilitar a gestão de serviços.",
      );
      return;
    }
    throw insertError;
  }
}

async function fetchTvAssignmentsForClients(
  clientIds: string[],
  options: { includeHistory?: boolean } = {},
) {
  const supabase = createServerClient();
  const assignments = new Map<string, any[]>();

  if (!clientIds.length) {
    return assignments;
  }

  const selectColumns = options.includeHistory ? "*, tv_accounts(*), tv_slot_history(*)" : "*, tv_accounts(*)";

  const { data, error } = await supabase
    .from("tv_slots")
    .select(selectColumns)
    .in("client_id", clientIds)
    .order("email", { ascending: true, foreignTable: "tv_accounts" })
    .order("slot_number", { ascending: true });

  if (error) {
    if (isSchemaMissing(error)) {
      return assignments;
    }
    throw error;
  }

  const rows = (data ?? []) as any[];

  const { mapClientTVAssignment } = await import("@/lib/utils/mappers");
  rows.forEach((row: any) => {
    if (!row.client_id) {
      return;
    }
    const history = options.includeHistory && Array.isArray(row.tv_slot_history) ? row.tv_slot_history : [];
    const assignment = mapClientTVAssignment(row, history);
    const current = assignments.get(row.client_id) ?? [];
    current.push(assignment);
    assignments.set(row.client_id, current);
  });

  assignments.forEach((list) => {
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

  return assignments;
}

async function fetchServicesByIds(serviceIds: string[]) {
  const supabase = createServerClient();
  if (!serviceIds.length) {
    return [];
  }

  const uniqueIds = Array.from(new Set(serviceIds));

  const { data, error } = await supabase.from("services").select("id, name").in("id", uniqueIds);

  if (error) {
    if (isSchemaMissing(error)) {
      console.warn(
        "[fetchServicesByIds] Tabela services indisponível. Execute as migrações do Supabase para habilitar a gestão de serviços.",
      );
      return [];
    }
    throw error;
  }

  return data ?? [];
}

async function clientHasTvAssignment(clientId: string) {
  const supabase = createServerClient();
  const { data, error } = await supabase
    .from("tv_slots")
    .select("id")
    .eq("client_id", clientId)
    .limit(1)
    .maybeSingle();

  if (error) {
    if (isSchemaMissing(error)) {
      return false;
    }
    throw error;
  }

  return Boolean(data);
}

async function handleTvServiceForClient(
  clientId: string,
  selections: ServiceSelection[] = [],
  tvSetup?: z.infer<typeof tvSetupSchema>,
) {
  const serviceIds = selections.map((selection) => selection.serviceId);
  const services = await fetchServicesByIds(serviceIds);
  const hasTv = services.some((service) => service.name?.toLowerCase().includes("tv"));

  if (hasTv) {
    const alreadyAssigned = await clientHasTvAssignment(clientId);
    if (!alreadyAssigned) {
      const quantity =
        tvSetup?.quantity && Number.isFinite(tvSetup.quantity) && tvSetup.quantity > 0 ? tvSetup.quantity : 1;
      const planType: TVPlanType = tvSetup?.planType ?? "ESSENCIAL";
      const soldAt =
        tvSetup?.soldAt && tvSetup.soldAt.length === 10
          ? new Date(`${tvSetup.soldAt}T12:00:00`).toISOString()
          : tvSetup?.soldAt ?? undefined;
      const soldBy = tvSetup?.soldBy?.trim() ?? null;
      const params = {
        clientId,
        soldBy,
        soldAt,
        startsAt: tvSetup?.startsAt ?? undefined,
        expiresAt: tvSetup?.expiresAt ?? undefined,
        notes: tvSetup?.notes ?? undefined,
        planType,
      };

      if (quantity > 1) {
        await assignMultipleSlotsToClient({
          ...params,
          quantity,
        });
      } else {
        await assignSlotToClient(params);
      }
    }
  } else {
    await releaseSlotsForClient(clientId);
  }
}

type CloudSetupInput = z.infer<typeof cloudSetupSchema>;

async function syncCloudAccesses(
  clientId: string,
  selectedServiceIds?: string[] | null,
  cloudSetups?: CloudSetupInput[],
) {
  const supabase = createServerClient();
  const selectedSet = selectedServiceIds ? new Set(selectedServiceIds) : null;
  const setupMap = new Map<string, CloudSetupInput>();
  (cloudSetups ?? []).forEach((setup) => {
    setupMap.set(setup.serviceId, setup);
  });

  const allServiceIds = selectedSet ? Array.from(selectedSet) : Array.from(setupMap.keys());
  const services = allServiceIds.length > 0 ? await fetchServicesByIds(allServiceIds) : [];
  const cloudServiceKeywords = ["cloud", "hub", "hubplay", "telemedicina", "telepet"];

  const cloudServiceIdsSet = new Set(
    services
      .filter((service) => {
        const name = (service.name ?? "").toLowerCase();
        return cloudServiceKeywords.some((keyword) => name.includes(keyword));
      })
      .map((service) => service.id),
  );

  if (selectedSet && selectedSet.size > 0) {
    const cloudServiceIds = Array.from(selectedSet).filter((id) => cloudServiceIdsSet.has(id));
    const missing = cloudServiceIds.filter((serviceId) => !setupMap.has(serviceId));
    if (missing.length) {
      const missingNames = services
        .filter((s) => missing.includes(s.id))
        .map((s) => s.name)
        .join(", ");
      throw new HttpError(400, `Informe o vencimento para os seguintes serviços: ${missingNames}`);
    }
  }

  const { data: existingData, error: existingError } = await supabase
    .from("cloud_accesses")
    .select("service_id")
    .eq("client_id", clientId);

  if (existingError) {
    if (isSchemaMissing(existingError)) {
      return;
    }
    throw existingError;
  }

  const existingIds = new Set<string>((existingData ?? []).map((row: { service_id: string }) => row.service_id));

  const upsertTargets = selectedSet
    ? Array.from(selectedSet)
        .filter((serviceId) => cloudServiceIdsSet.has(serviceId))
        .map((serviceId) => setupMap.get(serviceId)!)
        .filter(Boolean)
    : Array.from(setupMap.values()).filter((setup) => cloudServiceIdsSet.has(setup.serviceId));

  for (const setup of upsertTargets) {
    const expiresAt = setup.expiresAt.trim();
    if (expiresAt.length < 8) {
      throw new HttpError(400, "Data de vencimento do serviço é inválida.");
    }

    const payload = {
      client_id: clientId,
      service_id: setup.serviceId,
      expires_at: expiresAt,
      is_test: Boolean(setup.isTest),
      notes: setup.notes?.trim() || null,
    };

    const { error } = await supabase
      .from("cloud_accesses")
      .upsert(payload, { onConflict: "client_id,service_id" });

    if (error) {
      if (isSchemaMissing(error)) {
        console.warn(
          "[syncCloudAccesses] Tabela cloud_accesses indisponível. Execute as migrações do Supabase para habilitar o serviço Cloud.",
        );
        return;
      }
      throw error;
    }
  }

  if (selectedSet) {
    const idsToRemove = Array.from(existingIds).filter((serviceId) => !selectedSet.has(serviceId));
    if (idsToRemove.length) {
      const { error: deleteError } = await supabase
        .from("cloud_accesses")
        .delete()
        .eq("client_id", clientId)
        .in("service_id", idsToRemove);
      if (deleteError && !isSchemaMissing(deleteError)) {
        throw deleteError;
      }
    }
  }
}

async function fetchClientSummary(id: string) {
  const supabase = createServerClient();
  const baseSelection =
    "*, client_services:client_services(custom_price, service:services(*)), cloud_accesses:cloud_accesses(id, client_id, service_id, expires_at, is_test, notes, created_at, updated_at, service:services(*))";
  let { data, error } = await supabase.from("clients").select(baseSelection).eq("id", id).maybeSingle();

  if (error && isSchemaMissing(error)) {
    const fallback = await supabase.from("clients").select("*").eq("id", id).maybeSingle();
    data = fallback.data;
    error = fallback.error;
  }

  if (error) {
    throw error;
  }

  if (!data) {
    throw new HttpError(404, "Cliente não encontrado");
  }

  const client = mapClientRow(data);

  const assignments = await fetchTvAssignmentsForClients([client.id], { includeHistory: true });
  client.tvAssignments = assignments.get(client.id) ?? [];

  return client;
}

export const GET = createApiHandler(async (req) => {
  const supabase = createServerClient();
  const { searchParams } = new URL(req.url);
  const searchRaw = searchParams.get("search") || undefined;
  const search = searchRaw?.toLowerCase();
  const page = Number(searchParams.get("page") ?? "1");
  const limit = Number(searchParams.get("limit") ?? "50");
  const documentTypeParam = searchParams.get("documentType")?.toUpperCase();
  const documentTypeFilter = documentTypeParam === "CPF" || documentTypeParam === "CNPJ" ? documentTypeParam : null;
  const safePage = Number.isFinite(page) && page > 0 ? Math.floor(page) : 1;
  const safeLimit = Number.isFinite(limit) && limit > 0 ? Math.floor(limit) : 50;
  const offset = (safePage - 1) * safeLimit;

  try {
    let query = supabase
      .from("clients")
      .select(
        "*, client_services:client_services(custom_price, service:services(*)), cloud_accesses:cloud_accesses(id, client_id, service_id, expires_at, is_test, notes, created_at, updated_at, service:services(*))",
        { count: "exact" },
      )
      .order("created_at", { ascending: false });

    if (documentTypeFilter) {
      const pattern = documentLengthPattern(documentTypeFilter === "CPF" ? 11 : 14);
      query = query.like("document", pattern);
    }

    if (searchRaw) {
      const ilike = `%${searchRaw}%`;
      query = query.or(
        [
          `name.ilike.${ilike}`,
          `email.ilike.${ilike}`,
          `document.ilike.${ilike}`,
          `company_name.ilike.${ilike}`,
          `phone.ilike.${ilike}`,
        ].join(","),
      );
    }

    query = query.range(offset, offset + safeLimit - 1);

    let { data, error, count } = await query;

    if (error && isSchemaMissing(error)) {
      const fallbackQuery = supabase
        .from("clients")
        .select("*", { count: "exact" })
        .order("created_at", { ascending: false })
        .range(offset, offset + safeLimit - 1);
      if (documentTypeFilter) {
        fallbackQuery.like("document", documentLengthPattern(documentTypeFilter === "CPF" ? 11 : 14));
      }
      const fallback = await fallbackQuery;
      data = fallback.data as any;
      error = fallback.error;
      count = fallback.count ?? count;
    }

    if (error) {
      throw error;
    }

    const mapped = (data ?? []).map(mapClientRow);
    const assignmentsMap = await fetchTvAssignmentsForClients(mapped.map((client) => client.id));
    mapped.forEach((client) => {
      client.tvAssignments = assignmentsMap.get(client.id) ?? [];
    });

    const filtered = search
      ? mapped.filter((client) =>
          [client.name, client.email, client.document, client.companyName]
            .filter(Boolean)
            .some((field) => field?.toLowerCase().includes(search ?? "")) ||
          (client.services ?? []).some((service) => service.name.toLowerCase().includes(search ?? "")) ||
          (client.tvAssignments ?? []).some((assignment) =>
            [assignment.email, assignment.username, assignment.soldBy ?? undefined]
              .filter(Boolean)
              .some((value) => value?.toLowerCase().includes(search ?? "")),
          ),
        )
      : mapped;

    const total = search ? filtered.length : count ?? filtered.length;
    const totalPages = Math.max(1, Math.ceil(total / safeLimit));

    return NextResponse.json({
      data: filtered,
      page: safePage,
      limit: safeLimit,
      total,
      totalPages,
    });
  } catch (error) {
    throw error;
  }
});

export const POST = createApiHandler(async (req) => {
  const supabase = createServerClient();
  const body = await req.json();
  const payload = clientCreateSchema.parse(body);
  const { serviceIds = [], serviceSelections, tvSetup, cloudSetups, ...clientData } = payload;
  clientData.document = sanitizeDocument(clientData.document);
  const selections: ServiceSelection[] =
    serviceSelections ??
    serviceIds.map((serviceId) => ({
      serviceId,
      customPrice: null,
    }));
  const selectedServiceIdsList = selections.map((selection) => selection.serviceId);
  const insertPayload = clientInsertPayload(clientData);
  const { data, error } = await supabase
    .from("clients")
    .insert(insertPayload)
    .select("id")
    .maybeSingle();

  if (error) {
    if (isUniqueViolation(error)) {
      throw new HttpError(409, "Documento já cadastrado.");
    }
    throw error;
  }

  if (!data) {
    throw new HttpError(500, "Falha ao criar cliente");
  }

  const selectedServiceIds = selections.map((selection) => selection.serviceId);
  try {
    await syncClientServices(data.id, selections);
    await handleTvServiceForClient(data.id, selections, tvSetup);
    await syncCloudAccesses(data.id, selectedServiceIdsList, cloudSetups ?? []);
  } catch (syncError) {
    await supabase.from("clients").delete().eq("id", data.id);
    throw syncError;
  }

  const refreshed = await fetchClientSummary(data.id);

  return NextResponse.json(refreshed, { status: 201 });
});

