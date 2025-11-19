import { Router } from "express";
import supabase from "../supabaseClient";
import { HttpError } from "../utils/httpError";
import { requireAuth } from "../middleware/auth";
import { PostgrestError } from "@supabase/supabase-js";

const router = Router();

const SCHEMA_ERROR_CODES = new Set(["PGRST200", "PGRST201", "PGRST202", "PGRST203", "PGRST204", "PGRST205"]);

function isSchemaMissing(error: unknown): error is PostgrestError {
  return Boolean((error as PostgrestError)?.code && SCHEMA_ERROR_CODES.has((error as PostgrestError).code));
}

type ReportRow = {
  id: string;
  category: "TV" | "CLOUD" | "SERVICE" | "HUB" | "TELE";
  clientId: string;
  clientName: string;
  clientDocument: string;
  clientEmail?: string | null;
  serviceId?: string | null;
  serviceName: string;
  identifier: string;
  planType?: string | null;
  responsible?: string | null;
  status?: string | null;
  startsAt?: string | null;
  expiresAt?: string | null;
  notes?: string | null;
};

type TvSlotRow = {
  id: string;
  client_id: string;
  slot_number: number;
  username: string;
  status: string;
  sold_by?: string | null;
  sold_at?: string | null;
  starts_at?: string | null;
  expires_at?: string | null;
  notes?: string | null;
  plan_type?: string | null;
  tv_accounts?: { email?: string | null } | null;
};

type CloudAccessRow = {
  id: string;
  client_id: string;
  service_id?: string | null;
  expires_at: string;
  is_test: boolean;
  notes?: string | null;
  service?: { id?: string; name?: string } | null;
};

type ClientServiceRow = {
  client_id: string;
  service?: { id?: string; name?: string } | null;
};

router.get("/services", requireAuth, async (req, res, next) => {
  try {
    const document = typeof req.query.document === "string" ? req.query.document.replace(/\D/g, "") : undefined;
    const search = typeof req.query.search === "string" ? req.query.search.trim() : "";
    const category = typeof req.query.category === "string" ? req.query.category.toUpperCase() : "ALL";
    const serviceQuery = typeof req.query.service === "string" ? req.query.service.toLowerCase() : "";
    const limitParam = Number(req.query.limit ?? "2000");
    const safeLimit = Number.isFinite(limitParam) && limitParam > 0 ? Math.min(limitParam, 10000) : 2000;

    let clientQuery = supabase
      .from("clients")
      .select("id, name, document, email, cost_center, company_name")
      .order("name", { ascending: true });

    if (document) {
      clientQuery = clientQuery.eq("document", document);
    } else if (search) {
      const ilike = `%${search}%`;
      clientQuery = clientQuery.or(
        [`name.ilike.${ilike}`, `email.ilike.${ilike}`, `company_name.ilike.${ilike}`, `document.ilike.${ilike}`].join(
          ",",
        ),
      );
    } else {
      clientQuery = clientQuery.limit(200);
    }

    const { data: clients, error: clientsError } = await clientQuery;

    if (clientsError) {
      throw clientsError;
    }

    if (!clients || !clients.length) {
      res.json({ data: [], total: 0 });
      return;
    }

    const clientIds = clients.map((client) => client.id);
    const rows: ReportRow[] = [];

    // TV assignments
    try {
      const { data: tvData, error: tvError } = await supabase
        .from("tv_slots")
        .select(
          "id, client_id, slot_number, username, status, sold_by, sold_at, starts_at, expires_at, notes, plan_type, tv_accounts(email)",
        )
        .in("client_id", clientIds);

      if (tvError && !isSchemaMissing(tvError)) {
        throw tvError;
      }

      (tvData as TvSlotRow[] | null | undefined)?.forEach((slot) => {
        const client = clients.find((item) => item.id === slot.client_id);
        if (!client) {
          return;
        }
        rows.push({
          id: slot.id,
          category: "TV",
          clientId: client.id,
          clientName: client.name,
          clientDocument: client.document,
          clientEmail: client.email,
          serviceId: slot.plan_type ?? null,
          serviceName: slot.plan_type ? `TV ${slot.plan_type}` : "TV",
          identifier: `${slot.tv_accounts?.email ?? slot.username} · Perfil ${slot.slot_number}`,
          planType: slot.plan_type ?? null,
          responsible: slot.sold_by,
          status: slot.status,
          startsAt: slot.starts_at,
          expiresAt: slot.expires_at,
          notes: slot.notes,
        });
      });
    } catch (error) {
      console.error("[reports] falha ao carregar tv_slots", error);
    }

    // Cloud accesses
    try {
      const { data: cloudData, error: cloudError } = await supabase
        .from("cloud_accesses")
        .select("id, client_id, service_id, expires_at, is_test, notes, service:services(id, name)")
        .in("client_id", clientIds);

      if (cloudError && !isSchemaMissing(cloudError)) {
        throw cloudError;
      }

      (cloudData as CloudAccessRow[] | null | undefined)?.forEach((access) => {
        const client = clients.find((item) => item.id === access.client_id);
        if (!client) {
          return;
        }
        rows.push({
          id: access.id,
          category: (() => {
            const lower = access.service?.name?.toLowerCase() ?? "";
            if (lower.includes("hub")) {
              return "HUB";
            }
            if (lower.includes("tele")) {
              return "TELE";
            }
            return "CLOUD";
          })(),
          clientId: client.id,
          clientName: client.name,
          clientDocument: client.document,
          clientEmail: client.email,
          serviceId: access.service_id ?? access.service?.id ?? null,
          serviceName: access.service?.name ?? "Cloud",
          identifier: access.service?.name ?? "Cloud",
          planType: access.is_test ? "TESTE" : null,
          responsible: null,
          status: access.is_test ? "Teste" : null,
          startsAt: null,
          expiresAt: access.expires_at,
          notes: access.notes,
        });
      });
    } catch (error) {
      console.error("[reports] falha ao carregar cloud_accesses", error);
    }

    // General services
    try {
    const { data: serviceData, error: serviceError } = await supabase
        .from("client_services")
        .select("client_id, service:services(id, name)")
        .in("client_id", clientIds);

      if (serviceError && !isSchemaMissing(serviceError)) {
        throw serviceError;
      }

      (serviceData as ClientServiceRow[] | null | undefined)?.forEach((relation) => {
        const client = clients.find((item) => item.id === relation.client_id);
        if (!client || !relation.service) {
          return;
        }
        rows.push({
          id: `${relation.client_id}-${relation.service.id}`,
          category: (() => {
            const lower = relation.service.name?.toLowerCase() ?? "";
            if (lower.includes("hub")) {
              return "HUB";
            }
            if (lower.includes("tele")) {
              return "TELE";
            }
            if (lower.includes("cloud")) {
              return "CLOUD";
            }
            return "SERVICE";
          })(),
          clientId: client.id,
          clientName: client.name,
          clientDocument: client.document,
          clientEmail: client.email,
          serviceId: relation.service.id,
          serviceName: relation.service.name ?? "Serviço",
          identifier: relation.service.name ?? "Serviço",
          planType: null,
          responsible: null,
          status: null,
          startsAt: null,
          expiresAt: null,
          notes: null,
        });
      });
    } catch (error) {
      console.error("[reports] falha ao carregar client_services", error);
    }

    let filteredRows = rows;

    if (category && category !== "ALL") {
      filteredRows = filteredRows.filter((row) => row.category === category);
    }

    if (serviceQuery) {
      filteredRows = filteredRows.filter((row) => row.serviceName.toLowerCase().includes(serviceQuery));
    }

    if (document) {
      filteredRows = filteredRows.filter((row) => row.clientDocument === document);
    }

    filteredRows = filteredRows.slice(0, safeLimit);

    res.json({
      data: filteredRows,
      total: filteredRows.length,
    });
  } catch (error) {
    next(error);
  }
});

export default router;


