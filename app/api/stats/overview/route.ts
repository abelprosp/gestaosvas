import { NextRequest, NextResponse } from "next/server";
import { createApiHandler } from "@/lib/utils/apiHandler";
import { createServerClient } from "@/lib/supabase/server";
import { PostgrestError } from "@supabase/supabase-js";
import { mapContractRow } from "@/lib/utils/mappers";

type Metrics = {
  cpf: number;
  cnpj: number;
  total: number;
  lastMonth: number;
};

type PlanType = "ESSENCIAL" | "PREMIUM";

const TV_GOAL = 5000;

const SCHEMA_MISSING_CODES = new Set(["PGRST200", "PGRST201", "PGRST202", "PGRST203", "PGRST204", "PGRST205"]);

type TvSlotRow = {
  sold_at: string | null;
  plan_type: PlanType | null;
};

type ClientServiceAssignmentRow = {
  client_id: string | null;
  service: { id: string; name: string } | null;
};

function isSchemaMissing(error: PostgrestError | null | undefined) {
  return Boolean(error?.code && SCHEMA_MISSING_CODES.has(error.code));
}

function sanitizeDocument(document?: string | null) {
  if (!document) return "";
  return document.replace(/\D/g, "");
}

function getDocumentType(document: string): "CPF" | "CNPJ" | "UNKNOWN" {
  if (document.length === 11) return "CPF";
  if (document.length === 14) return "CNPJ";
  return "UNKNOWN";
}

function isWithinLast30Days(dateInput?: string | null) {
  if (!dateInput) return false;
  const createdAt = new Date(dateInput);
  if (Number.isNaN(createdAt.getTime())) return false;
  const now = new Date();
  const diff = now.getTime() - createdAt.getTime();
  const thirtyDays = 30 * 24 * 60 * 60 * 1000;
  return diff <= thirtyDays;
}

export const GET = createApiHandler(async (req) => {
  const supabase = createServerClient();
  const [
    { data: clientsData, error: clientsError },
    slotsResult,
    recentContractsResult,
    clientServicesResult,
  ] = await Promise.all([
    supabase.from("clients").select("id, document, created_at"),
    supabase.from("tv_slots").select("client_id, plan_type, status"),
    supabase
      .from("contracts")
      .select("*, client:clients(*)")
      .order("created_at", { ascending: false })
      .limit(5),
    supabase.from("client_services").select("client_id, service:services(id, name)"),
  ]);

  if (clientsError) {
    throw clientsError;
  }

  const clientInfos = new Map(
    (clientsData ?? []).map((client) => {
      const sanitized = sanitizeDocument(client.document);
      return [client.id, { document: sanitized, docType: getDocumentType(sanitized), createdAt: client.created_at }];
    }),
  );

  const allClientIds = new Set<string>(Array.from(clientInfos.keys()));

  const metricsForIds = (ids: Set<string>): Metrics => {
    let cpf = 0;
    let cnpj = 0;
    let total = 0;
    let lastMonth = 0;

    ids.forEach((id) => {
      const info = clientInfos.get(id);
      if (!info) return;
      total += 1;
      if (info.docType === "CPF") cpf += 1;
      if (info.docType === "CNPJ") cnpj += 1;
      if (isWithinLast30Days(info.createdAt)) lastMonth += 1;
    });

    return { cpf, cnpj, total, lastMonth };
  };

  const planClients: Record<PlanType, Set<string>> = {
    ESSENCIAL: new Set<string>(),
    PREMIUM: new Set<string>(),
  };

  let usedSlots = 0;
  const slotsByPlan: Record<PlanType, number> = {
    ESSENCIAL: 0,
    PREMIUM: 0,
  };

  const slotsError = slotsResult.error as PostgrestError | null;
  const slotRows = isSchemaMissing(slotsError) ? [] : slotsResult.data ?? [];

  if (slotsError && !isSchemaMissing(slotsError)) {
    throw slotsError;
  }

  for (const slot of slotRows) {
    const planType = slot.plan_type as PlanType | null;
    const clientId = slot.client_id as string | null;
    const status = slot.status as string | null;

    // Contar apenas slots que têm cliente conectado (realmente em uso)
    if (clientId && status !== "USED") {
      usedSlots += 1;
      if (planType) {
        slotsByPlan[planType] += 1;
      }
    }

    if (clientId && planType && clientInfos.has(clientId)) {
      planClients[planType].add(clientId);
    }
  }

  const metrics = {
    all: metricsForIds(allClientIds),
    essencial: metricsForIds(planClients.ESSENCIAL),
    premium: metricsForIds(planClients.PREMIUM),
  };

  const planSummary = (Object.keys(planClients) as PlanType[]).map((plan) => ({
    plan,
    clients: planClients[plan].size,
    slots: slotsByPlan[plan],
  }));

  const serviceSegments = new Map<string, { label: string; clients: Set<string> }>();
  if (clientServicesResult.error) {
    throw clientServicesResult.error;
  }

  const clientServiceRows = (clientServicesResult.data ?? []) as unknown as ClientServiceAssignmentRow[];
  clientServiceRows.forEach((row) => {
    if (!row.client_id || !clientInfos.has(row.client_id)) {
      return;
    }
    const service = row.service;
    if (!service?.id || !service?.name) {
      return;
    }
    if (service.name.trim().toLowerCase() === "tv") {
      return;
    }
    const key = `service-${service.id}`;
    if (!serviceSegments.has(key)) {
      serviceSegments.set(key, { label: service.name, clients: new Set<string>() });
    }
    serviceSegments.get(key)?.clients.add(row.client_id);
  });

  const segments = [
    { key: "all", label: "Todos", metrics: metrics.all },
    { key: "essencial", label: "TV Essencial", metrics: metrics.essencial },
    { key: "premium", label: "TV Premium", metrics: metrics.premium },
    ...Array.from(serviceSegments.entries()).map(([key, value]) => ({
      key,
      label: value.label,
      metrics: metricsForIds(value.clients),
    })),
  ];

  const availableSlots = Math.max(TV_GOAL - usedSlots, 0);
  const tvUsage = {
    goal: TV_GOAL,
    used: usedSlots,
    available: availableSlots,
    percentage: Number(((usedSlots / TV_GOAL) * 100).toFixed(2)),
  };

  const recentContracts = (recentContractsResult.data ?? []).map(mapContractRow);

  return NextResponse.json({
    metrics,
    planSummary,
    tvUsage,
    recentContracts,
    segments,
  });
});





