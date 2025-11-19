import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createApiHandler } from "@/lib/utils/apiHandler";
import { createServerClient } from "@/lib/supabase/server";
import { HttpError } from "@/lib/utils/httpError";

const updateSchema = z
  .object({
    expiresAt: z.string().min(8).optional(),
    isTest: z.boolean().optional(),
    notes: z.string().optional(),
  })
  .refine((value) => Object.keys(value).length > 0, { message: "Nenhuma alteração fornecida." });

function mapCloudRow(row: any) {
  return {
    id: row.id,
    clientId: row.client_id,
    serviceId: row.service_id,
    expiresAt: row.expires_at,
    isTest: row.is_test,
    notes: row.notes,
    client: row.client ?? null,
    service: row.service ?? null,
  };
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

  const documentDigits = searchParams.get("document")?.replace(/\D/g, "") || "";
  const service = searchParams.get("service") || undefined;

  // Buscar service_id se filtro por serviço foi especificado
  let serviceId: string | undefined = undefined;
  if (service) {
    // Buscar todos os serviços e fazer comparação case-insensitive no código
    // para garantir match exato independente de maiúsculas/minúsculas
    const { data: servicesData, error: serviceError } = await supabase
      .from("services")
      .select("id, name");

    if (serviceError) {
      throw serviceError;
    }

    const normalizedFilter = service.trim().toLowerCase();
    const matchedService = servicesData?.find(
      (s) => s.name.trim().toLowerCase() === normalizedFilter
    );

    if (!matchedService) {
      // Serviço não encontrado, retornar resultado vazio
      return NextResponse.json({
        data: [],
        page: safePage,
        limit: safeLimit,
        total: 0,
        totalPages: 1,
      });
    }

    serviceId = matchedService.id;
  }

  // Buscar client_id se filtro por documento foi especificado
  let clientId: string | undefined = undefined;
  if (documentDigits) {
    const { data: clientData, error: clientError } = await supabase
      .from("clients")
      .select("id")
      .eq("document", documentDigits)
      .maybeSingle();

    if (clientError) {
      throw clientError;
    }

    if (clientData) {
      clientId = clientData.id;
    } else {
      // Cliente não encontrado, retornar resultado vazio
      return NextResponse.json({
        data: [],
        page: safePage,
        limit: safeLimit,
        total: 0,
        totalPages: 1,
      });
    }
  }

  let query = supabase
    .from("cloud_accesses")
    .select(
      "id, client_id, service_id, expires_at, is_test, notes, client:clients(id, name, email, document), service:services(id, name)",
      { count: "exact" },
    )
    .order("expires_at", { ascending: true })
    .range(offset, offset + safeLimit - 1);

  if (serviceId) {
    query = query.eq("service_id", serviceId);
  }

  if (clientId) {
    query = query.eq("client_id", clientId);
  }

  if (searchRaw) {
    const ilike = `%${searchRaw}%`;
    query = query.or([`notes.ilike.${ilike}`].join(","));

    // Se já temos um clientId do filtro por documento, buscar apenas nesse cliente
    if (clientId) {
      const { data: clientData, error: clientError } = await supabase
        .from("clients")
        .select("id")
        .eq("id", clientId)
        .or([`name.ilike.${ilike}`, `email.ilike.${ilike}`, `document.ilike.${ilike}`].join(","))
        .maybeSingle();

      if (clientError) {
        throw clientError;
      }

      // Se o cliente específico não corresponde à busca, retornar vazio
      if (!clientData) {
        return NextResponse.json({
          data: [],
          page: safePage,
          limit: safeLimit,
          total: 0,
          totalPages: 1,
        });
      }
    } else {
      // Buscar todos os clientes que correspondem à busca
      const { data: clientMatches, error: clientsError } = await supabase
        .from("clients")
        .select("id")
        .or([`name.ilike.${ilike}`, `email.ilike.${ilike}`, `document.ilike.${ilike}`].join(","))
        .limit(500);

      if (clientsError) {
        throw clientsError;
      }

      const clientIds = (clientMatches ?? []).map((item) => item.id);
      if (clientIds.length) {
        query = query.in("client_id", clientIds);
      } else {
        // Nenhum cliente encontrado, mas pode haver matches em notes
        // A query já tem o filtro de notes, então continua
      }
    }
  }

  const { data, error, count } = await query;

  if (error) {
    throw error;
  }

  return NextResponse.json({
    data: (data ?? []).map(mapCloudRow),
    page: safePage,
    limit: safeLimit,
    total: count ?? data?.length ?? 0,
    totalPages: Math.max(1, Math.ceil((count ?? data?.length ?? 0) / safeLimit)),
  });
});


