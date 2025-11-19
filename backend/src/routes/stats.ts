import { Router } from "express";
import type { PostgrestError } from "@supabase/supabase-js";
import supabase from "../supabaseClient";
import { mapContractRow } from "../utils/mappers";
import { HttpError } from "../utils/httpError";

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

type ClientServiceSaleRow = {
  created_at: string | null;
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

const router = Router();

function parseDateParam(value: unknown): Date | null {
  if (!value || typeof value !== "string") {
    return null;
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }
  return date;
}

function startOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function endOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(23, 59, 59, 999);
  return d;
}

function defaultSalesRange() {
  const end = new Date();
  const start = new Date(end);
  start.setMonth(start.getMonth() - 11);
  start.setDate(1);
  return {
    start: startOfDay(start),
    end: endOfDay(end),
  };
}

function enumerateMonths(start: Date, end: Date): string[] {
  const cursor = new Date(start.getFullYear(), start.getMonth(), 1);
  const limit = new Date(end.getFullYear(), end.getMonth(), 1);
  const months: string[] = [];

  while (cursor <= limit) {
    const key = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, "0")}`;
    months.push(key);
    cursor.setMonth(cursor.getMonth() + 1);
  }

  return months;
}

function formatMonthLabel(key: string) {
  const [year, month] = key.split("-");
  const date = new Date(Number(year), Number(month) - 1, 1);
  return date.toLocaleDateString("pt-BR", { month: "short", year: "numeric" });
}

router.get("/overview", async (_req, res, next) => {
  try {
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

      if (status && status !== "AVAILABLE") {
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

    res.json({
      metrics,
      planSummary,
      tvUsage,
      recentContracts,
      segments,
    });
  } catch (error) {
    next(error);
  }
});

router.get("/sales", async (req, res, next) => {
  try {
    const startParam = parseDateParam(req.query.startDate);
    const endParam = parseDateParam(req.query.endDate);
    const filterServices =
      typeof req.query.services === "string" && req.query.services.length
        ? req.query.services.split(",").map((item) => item.trim()).filter(Boolean)
        : [];

    const { start: defaultStart, end: defaultEnd } = defaultSalesRange();
    const startDate = startParam ? startOfDay(startParam) : defaultStart;
    const endDate = endParam ? endOfDay(endParam) : defaultEnd;

    if (startDate > endDate) {
      throw new HttpError(400, "Período inválido. A data inicial deve ser menor ou igual à final.");
    }

    const months = enumerateMonths(startDate, endDate);

    const [{ data: clientServices, error: clientServicesError }, { data: tvSlots, error: tvSlotsError }] =
      await Promise.all([
        supabase
          .from("client_services")
          .select("created_at, service:services(id, name)")
          .gte("created_at", startDate.toISOString())
          .lte("created_at", endDate.toISOString()),
        supabase
          .from("tv_slots")
          .select("sold_at, plan_type")
          .not("sold_at", "is", null)
          .gte("sold_at", startDate.toISOString())
          .lte("sold_at", endDate.toISOString()),
      ]);

    if (clientServicesError) {
      throw clientServicesError;
    }
    if (tvSlotsError && !isSchemaMissing(tvSlotsError)) {
      throw tvSlotsError;
    }

    type ServiceKey = string;

    const serviceCatalog = new Map<ServiceKey, { key: ServiceKey; name: string; group: "TV" | "SERVICO" }>();
    const events: Array<{ serviceKey: ServiceKey; occurredAt: string }> = [];

    const clientServiceRows = (clientServices ?? []) as unknown as ClientServiceSaleRow[];
    clientServiceRows.forEach((relation) => {
      const rawDate = relation.created_at;
      const service = relation.service;
      if (!rawDate || !service?.id || !service?.name) {
        return;
      }
      const occurredAt = new Date(rawDate);
      if (Number.isNaN(occurredAt.getTime())) {
        return;
      }
      const serviceName = service.name.trim();
      if (serviceName.toLowerCase() === "tv") {
        return;
      }
      const key = `svc-${service.id}`;
      if (!serviceCatalog.has(key)) {
        serviceCatalog.set(key, { key, name: serviceName, group: "SERVICO" });
      }
      events.push({ serviceKey: key, occurredAt: occurredAt.toISOString() });
    });

    const tvSlotRows = (tvSlots ?? []) as unknown as TvSlotRow[];
    tvSlotRows.forEach((slot) => {
      if (!slot.sold_at) {
        return;
      }
      const occurredAt = new Date(slot.sold_at);
      if (Number.isNaN(occurredAt.getTime())) {
        return;
      }
      const plan = slot.plan_type === "PREMIUM" ? "TV Premium" : "TV Essencial";
      const key: ServiceKey = slot.plan_type === "PREMIUM" ? "tv-premium" : "tv-essencial";
      if (!serviceCatalog.has(key)) {
        serviceCatalog.set(key, { key, name: plan, group: "TV" });
      }
      events.push({ serviceKey: key, occurredAt: occurredAt.toISOString() });
    });

    const effectiveEvents =
      filterServices.length > 0
        ? events.filter((event) => {
            const service = serviceCatalog.get(event.serviceKey);
            return service ? filterServices.includes(service.name) : false;
          })
        : events;

    const totalsByMonth = new Map<string, Map<ServiceKey, number>>();

    months.forEach((monthKey) => {
      totalsByMonth.set(monthKey, new Map());
    });

    effectiveEvents.forEach((event) => {
      const date = new Date(event.occurredAt);
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
      if (!totalsByMonth.has(monthKey)) {
        totalsByMonth.set(monthKey, new Map());
      }
      const monthBucket = totalsByMonth.get(monthKey)!;
      monthBucket.set(event.serviceKey, (monthBucket.get(event.serviceKey) ?? 0) + 1);
    });

    const points = months.map((monthKey) => {
      const monthTotals = totalsByMonth.get(monthKey) ?? new Map();
      const totals: Record<string, number> = {};
      let total = 0;
      serviceCatalog.forEach((service) => {
        const value = monthTotals.get(service.key) ?? 0;
        totals[service.key] = value;
        total += value;
      });
      return {
        month: monthKey,
        label: formatMonthLabel(monthKey),
        totals,
        total,
      };
    });

    res.json({
      range: {
        start: startDate.toISOString(),
        end: endDate.toISOString(),
      },
      services: Array.from(serviceCatalog.values()),
      selectedServices: filterServices,
      points,
      totalSales: effectiveEvents.length,
    });
  } catch (error) {
    next(error);
  }
});

export default router;

