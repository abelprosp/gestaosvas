import { NextRequest, NextResponse } from "next/server";
import { createApiHandler } from "@/lib/utils/apiHandler";
import { createServerClient } from "@/lib/supabase/server";
import { HttpError } from "@/lib/utils/httpError";
import { PostgrestError } from "@supabase/supabase-js";

const SCHEMA_MISSING_CODES = new Set(["PGRST200", "PGRST201", "PGRST202", "PGRST203", "PGRST204", "PGRST205"]);

type TvSlotRow = {
  sold_at: string | null;
  plan_type: "ESSENCIAL" | "PREMIUM" | null;
};

type ClientServiceSaleRow = {
  created_at: string | null;
  service: { id: string; name: string } | null;
};

function isSchemaMissing(error: PostgrestError | null | undefined) {
  return Boolean(error?.code && SCHEMA_MISSING_CODES.has(error.code));
}

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

export const GET = createApiHandler(async (req) => {
  const supabase = createServerClient();
  const { searchParams } = new URL(req.url);
  const startParam = parseDateParam(searchParams.get("startDate"));
  const endParam = parseDateParam(searchParams.get("endDate"));
  const filterServices =
    typeof searchParams.get("services") === "string" && searchParams.get("services")?.length
      ? searchParams.get("services")!.split(",").map((item) => item.trim()).filter(Boolean)
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

  return NextResponse.json({
    range: {
      start: startDate.toISOString(),
      end: endDate.toISOString(),
    },
    services: Array.from(serviceCatalog.values()),
    selectedServices: filterServices,
    points,
    totalSales: effectiveEvents.length,
  });
});





