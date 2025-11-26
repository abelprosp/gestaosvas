import { NextRequest, NextResponse } from "next/server";
import { createApiHandler } from "@/lib/utils/apiHandler";
import { createServerClient } from "@/lib/supabase/server";
import { PostgrestError } from "@supabase/supabase-js";

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
  // Novos campos
  clientVendorName?: string | null; // Nome do vendor que cadastrou o cliente (opened_by)
  serviceVendorName?: string | null; // Nome do vendor que cadastrou o serviço (sold_by)
  serviceValue?: number | null; // Valor do serviço (custom_price)
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
  sold_by?: string | null;
  service?: { id?: string; name?: string } | null;
};

type ClientServiceRow = {
  client_id: string;
  service?: { id?: string; name?: string } | null;
};

export const GET = createApiHandler(async (req) => {
  const supabase = createServerClient();
  const { searchParams } = new URL(req.url);
  const document = searchParams.get("document")?.replace(/\D/g) || undefined;
  const search = searchParams.get("search")?.trim() || "";
  const category = searchParams.get("category")?.toUpperCase() || "ALL";
  const serviceQuery = searchParams.get("service")?.toLowerCase() || "";
  const limitParam = Number(searchParams.get("limit") ?? "2000");
  const safeLimit = Number.isFinite(limitParam) && limitParam > 0 ? Math.min(limitParam, 10000) : 2000;

  try {
    // Buscar todos os vendors para mapear IDs para nomes
    const { data: vendorsData, error: vendorsError } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 });
    const vendorsMap = new Map<string, string>();
    if (!vendorsError && vendorsData?.users) {
      vendorsData.users.forEach((user) => {
        const name = (user.user_metadata as { name?: string } | undefined)?.name;
        if (name) {
          vendorsMap.set(user.id, name);
        } else if (user.email) {
          vendorsMap.set(user.id, user.email);
        }
      });
    }

    let clientQuery = supabase
      .from("clients")
      .select("id, name, document, email, cost_center, company_name, opened_by")
      .order("name", { ascending: true });

    if (document) {
      clientQuery = clientQuery.eq("document", document);
    } else if (search) {
      const ilike = `%${search}%`;
      clientQuery = clientQuery.or(
        [`name.ilike.${ilike}`, `email.ilike.${ilike}`, `company_name.ilike.${ilike}`, `document.ilike.${ilike}`].join(","),
      );
    } else {
      clientQuery = clientQuery.limit(200);
    }

    const { data: clients, error: clientsError } = await clientQuery;

    if (clientsError) {
      throw clientsError;
    }

    if (!clients || !clients.length) {
      return NextResponse.json({ data: [], total: 0 });
    }

    const clientIds = clients.map((client) => client.id);
    const rows: ReportRow[] = [];

    // Variável para armazenar dados de TV slots (usada para evitar duplicação)
    let tvData: TvSlotRow[] | null = null;

    // TV assignments
    try {
      const { data: tvSlots, error: tvError } = await supabase
        .from("tv_slots")
        .select(
          "id, client_id, slot_number, username, status, sold_by, sold_at, starts_at, expires_at, notes, plan_type, tv_accounts(email)",
        )
        .in("client_id", clientIds);

      if (tvError && !isSchemaMissing(tvError)) {
        throw tvError;
      }

      tvData = (tvSlots as TvSlotRow[] | null | undefined) ?? null;

      tvData?.forEach((slot) => {
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
          responsible: slot.sold_by ?? null,
          status: slot.status,
          startsAt: slot.starts_at ?? null,
          expiresAt: slot.expires_at ?? null,
          notes: slot.notes ?? null,
          clientVendorName: client.opened_by ? vendorsMap.get(client.opened_by) ?? null : null,
          serviceVendorName: slot.sold_by ? vendorsMap.get(slot.sold_by) ?? null : null,
          serviceValue: null, // TV não tem custom_price direto
        });
      });
    } catch (error) {
      console.error("[reports] falha ao carregar tv_slots", error);
    }

    // Cloud accesses
    try {
      const { data: cloudData, error: cloudError } = await supabase
        .from("cloud_accesses")
        .select("id, client_id, service_id, expires_at, is_test, notes, sold_by, service:services(id, name)")
        .in("client_id", clientIds);

      if (cloudError && !isSchemaMissing(cloudError)) {
        throw cloudError;
      }

      (cloudData as CloudAccessRow[] | null | undefined)?.forEach((access) => {
        const client = clients.find((item) => item.id === access.client_id);
        if (!client) {
          return;
        }
        const serviceName = access.service?.name ?? "Cloud";
        const lower = serviceName.toLowerCase();
        rows.push({
          id: access.id,
          category: lower.includes("hub") ? "HUB" : lower.includes("tele") ? "TELE" : "CLOUD",
          clientId: client.id,
          clientName: client.name,
          clientDocument: client.document,
          clientEmail: client.email,
          serviceId: access.service_id ?? access.service?.id ?? null,
          serviceName,
          identifier: serviceName,
          planType: access.is_test ? "TESTE" : null,
          responsible: null,
          status: access.is_test ? "Teste" : null,
          startsAt: null,
          expiresAt: access.expires_at,
          notes: access.notes ?? null,
          clientVendorName: client.opened_by ? vendorsMap.get(client.opened_by) ?? null : null,
          serviceVendorName: (access as any).sold_by ? vendorsMap.get((access as any).sold_by) ?? null : null,
          serviceValue: null, // Cloud não tem custom_price direto
        });
      });
    } catch (error) {
      console.error("[reports] falha ao carregar cloud_accesses", error);
    }

    // General services - exclui TV para evitar duplicação (TV já aparece em tv_slots)
    try {
      const { data: serviceData, error: serviceError } = await supabase
        .from("client_services")
        .select("client_id, custom_price, sold_by, service:services(id, name)")
        .in("client_id", clientIds);

      if (serviceError && !isSchemaMissing(serviceError)) {
        throw serviceError;
      }

      // Coletar IDs de clientes que já têm slots de TV para evitar duplicação
      const clientsWithTvSlots = new Set(
        tvData?.map((slot) => slot.client_id).filter(Boolean) ?? [],
      );

      (serviceData as (ClientServiceRow & { custom_price?: number | null; sold_by?: string | null })[] | null | undefined)?.forEach((relation) => {
        const client = clients.find((item) => item.id === relation.client_id);
        if (!client || !relation.service) {
          return;
        }
        const serviceName = relation.service.name ?? "Serviço";
        const lower = serviceName.toLowerCase().trim();
        
        // Pula serviços de TV que já aparecem em tv_slots para evitar duplicação
        // TV pode aparecer como "TV", "TV ESSENCIAL", "TV PREMIUM", etc.
        if (lower === "tv" || lower.startsWith("tv ")) {
          // Se o cliente já tem slots de TV, não adiciona aqui para evitar duplicação
          if (clientsWithTvSlots.has(relation.client_id)) {
            return;
          }
        }
        
        rows.push({
          id: `${relation.client_id}-${relation.service.id}`,
          category: lower.includes("hub")
            ? "HUB"
            : lower.includes("tele")
              ? "TELE"
              : lower.includes("cloud")
                ? "CLOUD"
                : "SERVICE",
          clientId: client.id,
          clientName: client.name,
          clientDocument: client.document,
          clientEmail: client.email,
          serviceId: relation.service.id ?? null,
          serviceName,
          identifier: serviceName,
          planType: null,
          responsible: null,
          status: null,
          startsAt: null,
          expiresAt: null,
          notes: null,
          clientVendorName: client.opened_by ? vendorsMap.get(client.opened_by) ?? null : null,
          serviceVendorName: relation.sold_by ? vendorsMap.get(relation.sold_by) ?? null : null,
          serviceValue: relation.custom_price ?? null,
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
      // Suporta múltiplos serviços separados por vírgula
      const serviceQueries = serviceQuery.split(",").map(s => s.trim().toLowerCase()).filter(Boolean);
      if (serviceQueries.length > 0) {
        filteredRows = filteredRows.filter((row) => 
          serviceQueries.some(query => row.serviceName.toLowerCase().includes(query))
        );
      }
    }

    if (document) {
      filteredRows = filteredRows.filter((row) => row.clientDocument === document);
    }

    // Ordenar por nome do cliente e depois por categoria
    filteredRows.sort((a, b) => {
      const nameCompare = a.clientName.localeCompare(b.clientName, "pt-BR", { sensitivity: "base" });
      if (nameCompare !== 0) return nameCompare;
      return a.category.localeCompare(b.category);
    });

    filteredRows = filteredRows.slice(0, safeLimit);

    return NextResponse.json({
      data: filteredRows,
      total: filteredRows.length,
    });
  } catch (error) {
    throw error;
  }
});





