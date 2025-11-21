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

    if (indexA === null && indexB === null) return emailA.localeCompare(emailB);
    if (indexA === null) return 1;
    if (indexB === null) return -1;
    if (indexA !== indexB) return indexA - indexB;

    const slotA = a.slot_number ?? 0;
    const slotB = b.slot_number ?? 0;
    return slotA - slotB;
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
    // 1. Tenta achar slot livre - busca slots DISPONÍVEIS e que nunca foram usados (sem histórico de ASSIGNED)
    const { data: allSlots, error: fetchError } = await supabase
      .from("tv_slots")
      .select("*, tv_accounts(*)")
      .eq("status", "AVAILABLE")
      .is("client_id", null);

    if (fetchError && !isSchemaMissing(fetchError)) throw fetchError;

    if (allSlots && allSlots.length > 0) {
      // Ordena todos os slots disponíveis por email e slot_number (garante ordem consistente)
      // Não filtra por histórico - se está AVAILABLE e sem cliente, pode usar
      // Isso garante que sempre pegue o primeiro disponível, independente de ter sido usado antes
      const sorted = sortSlotsByEmail(allSlots);
      const firstAvailable = sorted[0];
      console.log(`[ensureAvailableSlotExists] Slot selecionado: ${firstAvailable.tv_accounts?.email} #${firstAvailable.slot_number}`);
      return firstAvailable;
    }

    // 2. Se não tem, cria nova conta
    const emails = await fetchExistingEmails(supabase);
    
    let nextIndex = 0;
    if (emails.length > 0) {
       const indices = emails.map(parseEmailIndex).filter(i => i !== null) as number[];
       if (indices.length > 0) {
         nextIndex = Math.max(...indices) + 1;
       }
    }
    
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
