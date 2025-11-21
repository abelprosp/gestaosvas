import { NextResponse } from "next/server";
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
  openedBy: z.string().optional(), // Vendedor que abriu o cliente
});

const serviceSelectionSchema = z.object({
  serviceId: z.string().uuid(),
  customPrice: z.number().min(0).nullable().optional(),
  soldBy: z.string().optional(), // Vendedor específico para este serviço
});

const tvPlanTypeSchema = z.enum(["ESSENCIAL", "PREMIUM"]);

const tvSetupSchema = z
  .object({
    quantity: z.union([z.number().int().min(1).max(50), z.string()]).optional(),
    planType: tvPlanTypeSchema.optional(),
    soldBy: z.string().min(1).optional(),
    soldAt: z.string().optional(),
    startsAt: z.string().optional(),
    expiresAt: z.string().optional(),
    notes: z.string().optional(),
    hasTelephony: z.boolean().optional(),
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
      item.history.sort((a: { createdAt: string }, b: { createdAt: string }) => (a.createdAt > b.createdAt ? -1 : 1));
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
  
  // Detectar serviço TV - verifica se o nome contém "tv" (case insensitive)
  // Aceita: "TV", "tv", "TV Essencial", "TV Negociável", etc.
  const hasTv = services.some((service) => {
    const serviceName = (service.name ?? "").toLowerCase();
    return serviceName.includes("tv");
  });

  console.log(`[handleTvServiceForClient] 🔍 Análise para cliente ${clientId}:`, {
    hasTv,
    tvSetupPresent: !!tvSetup,
    tvSetupKeys: tvSetup ? Object.keys(tvSetup) : [],
    serviceIds,
    serviceNames: services.map(s => s.name),
    serviceCount: services.length,
    selectionsCount: selections.length,
  });

  // Se cliente tem serviço TV mas não tem tvSetup, apenas não cria acessos
  // O serviço TV já foi salvo via syncClientServices
  if (hasTv && tvSetup) {
    // Verificar se os campos obrigatórios para criar acessos estão preenchidos
    const hasSoldBy = tvSetup.soldBy && tvSetup.soldBy.trim();
    // Verificar se expiresAt está no formato correto (YYYY-MM-DD = 10 caracteres)
    // Aceitar tanto formato YYYY-MM-DD quanto DD/MM/YYYY
    const expiresAtTrimmed = tvSetup.expiresAt ? tvSetup.expiresAt.trim() : "";
    
    // Converter data se necessário (DD/MM/YYYY -> YYYY-MM-DD)
    let expiresAtFormatted = expiresAtTrimmed;
    if (expiresAtTrimmed.includes("/")) {
      // Converter de DD/MM/YYYY para YYYY-MM-DD
      const parts = expiresAtTrimmed.split("/");
      if (parts.length === 3 && parts[0].length === 2 && parts[1].length === 2 && parts[2].length === 4) {
        expiresAtFormatted = `${parts[2]}-${parts[1]}-${parts[0]}`;
      }
    }
    
    const hasExpiresAt = expiresAtFormatted.length === 10;
    
    console.log(`[handleTvServiceForClient] Verificando campos para cliente ${clientId}:`, {
      hasSoldBy,
      expiresAtOriginal: expiresAtTrimmed,
      expiresAtFormatted,
      hasExpiresAt,
      tvSetupKeys: Object.keys(tvSetup),
    });
    
    // Só cria acessos se os campos obrigatórios estiverem preenchidos
    if (hasSoldBy && hasExpiresAt) {
      const alreadyAssigned = await clientHasTvAssignment(clientId);
      if (!alreadyAssigned) {
        // Converter quantity de string para number
        const parsedQuantity = tvSetup.quantity 
          ? (typeof tvSetup.quantity === "string" ? parseInt(tvSetup.quantity, 10) : tvSetup.quantity)
          : 1;
        const quantity = Number.isFinite(parsedQuantity) && parsedQuantity > 0 ? Math.min(50, parsedQuantity) : 1;
        const planType: TVPlanType = tvSetup?.planType ?? "ESSENCIAL";
        const soldAt =
          tvSetup?.soldAt && tvSetup.soldAt.length === 10
            ? new Date(`${tvSetup.soldAt}T12:00:00`).toISOString()
            : tvSetup?.soldAt ?? undefined;
        const soldBy = tvSetup.soldBy?.trim() || "";
        
        const params = {
          clientId,
          soldBy,
          soldAt,
          startsAt: tvSetup?.startsAt ?? undefined,
          expiresAt: expiresAtFormatted,
          notes: tvSetup?.notes?.trim() || undefined,
          planType,
          hasTelephony: tvSetup?.hasTelephony ?? undefined,
        };

        console.log(`[handleTvServiceForClient] 🚀 Criando ${quantity} acesso(s) de TV para cliente ${clientId}`, {
          clientId,
          quantity,
          soldBy,
          expiresAt: expiresAtFormatted,
          planType,
        });
        
        try {
          if (quantity > 1) {
            const results = await assignMultipleSlotsToClient({
              ...params,
              quantity,
            });
            console.log(`[handleTvServiceForClient] ✅ ${results.length} acesso(s) de TV criado(s) com sucesso para cliente ${clientId}`);
          } else {
            const result = await assignSlotToClient(params);
            console.log(`[handleTvServiceForClient] ✅ 1 acesso de TV criado com sucesso para cliente ${clientId}:`, {
              slotId: result.id,
              email: result.account?.email,
              username: result.username,
            });
          }
        } catch (assignError) {
          // Verificar se é erro de schema (HttpError 503) - verificar propriedades diretamente
          // Não podemos confiar apenas no instanceof em ambientes compilados
          const isHttpError503 = 
            assignError && 
            typeof assignError === "object" &&
            (("status" in assignError && (assignError as { status?: number }).status === 503) ||
            (assignError instanceof HttpError && assignError.status === 503));
          
          // Verificar também pelos códigos de schema do Supabase
          const schemaCodes = ["PGRST200", "PGRST201", "PGRST202", "PGRST203", "PGRST204", "PGRST205"];
          const isSchemaError = 
            assignError && 
            typeof assignError === "object" && 
            "code" in assignError &&
            schemaCodes.includes((assignError as { code?: string }).code ?? "");
          
          if (isHttpError503 || isSchemaError) {
            // É erro de schema - não relançar, apenas logar
            console.warn(`[handleTvServiceForClient] ⚠️ Schema de TV não disponível para cliente ${clientId}. Serviço será salvo sem acessos de TV.`);
            return; // Retorna sem lançar erro - cliente será salvo normalmente
          }
          
          // Outro tipo de erro, loga e relança
          console.error(`[handleTvServiceForClient] ❌ Erro ao criar acessos de TV para cliente ${clientId}:`, {
            error: assignError,
            message: assignError instanceof Error ? assignError.message : String(assignError),
            stack: assignError instanceof Error ? assignError.stack : undefined,
          });
          throw assignError;
        }
      } else {
        console.log(`[handleTvServiceForClient] ℹ️ Cliente ${clientId} já possui acessos de TV atribuídos`);
      }
    } else {
      console.warn(`[handleTvServiceForClient] ⚠️ Campos obrigatórios não preenchidos para cliente ${clientId}:`, {
        hasSoldBy,
        hasExpiresAt,
        expiresAtOriginal: expiresAtTrimmed,
        expiresAtFormatted,
        tvSetupKeys: Object.keys(tvSetup),
        tvSetupContent: JSON.stringify(tvSetup, null, 2),
      });
      console.warn(`[handleTvServiceForClient] ⚠️ Serviço TV será salvo, mas SEM acessos configurados para cliente ${clientId}`);
    }
    // Se campos não estão preenchidos, simplesmente não cria acessos (não dá erro)
    // O serviço TV já foi salvo via syncClientServices, apenas não tem acessos configurados
  } else if (hasTv && !tvSetup) {
    // Cliente tem serviço TV mas não tem tvSetup (campos não preenchidos)
    // Apenas loga, não faz nada - o serviço já foi salvo
    console.warn(`[handleTvServiceForClient] ⚠️ Cliente ${clientId} tem serviço TV mas tvSetup não foi fornecido:`, {
      serviceNames: services.map(s => s.name),
      serviceIds,
      selectionsCount: selections.length,
    });
    console.warn(`[handleTvServiceForClient] ⚠️ Serviço será salvo sem acessos configurados. Para criar acessos, preencha vendedor e vencimento ao criar o cliente.`);
  } else if (!hasTv) {
    // Cliente não tem serviço TV, libera slots se houver
    console.log(`[handleTvServiceForClient] ℹ️ Cliente ${clientId} não tem serviço TV. Liberando slots se houver.`);
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

  try {
    // Primeiro sincroniza os serviços (salva os relacionamentos cliente-serviço)
    console.log(`[POST /api/clients] Sincronizando ${selections.length} serviço(s) para cliente ${data.id}`);
    await syncClientServices(data.id, selections);
    console.log(`[POST /api/clients] ✅ ${selections.length} serviço(s) sincronizado(s) com sucesso`);
    
    // Depois tenta processar configurações especiais (TV, Cloud)
    // Os acessos serão gerados automaticamente se tvSetup estiver preenchido
    try {
      console.log("[POST /api/clients] 🔄 Processando configurações especiais:", {
        clientId: data.id,
        tvSetupPresent: !!tvSetup,
        tvSetupContent: tvSetup ? JSON.stringify(tvSetup, null, 2) : "ausente",
        cloudSetupsCount: cloudSetups ? cloudSetups.length : 0,
        selectionsCount: selections.length,
        serviceIds: selections.map(s => s.serviceId),
      });
      await handleTvServiceForClient(data.id, selections, tvSetup);
      console.log("[POST /api/clients] ✅ Configurações de TV processadas com sucesso para cliente", data.id);
    } catch (tvError) {
      // Verificar se é erro de schema (tabela não existe)
      // Verificar pelos códigos de schema do Supabase
      const schemaCodes = ["PGRST200", "PGRST201", "PGRST202", "PGRST203", "PGRST204", "PGRST205"];
      const isSchemaError = 
        tvError && 
        typeof tvError === "object" && 
        "code" in tvError &&
        schemaCodes.includes((tvError as { code?: string }).code ?? "");
      
      // Verificar se é HttpError 503 - verificar propriedades diretamente (instanceof pode falhar em produção)
      const isHttpError503 = 
        (tvError instanceof HttpError && tvError.status === 503) ||
        (tvError && 
         typeof tvError === "object" &&
         "status" in tvError &&
         (tvError as { status?: number }).status === 503);
      
      // Verificar também pela mensagem de erro
      const errorMessage = tvError instanceof Error ? tvError.message : String(tvError);
      const isSchemaErrorMessage = errorMessage.includes("Schema de TV") || errorMessage.includes("schema.sql");
      
      if (isSchemaError || isHttpError503 || isSchemaErrorMessage) {
        console.warn("[POST /api/clients] ⚠️ Schema de TV não disponível, cliente será salvo sem acessos de TV");
        // Não lança erro, apenas continua sem configurar TV
        // O cliente será salvo normalmente, apenas sem acessos de TV
      } else {
        // Outro tipo de erro, propaga
        console.error("[POST /api/clients] ❌ Erro ao processar TV:", tvError);
        throw tvError;
      }
    }
    
    await syncCloudAccesses(data.id, selectedServiceIdsList, cloudSetups ?? []);
  } catch (syncError) {
    // Se falhar ao sincronizar serviços, deleta o cliente criado
    try {
      await supabase.from("clients").delete().eq("id", data.id);
    } catch (deleteError) {
      console.error("[POST /api/clients] Erro ao deletar cliente após falha na sincronização:", deleteError);
    }
    throw syncError;
  }

  const refreshed = await fetchClientSummary(data.id);

  return NextResponse.json(refreshed, { status: 201 });
});

