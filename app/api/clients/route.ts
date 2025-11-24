import { NextResponse } from "next/server";
import { z } from "zod";
import { createApiHandler } from "@/lib/utils/apiHandler";
import { createServerClient } from "@/lib/supabase/server";
import { HttpError } from "@/lib/utils/httpError";
import { PostgrestError } from "@supabase/supabase-js";
import { mapClientRow, clientInsertPayload } from "@/lib/utils/mappers";
import { assignMultipleSlotsToClient, assignSlotToClient, releaseSlotsForClient } from "@/lib/services/tvAssignments";
import { TVPlanType } from "@/types";

type ServiceSelection = {
  serviceId: string;
  customPrice?: number | null;
};

const costCenterSchema = z.enum(["LUXUS", "NEXUS"]);

const clientSchema = z.object({
  name: z.string().min(1, "O nome do cliente é obrigatório"),
  email: z.string().email("Email inválido"),
  phone: z.string().optional(),
  document: z.string().min(5, "Documento muito curto"),
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

// Funções auxiliares não usadas removidas
// function documentLengthPattern(length: number) { return "_".repeat(length); }
// function isUniqueViolation(error: PostgrestError) { return error.code === "23505"; }

async function syncClientServices(clientId: string, selections: ServiceSelection[]) {
  console.log(`[syncClientServices] Iniciando para cliente ${clientId}, serviços:`, JSON.stringify(selections));
  // Usa Service Role Key para garantir que services sejam salvos independente de RLS
  const supabase = createServerClient(true);
  const uniqueSelections = new Map<string, ServiceSelection>();
  selections.forEach((selection) => {
    if (selection?.serviceId) {
      uniqueSelections.set(selection.serviceId, selection);
    }
  });

  console.log(`[syncClientServices] IDs únicos a salvar:`, Array.from(uniqueSelections.keys()));

  const { error: deleteError } = await supabase.from("client_services").delete().eq("client_id", clientId);
  if (deleteError) {
    console.error(`[syncClientServices] Erro ao deletar serviços anteriores:`, deleteError);
    if (isSchemaMissing(deleteError)) {
      console.warn(
        "[syncClientServices] Tabela client_services indisponível. Execute as migrações do Supabase para habilitar a gestão de serviços.",
      );
      return;
    }
    throw deleteError;
  }

  if (!uniqueSelections.size) {
    console.log(`[syncClientServices] Nenhum serviço para inserir.`);
    return;
  }

  const rows = Array.from(uniqueSelections.values()).map((selection) => ({
    client_id: clientId,
    service_id: selection.serviceId,
    custom_price: selection.customPrice ?? null,
    // sold_by: selection.soldBy // TODO: Adicionar coluna no banco
  }));

  console.log(`[syncClientServices] Inserindo ${rows.length} linhas:`, JSON.stringify(rows));

  const { error: insertError } = await supabase.from("client_services").insert(rows);

  if (insertError) {
    console.error(`[syncClientServices] ❌ ERRO CRÍTICO ao inserir serviços:`, JSON.stringify(insertError));
    if (isSchemaMissing(insertError)) {
      console.warn("[syncClientServices] Erro de schema ignorado (mas impediu salvamento)");
      return;
    }
    // Lança o erro para vermos no log do Vercel
    const errorMsg = (insertError as any).message || String(insertError);
    const errorCode = (insertError as any).code || "UNKNOWN";
    throw new Error(`Erro ao salvar serviços: ${errorMsg} (${errorCode})`);
  }
  console.log(`[syncClientServices] ✅ Sucesso! Serviços salvos.`);
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

  if (error && !isSchemaMissing(error)) throw error;

  return Boolean(data);
}

async function handleTvServiceForClient(
  clientId: string,
  selections: ServiceSelection[] = [],
  tvSetup?: z.infer<typeof tvSetupSchema>,
) {
  const serviceIds = selections.map((selection) => selection.serviceId);
  const services = await fetchServicesByIds(serviceIds);
  
  // Detectar serviço TV (case insensitive)
  const hasTv = services.some((service) => (service.name ?? "").toLowerCase().includes("tv"));
  
  // Determinar planType baseado no serviço selecionado
  const tvService = services.find((service) => (service.name ?? "").toLowerCase().includes("tv"));
  
  const planTypeFromService =
    tvService?.name?.toLowerCase().includes("premium") ? ("PREMIUM" as TVPlanType) : ("ESSENCIAL" as TVPlanType);

  if (!hasTv) {
    // Se não tem TV, libera slots se houver
    await releaseSlotsForClient(clientId);
    return;
  }

  // Se tem TV, verifica se já tem acessos
  const alreadyAssigned = await clientHasTvAssignment(clientId);
  if (alreadyAssigned) {
    return;
  }

  // Se não tem acessos, CRIA AGORA
  console.log("[handleTvServiceForClient] Criando acessos de TV para cliente", clientId);

  // Dados padrão
  let soldBy = "Sistema";
  let expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 30);
  let expiresAtStr = expiresAt.toISOString().slice(0, 10);
  let quantity = 1;
  let planType: TVPlanType = planTypeFromService ?? "ESSENCIAL";
  let notes: string | undefined = undefined;
  let hasTelephony: boolean | undefined = undefined;
  let soldAt: string | undefined = undefined;
  let startsAt: string | undefined = undefined;

  // Sobrescreve com dados do tvSetup se existirem
  if (tvSetup) {
    if (tvSetup.soldBy?.trim()) soldBy = tvSetup.soldBy.trim();
    
    if (tvSetup.expiresAt?.trim()) {
        const raw = tvSetup.expiresAt.trim();
        // Converte DD/MM/YYYY para YYYY-MM-DD se necessário
        if (raw.includes("/")) {
            const p = raw.split("/");
            if (p.length === 3) expiresAtStr = `${p[2]}-${p[1]}-${p[0]}`;
        } else if (raw.includes("-")) {
            expiresAtStr = raw;
        }
    }

    if (tvSetup.quantity) {
        const q = typeof tvSetup.quantity === 'string' ? parseInt(tvSetup.quantity) : tvSetup.quantity;
        if (q > 0) quantity = q;
    }

    if (tvSetup.planType) planType = tvSetup.planType;
    if (tvSetup.notes) notes = tvSetup.notes;
    if (tvSetup.hasTelephony !== undefined) hasTelephony = tvSetup.hasTelephony;
    if (tvSetup.soldAt) soldAt = tvSetup.soldAt;
    if (tvSetup.startsAt) startsAt = tvSetup.startsAt;
  }

  const params = {
      clientId,
      soldBy,
      soldAt,
      startsAt,
      expiresAt: expiresAtStr,
      notes,
      planType,
      hasTelephony
  };

  try {
      if (quantity > 1) {
          await assignMultipleSlotsToClient({ ...params, quantity });
      } else {
          await assignSlotToClient(params);
      }
      console.log("[handleTvServiceForClient] ✅ Sucesso ao criar TV");
  } catch (e) {
      console.error("[handleTvServiceForClient] ❌ Falha ao criar TV", e);
      // Não lança erro para não quebrar a criação do cliente
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
      // Não bloqueia mais, apenas ignora
      // const missingNames = services
      //   .filter((s) => missing.includes(s.id))
      //   .map((s) => s.name)
      //   .join(", ");
      // throw new HttpError(400, `Informe o vencimento para os seguintes serviços: ${missingNames}`);
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

  const existingServiceIds = new Set((existingData ?? []).map((row) => row.service_id));
  const currentServiceIds = new Set(setupMap.keys());
  
  // Apenas processa se tivermos IDs de serviço válidos no setup
  if (currentServiceIds.size === 0) return;

  const toAdd = Array.from(currentServiceIds).filter((id) => !existingServiceIds.has(id) && cloudServiceIdsSet.has(id));
  const toRemove = Array.from(existingServiceIds).filter((id) => !currentServiceIds.has(id) && selectedSet && !selectedSet.has(id));

  if (toRemove.length) {
    await supabase.from("cloud_accesses").delete().eq("client_id", clientId).in("service_id", toRemove);
  }

  if (toAdd.length) {
    const rows = toAdd.map((serviceId) => {
      const config = setupMap.get(serviceId)!;
      let expiresAt = config.expiresAt;
      // Converte DD/MM/YYYY para YYYY-MM-DD
      if (expiresAt.includes("/")) {
          const p = expiresAt.split("/");
          if (p.length === 3) expiresAt = `${p[2]}-${p[1]}-${p[0]}`;
      }

      return {
        client_id: clientId,
        service_id: serviceId,
        expires_at: expiresAt,
        is_test: config.isTest,
        notes: config.notes?.trim() || null,
      };
    });

    const { error: insertError } = await supabase.from("cloud_accesses").insert(rows);
    if (insertError && !isSchemaMissing(insertError)) {
      throw insertError;
    }
  }
}

async function fetchClientSummary(clientId: string) {
  const supabase = createServerClient();
  const { data, error } = await supabase
    .from("clients")
    .select("*, client_services(*, service:services(*))")
    .eq("id", clientId)
    .single();

  if (error) throw error;

  const assignmentsMap = await fetchTvAssignmentsForClients([clientId]);
  const assignments = assignmentsMap.get(clientId) ?? [];

  return {
    ...mapClientRow(data),
    tvAssignments: assignments,
  };
}

export const GET = createApiHandler(async (req) => {
  const url = new URL(req.url);
  const id = url.searchParams.get("id");
  const search = url.searchParams.get("search")?.trim();
  const hasTelephonyFilter = url.searchParams.get("hasTelephony"); // "ALL" | "WITH_TELEPHONY"

  const supabase = createServerClient();

  if (id) {
    const summary = await fetchClientSummary(id);
    return NextResponse.json(summary);
  }

  let query = supabase
    .from("clients")
    .select("*, client_services(*, service:services(*))", { count: "exact" })
    .order("created_at", { ascending: false });

  if (search) {
    const digits = search.replace(/\D/g, "");
    if (digits.length >= 3) {
      query = query.or(`document.ilike.%${digits}%,phone.ilike.%${digits}%`);
    } else {
      query = query.ilike("name", `%${search}%`);
    }
  }
  
  // Se precisar filtrar por telefonia, precisamos fazer uma query mais complexa ou filtrar em memória
  // Como client_services é 1:N, filtrar clients por uma propriedade de services é chato no Supabase direto
  // Vamos simplificar e trazer os dados, filtrando se necessário, mas idealmente filtraríamos no banco
  // Por enquanto, vamos ignorar o filtro no banco e confiar que o frontend filtre visualmente ou implemente depois
  
  const { data, error, count } = await query.limit(100); // Limite de segurança

  if (error) {
    if (isSchemaMissing(error)) {
        return NextResponse.json({ data: [], total: 0 });
    }
    throw error;
  }

  const clients = (data ?? []).map(mapClientRow);

  // Se houver filtro de telefonia, aplicamos aqui (menos eficiente, mas funcional)
  let filteredClients = clients;
  if (hasTelephonyFilter === "WITH_TELEPHONY") {
      // Precisamos buscar os slots para saber quem tem telefonia
      const clientIds = clients.map(c => c.id);
      const assignmentsMap = await fetchTvAssignmentsForClients(clientIds);
      
      filteredClients = clients.filter(client => {
          const assignments = assignmentsMap.get(client.id) ?? [];
          return assignments.some(a => a.hasTelephony);
      });
  } else {
      // Popula assignments para todos (opcional, mas bom para a lista)
      const clientIds = clients.map(c => c.id);
      const assignmentsMap = await fetchTvAssignmentsForClients(clientIds);
      filteredClients.forEach(client => {
          client.tvAssignments = assignmentsMap.get(client.id) ?? [];
      });
  }

  return NextResponse.json({
    data: filteredClients,
    total: hasTelephonyFilter === "WITH_TELEPHONY" ? filteredClients.length : count,
  });
});

export const POST = createApiHandler(async (req) => {
  const body = await req.json();
  
  console.log("[POST /api/clients] Payload recebido:", JSON.stringify({
    name: body.name,
    serviceIds: body.serviceIds,
    serviceSelectionsCount: body.serviceSelections?.length,
    tvSetup: body.tvSetup,
    hasTvSetup: !!body.tvSetup
  }, null, 2));

  const validation = clientCreateSchema.safeParse(body);

  if (!validation.success) {
    throw new HttpError(400, "Dados inválidos: " + validation.error.message);
  }

  const data = validation.data;
  const supabase = createServerClient();

  // Verifica duplicidade
  const document = sanitizeDocument(data.document);
  const { data: existing } = await supabase
    .from("clients")
    .select("id")
    .eq("document", document)
    .maybeSingle();

  if (existing) {
    throw new HttpError(409, "Já existe um cliente com este documento.");
  }

  // Prepara payload
  const payload = clientInsertPayload({
    ...data,
    document,
  });
  
  // Adiciona opened_by se disponível (remova se a coluna não existir no banco ainda)
  // if (data.openedBy) {
  //     (payload as any).opened_by = data.openedBy;
  // }

  // 1. Cria Cliente
  const { data: newClient, error: createError } = await supabase
    .from("clients")
    .insert(payload)
    .select()
    .single();

  if (createError) {
    throw createError;
  }

  try {
    // Garante que selections tenha todos os IDs, combinando serviceSelections e serviceIds
    const selections = [...(data.serviceSelections ?? [])];
    const existingIds = new Set(selections.map(s => s.serviceId));
    
    if (data.serviceIds?.length) {
        data.serviceIds.forEach(id => {
            if (!existingIds.has(id)) {
                selections.push({ serviceId: id });
                existingIds.add(id);
            }
        });
    }
    
    console.log("[POST] Sincronizando serviços (final):", selections.length, JSON.stringify(selections));

    // 2. Salva Serviços
    await syncClientServices(newClient.id, selections);

    // 3. Processa TV (Cria acessos se necessário)
    if (selections.length > 0) {
        console.log("[POST] Iniciando processamento de TV...");
        await handleTvServiceForClient(newClient.id, selections, data.tvSetup);
    } else {
        console.warn("[POST] Nenhum serviço selecionado, pulando configuração de TV");
    }

    // 4. Processa Cloud
    if (data.cloudSetups) {
        await syncCloudAccesses(newClient.id, data.serviceIds, data.cloudSetups);
    }

  } catch (error) {
      console.error("Erro no pós-processamento do cliente:", error);
      // Não deleta o cliente, permite que o usuário tente corrigir editando
  }

  // Pequeno delay para garantir consistência de leitura após escrita
  await new Promise(r => setTimeout(r, 500));

  const result = await fetchClientSummary(newClient.id);
  return NextResponse.json(result, { status: 201 });
});
