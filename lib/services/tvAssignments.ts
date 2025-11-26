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

function sortSlotsByEmail(slots: any[]) {
  return [...slots].sort((a, b) => {
    const emailA = a.tv_accounts?.email ?? "";
    const emailB = b.tv_accounts?.email ?? "";
    const indexA = parseEmailIndex(emailA);
    const indexB = parseEmailIndex(emailB);

    // Primeiro: ordena por índice do email (menor primeiro)
    if (indexA === null && indexB === null) return emailA.localeCompare(emailB);
    if (indexA === null) return 1; // Sem índice vai para o final
    if (indexB === null) return -1; // Sem índice vai para o final
    if (indexA !== indexB) return indexA - indexB; // Menor índice primeiro

    // Segundo: se mesmo email, ordena por slot_number (menor primeiro)
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

async function createAccountBatch(supabase: any, index: number): Promise<boolean> {
  const { email } = buildEmail(index);
  
  // 1. Cria a conta
  const { data: insertedAccount, error: insertAccountError } = await supabase
    .from("tv_accounts")
    .insert({ email })
    .select("id")
    .maybeSingle();

  if (insertAccountError) {
    if (insertAccountError.code === "23505") return false; // Já existe
    if (!isSchemaMissing(insertAccountError)) throw insertAccountError;
    return false;
  }

  if (!insertedAccount) return false;

  // 2. Cria os 8 slots para a conta
  const slotsToInsert = Array.from({ length: USERS_PER_ACCOUNT }, (_, i) => ({
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
      // Ordena todos os slots disponíveis por email e slot_number (garante ordem consistente)
      // Isso garante que sempre pegue o primeiro disponível na ordem numérica (1a8 primeiro)
      const sorted = sortSlotsByEmail(allSlots);
      
      // PRIORIDADE: Sempre tentar usar slots do primeiro email (1a8) primeiro
      const firstEmail = buildEmail(0).email; // 1a8@nexusrs.com.br
      const firstEmailSlot = sorted.find((slot) => slot.tv_accounts?.email === firstEmail);
      
      if (firstEmailSlot) {
        console.log(`[ensureAvailableSlotExists] ✅ Slot encontrado no primeiro email (prioridade): ${firstEmailSlot.tv_accounts?.email} #${firstEmailSlot.slot_number}`);
        return firstEmailSlot;
      }
      
      // Se não há slots no primeiro email, usa o primeiro disponível ordenado
      // Log para debug: mostra os primeiros 5 slots ordenados
      console.log(`[ensureAvailableSlotExists] Total de slots disponíveis: ${sorted.length}`);
      console.log(`[ensureAvailableSlotExists] Primeiros 5 slots ordenados:`);
      sorted.slice(0, 5).forEach((slot, idx) => {
        console.log(`  [${idx}] ${slot.tv_accounts?.email} #${slot.slot_number} (index: ${parseEmailIndex(slot.tv_accounts?.email ?? "")})`);
      });
      
      const firstAvailable = sorted[0];
      console.log(`[ensureAvailableSlotExists] ✅ Slot selecionado: ${firstAvailable.tv_accounts?.email} #${firstAvailable.slot_number}`);
      return firstAvailable;
    }

    // 2. Se não tem slots disponíveis, verifica se existe o primeiro email (1a8)
    // Se não existir, cria começando do índice 0 (1a8)
    const emails = await fetchExistingEmails(supabase);
    
    // Verifica se o primeiro email (1a8) existe
    const firstEmail = buildEmail(0).email; // 1a8@nexusrs.com.br
    const hasFirstEmail = emails.includes(firstEmail);
    
    let nextIndex = 0; // Sempre começa do 0 (1a8) se não existir
    if (!hasFirstEmail) {
      // Se não existe o primeiro email, cria ele
      console.log(`[ensureAvailableSlotExists] Primeiro email (${firstEmail}) não existe. Criando...`);
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
          console.log(`[ensureAvailableSlotExists] ✅ Slot encontrado no primeiro email: ${firstEmailSlots[0].tv_accounts?.email} #${firstEmailSlots[0].slot_number}`);
          return firstEmailSlots[0];
        }
      }
      
      // Se não há slots no primeiro email, procura o próximo índice disponível
      const indices = emails.map(parseEmailIndex).filter(i => i !== null) as number[];
      if (indices.length > 0) {
        // Encontra o menor índice que não tem todos os slots ocupados
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
              console.log(`[ensureAvailableSlotExists] ✅ Slot encontrado em email existente: ${emailSlots[0].tv_accounts?.email} #${emailSlots[0].slot_number}`);
              return emailSlots[0];
            }
          }
        }
        
        // Se todos os emails existentes estão cheios, cria o próximo
        nextIndex = Math.max(...sortedIndices) + 1;
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
