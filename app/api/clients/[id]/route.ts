import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createApiHandler } from "@/lib/utils/apiHandler";
import { createServerClient } from "@/lib/supabase/server";
import { HttpError } from "@/lib/utils/httpError";
import { PostgrestError } from "@supabase/supabase-js";
import { mapClientRow, mapContractRow, clientUpdatePayload } from "@/lib/utils/mappers";
import { assignMultipleSlotsToClient, assignSlotToClient, releaseSlotsForClient } from "@/lib/services/tvAssignments";
import { TVPlanType } from "@/types";

type ServiceSelection = {
  serviceId: string;
  customPrice?: number | null;
  customPriceEssencial?: number | null; // Preço específico para TV Essencial (fragmento do serviço TV)
  customPricePremium?: number | null; // Preço específico para TV Premium (fragmento do serviço TV)
  soldBy?: string | null; // Vendedor que cadastrou o serviço
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
  customPriceEssencial: z.number().min(0).nullable().optional(), // Preço específico para TV Essencial
  customPricePremium: z.number().min(0).nullable().optional(), // Preço específico para TV Premium
  soldBy: z.string().min(1).nullable().optional(), // Vendedor que cadastrou o serviço
});

const tvPlanTypeSchema = z.enum(["ESSENCIAL", "PREMIUM"]);

const tvSetupSchema = z
  .object({
    quantity: z.number().int().min(1).max(50).optional(), // Mantido para compatibilidade
    planType: tvPlanTypeSchema.optional(), // Mantido para compatibilidade
    quantityEssencial: z.number().int().min(0).max(50).optional(),
    quantityPremium: z.number().int().min(0).max(50).optional(),
    customEmail: z.string().email().optional(), // Email personalizado (cria conta com 1 slot exclusivo)
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

const clientUpdateSchema = clientSchema.partial().extend({
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
    custom_price_essencial: selection.customPriceEssencial ?? null,
    custom_price_premium: selection.customPricePremium ?? null,
    sold_by: selection.soldBy ?? null,
  }));

  const { error: insertError } = await supabase.from("client_services").insert(rows);

  if (insertError) {
    if (isSchemaMissing(insertError)) {
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
  
  // Determinar planType baseado no serviço selecionado
  const tvService = services.find((service) => service.name?.toLowerCase().includes("tv"));
  
  const planTypeFromService =
    tvService?.name?.toLowerCase().includes("premium") ? ("PREMIUM" as TVPlanType) : ("ESSENCIAL" as TVPlanType);

  if (hasTv && tvSetup) {
    // Verificar se os campos obrigatórios para criar acessos estão preenchidos
    const hasSoldBy = tvSetup.soldBy && tvSetup.soldBy.trim();
    const hasExpiresAt = tvSetup.expiresAt && tvSetup.expiresAt.trim().length >= 8;
    
    // Só cria/atualiza acessos se os campos obrigatórios estiverem preenchidos
    if (hasSoldBy && hasExpiresAt) {
      const supabase = createServerClient();
      
      // Buscar slots atuais separados por tipo
      const { data: allCurrentSlots, error: countError } = await supabase
        .from("tv_slots")
        .select("id, plan_type")
        .eq("client_id", clientId)
        .eq("status", "ASSIGNED");
      
      if (countError && !isSchemaMissing(countError)) {
        throw countError;
      }
      
      // Determinar quantidades desejadas (nova API com quantidades separadas ou antiga API)
      let desiredEssencial = 0;
      let desiredPremium = 0;
      
      if (tvSetup.quantityEssencial !== undefined || tvSetup.quantityPremium !== undefined) {
        // Nova API: quantidades separadas
        desiredEssencial = Number.isFinite(tvSetup.quantityEssencial) && tvSetup.quantityEssencial !== undefined && tvSetup.quantityEssencial >= 0 
          ? Math.min(50, tvSetup.quantityEssencial) : 0;
        desiredPremium = Number.isFinite(tvSetup.quantityPremium) && tvSetup.quantityPremium !== undefined && tvSetup.quantityPremium >= 0
          ? Math.min(50, tvSetup.quantityPremium) : 0;
      } else if (tvSetup.quantity !== undefined) {
        // API antiga: quantidade única com planType
        const planType: TVPlanType = tvSetup?.planType ?? planTypeFromService ?? "ESSENCIAL";
        const totalQuantity = Number.isFinite(tvSetup.quantity) && tvSetup.quantity > 0 ? Math.min(50, tvSetup.quantity) : 1;
        if (planType === "PREMIUM") {
          desiredPremium = totalQuantity;
        } else {
          desiredEssencial = totalQuantity;
        }
      }
      
      // Contar quantidades atuais
      const currentEssencial = (allCurrentSlots ?? []).filter((s) => (s.plan_type ?? "ESSENCIAL") === "ESSENCIAL").length;
      const currentPremium = (allCurrentSlots ?? []).filter((s) => s.plan_type === "PREMIUM").length;
      
      const soldAt =
        tvSetup?.soldAt && tvSetup.soldAt.length === 10
          ? new Date(`${tvSetup.soldAt}T12:00:00`).toISOString()
          : tvSetup?.soldAt ?? undefined;
      const soldBy = tvSetup.soldBy.trim();
      
      // Processar ESSENCIAL
      if (desiredEssencial !== currentEssencial) {
        if (desiredEssencial > currentEssencial) {
          // Adicionar mais acessos ESSENCIAL
          const toAdd = desiredEssencial - currentEssencial;
          
          // Se customEmail foi fornecido, usar apenas para o primeiro acesso
          if (tvSetup?.customEmail && toAdd === 1 && currentEssencial === 0) {
            // Primeiro acesso com email personalizado
            await assignSlotToClient({
              clientId,
              soldBy,
              soldAt,
              startsAt: tvSetup?.startsAt ?? undefined,
              expiresAt: tvSetup.expiresAt,
              notes: tvSetup?.notes?.trim() || undefined,
              planType: "ESSENCIAL",
              hasTelephony: tvSetup?.hasTelephony ?? undefined,
              customEmail: tvSetup.customEmail,
            });
          } else if (toAdd === 1) {
            // Apenas 1 acesso - usar assignSlotToClient diretamente
            await assignSlotToClient({
              clientId,
              soldBy,
              soldAt,
              startsAt: tvSetup?.startsAt ?? undefined,
              expiresAt: tvSetup.expiresAt,
              notes: tvSetup?.notes?.trim() || undefined,
              planType: "ESSENCIAL",
              hasTelephony: tvSetup?.hasTelephony ?? undefined,
            });
          } else if (toAdd === 2) {
            // 2 acessos - criar sequencialmente
            await assignSlotToClient({
              clientId,
              soldBy,
              soldAt,
              startsAt: tvSetup?.startsAt ?? undefined,
              expiresAt: tvSetup.expiresAt,
              notes: tvSetup?.notes?.trim() || undefined,
              planType: "ESSENCIAL",
              hasTelephony: tvSetup?.hasTelephony ?? undefined,
            });
            await assignSlotToClient({
              clientId,
              soldBy,
              soldAt,
              startsAt: tvSetup?.startsAt ?? undefined,
              expiresAt: tvSetup.expiresAt,
              notes: tvSetup?.notes?.trim() || undefined,
              planType: "ESSENCIAL",
              hasTelephony: tvSetup?.hasTelephony ?? undefined,
            });
          } else {
            // Múltiplos acessos (3 ou mais)
            await assignMultipleSlotsToClient({
              clientId,
              soldBy,
              soldAt,
              startsAt: tvSetup?.startsAt ?? undefined,
              expiresAt: tvSetup.expiresAt,
              notes: tvSetup?.notes?.trim() || undefined,
              planType: "ESSENCIAL",
              hasTelephony: tvSetup?.hasTelephony ?? undefined,
              quantity: toAdd,
            });
          }
        } else {
          // Remover acessos ESSENCIAL extras
          const toRemove = currentEssencial - desiredEssencial;
          const { data: slotsToRemove } = await supabase
            .from("tv_slots")
            .select("id")
            .eq("client_id", clientId)
            .eq("status", "ASSIGNED")
            .or("plan_type.is.null,plan_type.eq.ESSENCIAL")
            .order("created_at", { ascending: false })
            .limit(toRemove);
          
          if (slotsToRemove && slotsToRemove.length > 0) {
            const slotIds = slotsToRemove.map((s) => s.id);
            const { error: releaseError } = await supabase
              .from("tv_slots")
              .update({
                client_id: null,
                status: "AVAILABLE",
                sold_by: null,
                sold_at: null,
                starts_at: new Date().toISOString().slice(0, 10),
                expires_at: null,
                notes: null,
                plan_type: null,
              })
              .in("id", slotIds);
            
            if (releaseError && !isSchemaMissing(releaseError)) {
              throw releaseError;
            }
          }
        }
      }
      
      // Processar PREMIUM
      if (desiredPremium !== currentPremium) {
        if (desiredPremium > currentPremium) {
          // Adicionar mais acessos PREMIUM
          const toAdd = desiredPremium - currentPremium;
          
          // Se customEmail foi fornecido, usar apenas para o primeiro acesso
          if (tvSetup?.customEmail && toAdd === 1 && currentPremium === 0) {
            // Primeiro acesso com email personalizado
            await assignSlotToClient({
              clientId,
              soldBy,
              soldAt,
              startsAt: tvSetup?.startsAt ?? undefined,
              expiresAt: tvSetup.expiresAt,
              notes: tvSetup?.notes?.trim() || undefined,
              planType: "PREMIUM",
              hasTelephony: tvSetup?.hasTelephony ?? undefined,
              customEmail: tvSetup.customEmail,
            });
          } else if (toAdd === 1) {
            // Apenas 1 acesso - usar assignSlotToClient diretamente
            await assignSlotToClient({
              clientId,
              soldBy,
              soldAt,
              startsAt: tvSetup?.startsAt ?? undefined,
              expiresAt: tvSetup.expiresAt,
              notes: tvSetup?.notes?.trim() || undefined,
              planType: "PREMIUM",
              hasTelephony: tvSetup?.hasTelephony ?? undefined,
            });
          } else if (toAdd === 2) {
            // 2 acessos - criar sequencialmente
            await assignSlotToClient({
              clientId,
              soldBy,
              soldAt,
              startsAt: tvSetup?.startsAt ?? undefined,
              expiresAt: tvSetup.expiresAt,
              notes: tvSetup?.notes?.trim() || undefined,
              planType: "PREMIUM",
              hasTelephony: tvSetup?.hasTelephony ?? undefined,
            });
            await assignSlotToClient({
              clientId,
              soldBy,
              soldAt,
              startsAt: tvSetup?.startsAt ?? undefined,
              expiresAt: tvSetup.expiresAt,
              notes: tvSetup?.notes?.trim() || undefined,
              planType: "PREMIUM",
              hasTelephony: tvSetup?.hasTelephony ?? undefined,
            });
          } else {
            // Múltiplos acessos (3 ou mais)
            await assignMultipleSlotsToClient({
              clientId,
              soldBy,
              soldAt,
              startsAt: tvSetup?.startsAt ?? undefined,
              expiresAt: tvSetup.expiresAt,
              notes: tvSetup?.notes?.trim() || undefined,
              planType: "PREMIUM",
              hasTelephony: tvSetup?.hasTelephony ?? undefined,
              quantity: toAdd,
            });
          }
        } else {
          // Remover acessos PREMIUM extras
          const toRemove = currentPremium - desiredPremium;
          const { data: slotsToRemove } = await supabase
            .from("tv_slots")
            .select("id")
            .eq("client_id", clientId)
            .eq("status", "ASSIGNED")
            .eq("plan_type", "PREMIUM")
            .order("created_at", { ascending: false })
            .limit(toRemove);
          
          if (slotsToRemove && slotsToRemove.length > 0) {
            const slotIds = slotsToRemove.map((s) => s.id);
            const { error: releaseError } = await supabase
              .from("tv_slots")
              .update({
                client_id: null,
                status: "AVAILABLE",
                sold_by: null,
                sold_at: null,
                starts_at: new Date().toISOString().slice(0, 10),
                expires_at: null,
                notes: null,
                plan_type: null,
              })
              .in("id", slotIds);
            
            if (releaseError && !isSchemaMissing(releaseError)) {
              throw releaseError;
            }
          }
        }
      }
      
      // Atualizar informações dos slots existentes (vendedor, datas, etc) para ambos os tipos
      const { error: updateError } = await supabase
        .from("tv_slots")
        .update({
          sold_by: soldBy,
          sold_at: soldAt,
          starts_at: tvSetup?.startsAt ?? undefined,
          expires_at: tvSetup.expiresAt,
          notes: tvSetup?.notes?.trim() || null,
          has_telephony: tvSetup?.hasTelephony ?? null,
        })
        .eq("client_id", clientId)
        .eq("status", "ASSIGNED");
      
      if (updateError && !isSchemaMissing(updateError)) {
        throw updateError;
      }
    }
    // Se campos não estão preenchidos, simplesmente não cria acessos (não dá erro)
  } else if (!hasTv) {
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

  // Só exige configuração para serviços Cloud que não têm acesso existente
  if (selectedSet && selectedSet.size > 0) {
    const cloudServiceIds = Array.from(selectedSet).filter((id) => cloudServiceIdsSet.has(id));
    const missing = cloudServiceIds.filter((serviceId) => !setupMap.has(serviceId) && !existingIds.has(serviceId));
    if (missing.length) {
      const missingNames = services
        .filter((s) => missing.includes(s.id))
        .map((s) => s.name)
        .join(", ");
      throw new HttpError(400, `Informe o vencimento para os seguintes serviços: ${missingNames}`);
    }
  }

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
    "*, client_services:client_services(custom_price, custom_price_essencial, custom_price_premium, service:services(*)), cloud_accesses:cloud_accesses(id, client_id, service_id, expires_at, is_test, notes, created_at, updated_at, service:services(*))";
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

export const GET = createApiHandler(async (req, { params }) => {
  const supabase = createServerClient();
  const { data, error } = await supabase
    .from("clients")
    .select(
      "*, contracts(*), client_services:client_services(custom_price, custom_price_essencial, custom_price_premium, service:services(*)), cloud_accesses:cloud_accesses(id, client_id, service_id, expires_at, is_test, notes, created_at, updated_at, service:services(*))",
    )
    .eq("id", params.id)
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!data) {
    throw new HttpError(404, "Cliente não encontrado");
  }

  const client = mapClientRow(data);
  const contracts = Array.isArray(data.contracts) ? data.contracts.map(mapContractRow) : [];
  const assignments = await fetchTvAssignmentsForClients([client.id], { includeHistory: true });
  client.tvAssignments = assignments.get(client.id) ?? [];

  return NextResponse.json({ ...client, contracts });
});

export const PUT = createApiHandler(
  async (req, { params }) => {
    const supabase = createServerClient();
    const body = await req.json();
    const payload = clientUpdateSchema.parse(body);
    const { serviceIds, serviceSelections, tvSetup, cloudSetups, ...clientData } = payload;
    if (clientData.document !== undefined) {
      clientData.document = sanitizeDocument(clientData.document);
    }
    const updatePayload = clientUpdatePayload(clientData);
    const { data, error } = await supabase
      .from("clients")
      .update(updatePayload)
      .eq("id", params.id)
      .select("id")
      .maybeSingle();

    if (error) {
      if (isUniqueViolation(error)) {
        throw new HttpError(409, "Documento já cadastrado.");
      }
      throw error;
    }

    if (!data) {
      throw new HttpError(404, "Cliente não encontrado");
    }

    if (serviceSelections !== undefined || serviceIds !== undefined) {
      const selections: ServiceSelection[] =
        serviceSelections ??
        (serviceIds ?? []).map((serviceId) => ({
          serviceId,
          customPrice: null,
        }));
      const selectedServiceIdsList = selections.map((selection) => selection.serviceId);
      await syncClientServices(data.id, selections);
      await handleTvServiceForClient(data.id, selections, tvSetup);
      await syncCloudAccesses(data.id, selectedServiceIdsList, cloudSetups ?? []);
    } else if (cloudSetups) {
      await syncCloudAccesses(data.id, undefined, cloudSetups);
    }

    const refreshed = await fetchClientSummary(data.id);

    return NextResponse.json(refreshed);
  },
  { requireAdmin: true }
);

export const DELETE = createApiHandler(
  async (req, { params }) => {
    const supabase = createServerClient();
    const { error } = await supabase.from("clients").delete().eq("id", params.id);

    if (error) {
      throw error;
    }

    return new NextResponse(null, { status: 204 });
  },
  { requireAdmin: true }
);





