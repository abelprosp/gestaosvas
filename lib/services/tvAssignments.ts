import { PostgrestError } from "@supabase/supabase-js";
import { createServerClient as createSupabaseClient } from "@/lib/supabase/server";
import { generateNumericPassword } from "@/lib/utils/password";
import { HttpError } from "@/lib/utils/httpError";
import { mapTVSlotRow } from "@/lib/utils/mappers";
import { TVPlanType } from "@/types";

const USERS_PER_ACCOUNT = 8;
const TV_EMAIL_DOMAIN = "nexusrs.com.br";
const MAX_BULK_ASSIGN_QUANTITY = 50;
const MAX_RETRY_ATTEMPTS = 5;
const RETRY_DELAY_MS = 100;

const SCHEMA_ERROR_CODES = new Set(["PGRST200", "PGRST201", "PGRST202", "PGRST203", "PGRST204", "PGRST205"]);

export interface AssignSlotParams {
  clientId: string;
  soldBy?: string | null;
  soldAt?: string | null;
  expiresAt?: string | null;
  notes?: string | null;
  startsAt?: string | null;
  planType?: TVPlanType | null;
  hasTelephony?: boolean | null;
  customEmail?: string | null; // Email personalizado (cria conta com 1 slot exclusivo)
}

export interface AssignMultipleSlotParams extends AssignSlotParams {
  quantity: number;
}

function isSchemaMissing(error: PostgrestError): boolean {
  return Boolean(error?.code && SCHEMA_ERROR_CODES.has(error.code));
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// --- Funções Auxiliares de Email ---

function parseEmailIndex(email: string): number | null {
  const [localPart] = email.split("@");
  const match = /^([0-9]+)a([0-9]+)$/.exec(localPart ?? "");
  if (!match) return null;
  const start = Number(match[1]);
  if (!Number.isFinite(start) || start < 1) {
    return null;
  }
  return Math.floor((start - 1) / USERS_PER_ACCOUNT);
}

function buildEmail(index: number) {
  const start = index * USERS_PER_ACCOUNT + 1;
  const end = start + USERS_PER_ACCOUNT - 1;
  return {
    email: `${start}a${end}@${TV_EMAIL_DOMAIN}`,
    start,
  };
}

// Verifica se um email é padrão (formato XaY@nexusrs.com.br)
function isStandardEmail(email: string): boolean {
  return /^\d+a\d+@nexusrs\.com\.br$/.test(email);
}

function sortSlotsByEmail(slots: any[]) {
  return [...slots].sort((a, b) => {
    const emailA = a.tv_accounts?.email ?? "";
    const emailB = b.tv_accounts?.email ?? "";
    const indexA = parseEmailIndex(emailA);
    const indexB = parseEmailIndex(emailB);
    const isStandardA = isStandardEmail(emailA);
    const isStandardB = isStandardEmail(emailB);

    // PRIORIDADE 1: Emails padrão sempre vêm antes de emails personalizados
    if (isStandardA && !isStandardB) return -1;
    if (!isStandardA && isStandardB) return 1;

    // PRIORIDADE 2: Entre emails padrão, ordena por índice (menor primeiro)
    if (isStandardA && isStandardB) {
      if (indexA === null && indexB === null) return emailA.localeCompare(emailB);
      if (indexA === null) return 1;
      if (indexB === null) return -1;
      if (indexA !== indexB) return indexA - indexB; // Menor índice primeiro
    }

    // PRIORIDADE 3: Se mesmo email, ordena por slot_number (menor primeiro)
    const slotA = a.slot_number ?? 0;
    const slotB = b.slot_number ?? 0;
    return slotA - slotB; // Menor slot primeiro
  });
}

// --- Núcleo da Lógica (Service Role Key ALWAYS) ---

async function fetchExistingEmails(supabase: any): Promise<string[]> {
  const { data, error } = await supabase.from("tv_accounts").select("email");
  if (error && !isSchemaMissing(error)) throw error;
  return (data ?? []).map((account: any) => account.email);
}

// Busca apenas emails padrão (ignora personalizados)
async function fetchStandardEmails(supabase: any): Promise<string[]> {
  const emails = await fetchExistingEmails(supabase);
  return emails.filter(email => isStandardEmail(email));
}

async function createAccountBatch(supabase: any, index: number): Promise<boolean> {
  const { email } = buildEmail(index);
  
  // 1. Cria a conta com max_slots padrão (8)
  const { data: insertedAccount, error: insertAccountError } = await supabase
    .from("tv_accounts")
    .insert({ email, max_slots: USERS_PER_ACCOUNT })
    .select("id, max_slots")
    .maybeSingle();

  if (insertAccountError) {
    if (insertAccountError.code === "23505") return false; // Já existe
    if (!isSchemaMissing(insertAccountError)) throw insertAccountError;
    return false;
  }

  if (!insertedAccount) return false;

  // 2. Cria os slots para a conta respeitando max_slots
  const maxSlots = insertedAccount.max_slots ?? USERS_PER_ACCOUNT;
  const slotsToInsert = Array.from({ length: maxSlots }, (_, i) => ({
    tv_account_id: insertedAccount.id,
    slot_number: i + 1,
    username: `#${i + 1}`, // Formato: #1, #2, #3, etc.
    status: "AVAILABLE",
    password: generateNumericPassword(),
  }));

  const { error: slotInsertError } = await supabase.from("tv_slots").insert(slotsToInsert);
  if (slotInsertError && !isSchemaMissing(slotInsertError)) throw slotInsertError;

  return true;
}

// Cria conta com email personalizado (1 slot exclusivo)
async function createCustomEmailAccount(supabase: any, customEmail: string): Promise<any> {
  const email = customEmail.toLowerCase().trim();
  
  // 1. Verificar se a conta já existe
  const { data: existingAccount, error: checkError } = await supabase
    .from("tv_accounts")
    .select("id, email, tv_slots(id, status, client_id)")
    .eq("email", email)
    .maybeSingle();

  if (checkError && !isSchemaMissing(checkError)) {
    throw checkError;
  }

  // 2. Se existe, verificar se tem slot disponível
  if (existingAccount) {
    const { data: slots } = await supabase
      .from("tv_slots")
      .select("id, status, client_id")
      .eq("tv_account_id", existingAccount.id)
      .eq("status", "AVAILABLE")
      .is("client_id", null)
      .limit(1);

    if (slots && slots.length > 0) {
      // Buscar slot completo
      const { data: fullSlot } = await supabase
        .from("tv_slots")
        .select("*, tv_accounts(*)")
        .eq("id", slots[0].id)
        .single();
      
      return fullSlot;
    }
    
    // Se não tem slot disponível, a conta já está em uso
    throw new HttpError(409, `A conta com email ${email} já está em uso (todos os slots atribuídos)`);
  }

  // 3. Criar nova conta com 1 slot exclusivo
  const { data: insertedAccount, error: insertAccountError } = await supabase
    .from("tv_accounts")
    .insert({ email })
    .select("id")
    .single();

  if (insertAccountError) {
    if (insertAccountError.code === "23505") {
      // Race condition: outro processo criou a conta, buscar novamente
      const { data: account } = await supabase
        .from("tv_accounts")
        .select("id")
        .eq("email", email)
        .single();
      
      if (account) {
        const { data: slot } = await supabase
          .from("tv_slots")
          .select("*, tv_accounts(*)")
          .eq("tv_account_id", account.id)
          .eq("status", "AVAILABLE")
          .is("client_id", null)
          .limit(1)
          .single();
        
        if (slot) return slot;
      }
    }
    throw insertAccountError;
  }

  if (!insertedAccount) {
    throw new HttpError(500, "Falha ao criar conta com email personalizado");
  }

  // 4. Criar 1 slot exclusivo
  const { data: insertedSlot, error: slotInsertError } = await supabase
    .from("tv_slots")
    .insert({
      tv_account_id: insertedAccount.id,
      slot_number: 1,
      username: "#1",
      status: "AVAILABLE",
      password: generateNumericPassword(),
    })
    .select("*, tv_accounts(*)")
    .single();

  if (slotInsertError) {
    // Se falhar ao criar slot, remover a conta criada
    await supabase.from("tv_accounts").delete().eq("id", insertedAccount.id);
    throw slotInsertError;
  }

  return insertedSlot;
}

export async function ensureAvailableSlotExists() {
  const supabase = createSupabaseClient(true); // SERVICE ROLE KEY

  for (let attempt = 0; attempt < MAX_RETRY_ATTEMPTS; attempt++) {
    // 1. Tenta achar slot livre - busca slots DISPONÍVEIS ordenados por email e slot_number
    // Ordena explicitamente por email (ascendente) e depois por slot_number (ascendente) para garantir ordem numérica correta
    const { data: allSlots, error: fetchError } = await supabase
      .from("tv_slots")
      .select("*, tv_accounts(*)")
      .eq("status", "AVAILABLE")
      .is("client_id", null)
      .order("email", { ascending: true, foreignTable: "tv_accounts" })
      .order("slot_number", { ascending: true });

    if (fetchError && !isSchemaMissing(fetchError)) throw fetchError;

    if (allSlots && allSlots.length > 0) {
      // FILTRAR: Apenas slots de emails padrão (ignorar emails personalizados)
      const standardSlots = allSlots.filter((slot) => 
        isStandardEmail(slot.tv_accounts?.email ?? "")
      );
      
      if (standardSlots.length > 0) {
        // Ordena slots padrão por email e slot_number (garante ordem consistente)
        const sorted = sortSlotsByEmail(standardSlots);
        
        // PRIORIDADE: Sempre tentar usar slots do primeiro email padrão (1a8) primeiro
        const firstEmail = buildEmail(0).email; // 1a8@nexusrs.com.br
        const firstEmailSlot = sorted.find((slot) => slot.tv_accounts?.email === firstEmail);
        
        if (firstEmailSlot) {
          console.log(`[ensureAvailableSlotExists] ✅ Slot encontrado no primeiro email padrão (prioridade): ${firstEmailSlot.tv_accounts?.email} #${firstEmailSlot.slot_number}`);
          return firstEmailSlot;
        }
        
        // Se não há slots no primeiro email, usa o primeiro disponível ordenado (sempre padrão)
        const firstAvailable = sorted[0];
        console.log(`[ensureAvailableSlotExists] ✅ Slot selecionado (padrão): ${firstAvailable.tv_accounts?.email} #${firstAvailable.slot_number}`);
        return firstAvailable;
      }
      // Se não há slots padrão disponíveis, continua para criar novo email padrão
    }

    // 2. Se não tem slots disponíveis, verifica emails padrão existentes e cria o próximo na sequência
    // IMPORTANTE: Ignora emails personalizados, apenas trabalha com sequência padrão
    const standardEmails = await fetchStandardEmails(supabase);
    
    // Verifica se o primeiro email padrão (1a8) existe
    const firstEmail = buildEmail(0).email; // 1a8@nexusrs.com.br
    const hasFirstEmail = standardEmails.includes(firstEmail);
    
    let nextIndex = 0; // Sempre começa do 0 (1a8) se não existir
    if (!hasFirstEmail) {
      // Se não existe o primeiro email padrão, cria ele
      console.log(`[ensureAvailableSlotExists] Primeiro email padrão (${firstEmail}) não existe. Criando...`);
      const created = await createAccountBatch(supabase, 0);
      if (created) {
        // Após criar, busca novamente os slots disponíveis
        await sleep(RETRY_DELAY_MS);
        continue;
      }
    } else {
      // Se o primeiro email existe, busca a conta e verifica se há slots disponíveis
      const { data: firstAccount, error: firstAccountError } = await supabase
        .from("tv_accounts")
        .select("id")
        .eq("email", firstEmail)
        .maybeSingle();
      
      if (!firstAccountError && firstAccount) {
        // Busca slots disponíveis do primeiro email
        const { data: firstEmailSlots, error: firstEmailError } = await supabase
          .from("tv_slots")
          .select("*, tv_accounts(*)")
          .eq("status", "AVAILABLE")
          .is("client_id", null)
          .eq("tv_account_id", firstAccount.id)
          .order("slot_number", { ascending: true })
          .limit(1);
        
        if (!firstEmailError && firstEmailSlots && firstEmailSlots.length > 0) {
          // Se há slots disponíveis no primeiro email, usa ele
          console.log(`[ensureAvailableSlotExists] ✅ Slot encontrado no primeiro email padrão: ${firstEmailSlots[0].tv_accounts?.email} #${firstEmailSlots[0].slot_number}`);
          return firstEmailSlots[0];
        }
      }
      
      // Se não há slots no primeiro email, procura o próximo índice padrão disponível
      // Extrai apenas índices de emails padrão (ignora personalizados)
      const indices = standardEmails
        .map(parseEmailIndex)
        .filter(i => i !== null) as number[];
      
      if (indices.length > 0) {
        // Encontra o menor índice padrão que não tem todos os slots ocupados
        const sortedIndices = [...new Set(indices)].sort((a, b) => a - b);
        
        for (const idx of sortedIndices) {
          const email = buildEmail(idx).email;
          const { data: account, error: accountError } = await supabase
            .from("tv_accounts")
            .select("id")
            .eq("email", email)
            .maybeSingle();
          
          if (!accountError && account) {
            const { data: emailSlots, error: emailError } = await supabase
              .from("tv_slots")
              .select("*, tv_accounts(*)")
              .eq("status", "AVAILABLE")
              .is("client_id", null)
              .eq("tv_account_id", account.id)
              .limit(1);
            
            if (!emailError && emailSlots && emailSlots.length > 0) {
              console.log(`[ensureAvailableSlotExists] ✅ Slot encontrado em email padrão existente: ${emailSlots[0].tv_accounts?.email} #${emailSlots[0].slot_number}`);
              return emailSlots[0];
            }
          }
        }
        
        // Se todos os emails padrão existentes estão cheios, cria o próximo na sequência
        nextIndex = Math.max(...sortedIndices) + 1;
        console.log(`[ensureAvailableSlotExists] Todos os emails padrão existentes estão cheios. Próximo índice: ${nextIndex} (${buildEmail(nextIndex).email})`);
      }
    }
    
    // Cria nova conta no índice calculado
    console.log(`[ensureAvailableSlotExists] Criando nova conta no índice ${nextIndex} (${buildEmail(nextIndex).email})`);
    const created = await createAccountBatch(supabase, nextIndex);
    if (!created) {
      await sleep(RETRY_DELAY_MS * (attempt + 1));
      continue;
    }
  }

  throw new HttpError(500, "Não foi possível encontrar ou criar um slot de TV disponível.");
}

export async function assignSlotToClient(params: AssignSlotParams) {
  console.log(`[assignSlotToClient] Iniciando atribuição para cliente ${params.clientId}`);
  const supabase = createSupabaseClient(true); // SERVICE ROLE KEY

  // Se customEmail foi fornecido, criar conta com email personalizado (1 slot exclusivo)
  if (params.customEmail) {
    console.log(`[assignSlotToClient] Email personalizado fornecido: ${params.customEmail}`);
    let slot;
    try {
      slot = await createCustomEmailAccount(supabase, params.customEmail);
      if (!slot) {
        throw new HttpError(500, "Não foi possível criar conta com email personalizado");
      }
      console.log(`[assignSlotToClient] Conta personalizada criada/encontrada: ${slot.tv_accounts?.email} #${slot.slot_number}`);
    } catch (error) {
      console.error(`[assignSlotToClient] Erro ao criar/buscar conta personalizada:`, error);
      throw error;
    }
    
    // Atribuir o slot ao cliente
    const soldAt = params.soldAt ?? new Date().toISOString();
    const startsAt = params.startsAt && params.startsAt.trim() ? params.startsAt : new Date().toISOString().slice(0, 10);
    const password = generateNumericPassword();

    console.log(`[assignSlotToClient] Tentando atualizar slot ${slot.id} para cliente ${params.clientId}`);
    
    const { data: updatedSlot, error: updateError } = await supabase
      .from("tv_slots")
      .update({
        status: "ASSIGNED",
        client_id: params.clientId,
        password,
        sold_by: params.soldBy ?? null,
        sold_at: soldAt,
        starts_at: startsAt,
        expires_at: params.expiresAt ?? null,
        notes: params.notes ?? null,
        plan_type: params.planType ?? null,
        has_telephony: params.hasTelephony ?? null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", slot.id)
      .eq("status", "AVAILABLE")
      .is("client_id", null)
      .select("*, tv_accounts(*)")
      .maybeSingle();

    if (updateError) {
      console.error(`[assignSlotToClient] Erro ao atualizar slot:`, updateError);
      throw updateError;
    }

    if (!updatedSlot) {
      throw new HttpError(409, "Slot já foi atribuído por outro processo");
    }

    // Registrar histórico
    await supabase.from("tv_slot_history").insert({
      tv_slot_id: updatedSlot.id,
      action: "ASSIGNED",
      metadata: { clientId: params.clientId, customEmail: params.customEmail },
    });

    return mapTVSlotRow(updatedSlot);
  }

  // Lógica padrão: buscar slot dos emails padrão
  for (let attempt = 0; attempt < MAX_RETRY_ATTEMPTS; attempt++) {
    console.log(`[assignSlotToClient] Tentativa ${attempt + 1}/${MAX_RETRY_ATTEMPTS}`);
    
    let slot;
    try {
      slot = await ensureAvailableSlotExists();
      if (!slot) {
        console.error(`[assignSlotToClient] ensureAvailableSlotExists retornou null/undefined`);
        throw new HttpError(500, "Não foi possível encontrar um slot disponível");
      }
      console.log(`[assignSlotToClient] Slot encontrado: ${slot.id} (${slot.tv_accounts?.email} #${slot.slot_number})`);
    } catch (error) {
      console.error(`[assignSlotToClient] Erro ao buscar slot disponível:`, error);
      throw error;
    }
    
    const soldAt = params.soldAt ?? new Date().toISOString();
    const startsAt = params.startsAt && params.startsAt.trim() ? params.startsAt : new Date().toISOString().slice(0, 10);
    const password = generateNumericPassword();

    console.log(`[assignSlotToClient] Tentando atualizar slot ${slot.id} para cliente ${params.clientId}`);
    
    // Tenta reservar o slot atomicamente
    const { data: updatedSlot, error: updateError } = await supabase
      .from("tv_slots")
      .update({
        status: "ASSIGNED",
        client_id: params.clientId,
        password,
        sold_by: params.soldBy ?? null,
        sold_at: soldAt,
        starts_at: startsAt,
        expires_at: params.expiresAt ?? null,
        notes: params.notes ?? null,
        plan_type: params.planType ?? null,
        has_telephony: params.hasTelephony ?? null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", slot.id)
      .eq("status", "AVAILABLE") // Garante que ainda está livre
      .is("client_id", null)
      .select("*, tv_accounts(*)")
      .maybeSingle();

    if (updateError) {
       console.error(`[assignSlotToClient] Erro ao atualizar slot:`, updateError);
       if (isSchemaMissing(updateError)) {
         console.warn(`Schema de TV ausente ou erro de permissão: ${updateError.code} - ${updateError.message}`);
         throw updateError; 
       }
       throw updateError;
    }

    if (!updatedSlot) {
      // Alguém pegou esse slot antes de nós, tenta de novo
      console.warn(`[assignSlotToClient] Slot ${slot.id} já foi atribuído por outro processo. Tentando novamente...`);
      await sleep(RETRY_DELAY_MS);
      continue;
    }

    console.log(`[assignSlotToClient] Slot atualizado com sucesso: ${updatedSlot.id}`);

    // Registra histórico
    const { error: historyError } = await supabase.from("tv_slot_history").insert({
      tv_slot_id: slot.id,
      action: "ASSIGNED",
      metadata: {
        clientId: params.clientId,
        soldBy: params.soldBy,
        soldAt,
        expiresAt: params.expiresAt
      },
    });

    if (historyError) {
      console.warn(`[assignSlotToClient] Erro ao registrar histórico (não crítico):`, historyError);
      // Não lança erro - histórico é opcional
    }

    const mapped = mapTVSlotRow(updatedSlot);
    console.log(`[assignSlotToClient] ✅ Sucesso! Slot atribuído: ${mapped.id}`);
    return mapped;
  }

  console.error(`[assignSlotToClient] ❌ Falha após ${MAX_RETRY_ATTEMPTS} tentativas`);
  throw new HttpError(500, "Falha ao atribuir slot de TV: concorrência alta ou erro no sistema.");
}

export async function assignMultipleSlotsToClient(params: AssignMultipleSlotParams) {
  const { quantity, ...rest } = params;
  const results = [];
  for (let i = 0; i < quantity; i++) {
    const slot = await assignSlotToClient(rest);
    results.push(slot);
  }
  return results;
}

export async function releaseSlotsForClient(clientId: string) {
  const supabase = createSupabaseClient(true); // SERVICE ROLE KEY
  
  const { data: slots } = await supabase.from("tv_slots").select("id").eq("client_id", clientId);
  if (!slots?.length) return;

  for (const slot of slots) {
    await supabase
      .from("tv_slots")
      .update({
        status: "USED", // Marca como usado para não reutilizar imediatamente (opcional, pode ser AVAILABLE)
        client_id: null,
        sold_by: null,
        sold_at: null,
        expires_at: null,
        notes: null,
        password: generateNumericPassword(),
        plan_type: null,
        has_telephony: null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", slot.id);
      
    await supabase.from("tv_slot_history").insert({
      tv_slot_id: slot.id,
      action: "RELEASED",
      metadata: { reason: "CLIENT_REMOVED_OR_SERVICE_CANCELLED" }
    });
  }
}

export async function randomizeAllTvPasswords() {
    const supabase = createSupabaseClient(true);
    const { data: slots } = await supabase.from("tv_slots").select("id");
    if (!slots) return;
    
    for (const slot of slots) {
        await supabase.from("tv_slots").update({
            password: generateNumericPassword(),
            updated_at: new Date().toISOString()
        }).eq("id", slot.id);
    }
}

export async function ensureSlotPoolReady() {
    await ensureAvailableSlotExists();
}

/**
 * Limpa todos os slots TV e reseta para começar do 1a8
 * ATENÇÃO: Esta função remove TODAS as atribuições de clientes dos slots
 * Use com cuidado em produção!
 */
export async function resetTvSlotsToStart() {
    const supabase = createSupabaseClient(true); // SERVICE ROLE KEY
    
    console.log("[resetTvSlotsToStart] Iniciando limpeza de slots TV...");
    
    // 1. Marca todos os slots como AVAILABLE e remove client_id
    const { data: allSlots, error: fetchError } = await supabase
        .from("tv_slots")
        .select("id, client_id, status")
        .neq("status", "AVAILABLE")
        .or("client_id.not.is.null");
    
    if (fetchError && !isSchemaMissing(fetchError)) {
        console.error("[resetTvSlotsToStart] Erro ao buscar slots:", fetchError);
        throw fetchError;
    }
    
    if (allSlots && allSlots.length > 0) {
        console.log(`[resetTvSlotsToStart] Encontrados ${allSlots.length} slots para limpar`);
        
        // Atualiza todos os slots para AVAILABLE e remove client_id
        const { error: updateError } = await supabase
            .from("tv_slots")
            .update({
                status: "AVAILABLE",
                client_id: null,
                sold_by: null,
                sold_at: null,
                expires_at: null,
                notes: null,
                password: generateNumericPassword(), // Gera nova senha
                plan_type: null,
                has_telephony: null,
                updated_at: new Date().toISOString(),
            })
            .neq("status", "AVAILABLE")
            .or("client_id.not.is.null");
        
        if (updateError && !isSchemaMissing(updateError)) {
            console.error("[resetTvSlotsToStart] Erro ao atualizar slots:", updateError);
            throw updateError;
        }
        
        console.log(`[resetTvSlotsToStart] ✅ ${allSlots.length} slots resetados para AVAILABLE`);
    } else {
        console.log("[resetTvSlotsToStart] Nenhum slot para limpar");
    }
    
    // 2. Verifica se o primeiro email (1a8) existe, se não, cria
    const emails = await fetchExistingEmails(supabase);
    const firstEmail = buildEmail(0).email; // 1a8@nexusrs.com.br
    
    if (!emails.includes(firstEmail)) {
        console.log(`[resetTvSlotsToStart] Criando primeiro email: ${firstEmail}`);
        const created = await createAccountBatch(supabase, 0);
        if (created) {
            console.log(`[resetTvSlotsToStart] ✅ Primeiro email criado com sucesso`);
        } else {
            console.warn(`[resetTvSlotsToStart] ⚠️ Não foi possível criar o primeiro email (pode já existir)`);
        }
    } else {
        console.log(`[resetTvSlotsToStart] Primeiro email (${firstEmail}) já existe`);
    }
    
    console.log("[resetTvSlotsToStart] ✅ Limpeza concluída. Sistema pronto para começar do 1a8");
    return { success: true, slotsReset: allSlots?.length ?? 0 };
}
