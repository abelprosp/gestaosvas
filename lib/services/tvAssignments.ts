import { PostgrestError } from "@supabase/supabase-js";
import { createServerClient as createSupabaseClient } from "@/lib/supabase/server";
import { generateNumericPassword } from "@/lib/utils/password";
import { HttpError } from "@/lib/utils/httpError";
import { mapTVSlotRow } from "@/lib/utils/mappers";
import { TVPlanType } from "@/types";

const USERS_PER_ACCOUNT = 8;
const TOTAL_USERS_TARGET = 5000;
const MAX_ACCOUNT_INDEX = Math.ceil(TOTAL_USERS_TARGET / USERS_PER_ACCOUNT) - 1;
const TV_EMAIL_DOMAIN = "nexusrs.com.br";
const MAX_BULK_ASSIGN_QUANTITY = 50;
const MAX_RETRY_ATTEMPTS = 5;
const RETRY_DELAY_MS = 100;

const SCHEMA_ERROR_CODES = new Set(["PGRST200", "PGRST201", "PGRST202", "PGRST203", "PGRST204", "PGRST205"]);
const UNIQUE_VIOLATION_CODE = "23505";

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

function isUniqueViolation(error: PostgrestError): boolean {
  return error?.code === UNIQUE_VIOLATION_CODE;
}

function handleSchemaError(error: PostgrestError): never {
  if (isSchemaMissing(error)) {
    throw new HttpError(
      503,
      "Funcionalidade de TV indisponível. Execute o script supabase/schema.sql e atualize o cache do Supabase.",
    );
  }
  throw error;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function buildEmail(index: number) {
  const start = index * USERS_PER_ACCOUNT + 1;
  const end = start + USERS_PER_ACCOUNT - 1;
  return {
    email: `${start}a${end}@${TV_EMAIL_DOMAIN}`,
    start,
  };
}

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

async function fetchExistingEmails(): Promise<string[]> {
  const supabase = createSupabaseClient();
  const { data, error } = await supabase.from("tv_accounts").select("email");

  if (error) {
    handleSchemaError(error as PostgrestError);
  }

  return (data ?? []).map((account) => account.email);
}

async function determineNextAccountIndex(existingEmails: string[]): Promise<number> {
  if (!existingEmails.length) {
    return 0;
  }

  const used = new Set(existingEmails.map((email) => parseEmailIndex(email)).filter((index) => index !== null) as number[]);

  let index = 0;
  while (used.has(index)) {
    index += 1;
  }

  if (index > MAX_ACCOUNT_INDEX) {
    throw new HttpError(409, "Limite máximo de contas de TV atingido.");
  }

  return index;
}

async function createAccountBatch(index: number): Promise<boolean> {
  const supabase = createSupabaseClient();
  const { email, start } = buildEmail(index);

  const { data: insertedAccount, error: insertAccountError } = await supabase
    .from("tv_accounts")
    .insert({ email })
    .select("id")
    .maybeSingle();

  // Se houver erro de unique violation, significa que outro processo já criou esta conta
  if (insertAccountError) {
    if (isUniqueViolation(insertAccountError as PostgrestError)) {
      // Outro processo criou esta conta simultaneamente - não é erro, apenas conflito
      return false;
    }
    handleSchemaError(insertAccountError as PostgrestError);
  }

  const accountId = insertedAccount?.id;
  if (!accountId) {
    throw new Error(`Falha ao criar conta de TV para ${email}`);
  }

  const slotPayload = Array.from({ length: USERS_PER_ACCOUNT }, (_, idx) => {
    const slotNumber = idx + 1;
    const username = String(start + idx);
    return {
      tv_account_id: accountId,
      slot_number: slotNumber,
      username,
      password: generateNumericPassword(),
      status: "AVAILABLE",
      client_id: null,
      sold_by: null,
      sold_at: null,
      expires_at: null,
      notes: null,
      plan_type: null,
    };
  });

  const { error: slotInsertError } = await supabase.from("tv_slots").insert(slotPayload);

  if (slotInsertError) {
    handleSchemaError(slotInsertError as PostgrestError);
  }

  return true;
}

async function fetchAvailableSlot() {
  // Busca slots disponíveis que NUNCA foram atribuídos a um cliente
  // Para isso, verificamos se não há histórico de "ASSIGNED" para este slot
  const supabase = createSupabaseClient(true);
  const { data: allSlots, error: fetchError } = await supabase
    .from("tv_slots")
    .select("*, tv_accounts(*)")
    .eq("status", "AVAILABLE")
    .is("client_id", null);

  if (fetchError) {
    handleSchemaError(fetchError as PostgrestError);
  }

  if (!allSlots || allSlots.length === 0) {
    return null;
  }

  // Verifica quais slots nunca foram atribuídos (não têm histórico de ASSIGNED)
  const slotIds = allSlots.map((slot) => slot.id);
  const { data: assignedHistory, error: historyError } = await supabase
    .from("tv_slot_history")
    .select("tv_slot_id")
    .eq("action", "ASSIGNED")
    .in("tv_slot_id", slotIds);

  if (historyError && !isSchemaMissing(historyError as PostgrestError)) {
    // Se o histórico não existe ainda, ordena e retorna o primeiro slot disponível
    const sorted = sortSlotsByEmail(allSlots);
    return sorted[0] ?? null;
  }

  // Cria um Set com IDs de slots que já foram atribuídos
  const usedSlotIds = new Set((assignedHistory ?? []).map((h) => h.tv_slot_id));

  // Filtra slots nunca atribuídos e ordena numericamente por email e slot_number
  const availableSlots = allSlots.filter((slot) => !usedSlotIds.has(slot.id));
  const sorted = sortSlotsByEmail(availableSlots);

  // Retorna o primeiro slot que nunca foi atribuído (ordenado numericamente)
  return sorted[0] ?? null;
}

function sortSlotsByEmail(slots: any[]) {
  // Ordena os slots numericamente por email e slot_number
  // Para garantir que "1a8@nexusrs.com.br" venha antes de "9a16@nexusrs.com.br"
  return [...slots].sort((a, b) => {
    const emailA = a.tv_accounts?.email ?? "";
    const emailB = b.tv_accounts?.email ?? "";

    // Extrai o índice da conta do email (ex: "1a8" -> índice 0, "9a16" -> índice 1)
    const indexA = parseEmailIndex(emailA);
    const indexB = parseEmailIndex(emailB);

    // Se um índice é null, coloca no final
    if (indexA === null && indexB === null) {
      return emailA.localeCompare(emailB);
    }
    if (indexA === null) return 1;
    if (indexB === null) return -1;

    // Compara primeiro pelo índice da conta (numérico)
    if (indexA !== indexB) {
      return indexA - indexB;
    }

    // Se for a mesma conta, ordena pelo slot_number
    const slotA = a.slot_number ?? 0;
    const slotB = b.slot_number ?? 0;
    return slotA - slotB;
  });
}

export async function ensureAvailableSlotExists() {
  const supabase = createSupabaseClient(true);
  // Tenta múltiplas vezes para lidar com race conditions
  for (let attempt = 0; attempt < MAX_RETRY_ATTEMPTS; attempt += 1) {
    // Primeiro, tenta buscar um slot disponível
    const slot = await fetchAvailableSlot();
    if (slot) {
      return slot;
    }

    // Se não há slots disponíveis, tenta criar uma nova conta
    const emails = await fetchExistingEmails();
    const nextIndex = await determineNextAccountIndex(emails);

    // Tenta criar a conta - retorna false se houver conflito (outro processo já criou)
    const created = await createAccountBatch(nextIndex);

    // Se criou com sucesso ou houve conflito, busca novamente por slots disponíveis
    // (outro processo pode ter criado slots enquanto tentávamos criar)
    const createdSlot = await fetchAvailableSlot();
    if (createdSlot) {
      return createdSlot;
    }

    // Se não encontrou slot e houve conflito, espera um pouco e tenta novamente
    if (!created) {
      await sleep(RETRY_DELAY_MS * (attempt + 1)); // Backoff exponencial
      continue;
    }

    // Se criou mas não encontrou slot, algo deu errado
    throw new HttpError(500, "Falha ao gerar um novo acesso de TV.");
  }

  // Após todas as tentativas, tenta uma última vez buscar um slot
  const finalSlot = await fetchAvailableSlot();
  if (finalSlot) {
    return finalSlot;
  }

  throw new HttpError(500, "Falha ao gerar um novo acesso de TV após múltiplas tentativas. Tente novamente.");
}

export async function assignSlotToClient(params: AssignSlotParams) {
  // Usa Service Role Key para garantir permissão de escrita na tabela tv_slots (operação de sistema)
  const supabase = createSupabaseClient(true);
  // Tenta múltiplas vezes para lidar com race conditions ao atribuir slots
  for (let attempt = 0; attempt < MAX_RETRY_ATTEMPTS; attempt += 1) {
    const slot = await ensureAvailableSlotExists();

    // Verifica se o slot ainda está disponível antes de atribuir
    // Isso previne que dois processos atribuam o mesmo slot simultaneamente
    const { data: slotCheck, error: checkError } = await supabase
      .from("tv_slots")
      .select("id, status, client_id")
      .eq("id", slot.id)
      .maybeSingle();

    if (checkError) {
      handleSchemaError(checkError as PostgrestError);
    }

    // Se o slot já foi atribuído por outro processo, tenta novamente
    if (!slotCheck || slotCheck.status !== "AVAILABLE" || slotCheck.client_id !== null) {
      if (attempt < MAX_RETRY_ATTEMPTS - 1) {
        await sleep(RETRY_DELAY_MS * (attempt + 1));
        continue;
      }
      // Na última tentativa, tenta buscar um novo slot
      continue;
    }

    const soldAt = params.soldAt ?? new Date().toISOString();
    let startsAt: string | null;
    if (params.startsAt !== undefined) {
      startsAt = params.startsAt && params.startsAt.trim().length ? params.startsAt : null;
    } else {
      startsAt = new Date().toISOString().slice(0, 10);
    }
    const password = generateNumericPassword();

    // Atualiza apenas se o slot ainda estiver disponível (proteção contra race condition)
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
      .eq("status", "AVAILABLE") // Garante que só atualiza se ainda estiver disponível
      .is("client_id", null) // Garante que só atualiza se não tiver cliente
      .select("*, tv_accounts(*)")
      .maybeSingle();

    if (updateError) {
      handleSchemaError(updateError as PostgrestError);
    }

    // Se não atualizou (porque outro processo já atribuiu), tenta novamente
    if (!updatedSlot) {
      if (attempt < MAX_RETRY_ATTEMPTS - 1) {
        await sleep(RETRY_DELAY_MS * (attempt + 1));
        continue;
      }
      throw new HttpError(500, "Falha ao atualizar slot de TV. O slot pode ter sido atribuído por outro processo.");
    }

    const { error: historyError } = await supabase.from("tv_slot_history").insert({
      tv_slot_id: slot.id,
      action: "ASSIGNED",
      metadata: {
        clientId: params.clientId,
        soldBy: params.soldBy ?? null,
        soldAt,
        expiresAt: params.expiresAt ?? null,
        notes: params.notes ?? null,
      },
    });

    if (historyError && !isSchemaMissing(historyError as PostgrestError)) {
      throw historyError;
    }

    return mapTVSlotRow(updatedSlot);
  }

  throw new HttpError(500, "Falha ao atribuir slot de TV após múltiplas tentativas. Tente novamente.");
}

export async function assignMultipleSlotsToClient(params: AssignMultipleSlotParams) {
  // A função assignSlotToClient já usa createSupabaseClient(true), então não precisamos aqui
  // Mas se precisarmos de validações extras, garantimos o uso do service role
  const { quantity, ...rest } = params;
  if (!Number.isFinite(quantity) || quantity < 1) {
    throw new HttpError(400, "Quantidade inválida. Informe um número maior ou igual a 1.");
  }

  if (quantity > MAX_BULK_ASSIGN_QUANTITY) {
    throw new HttpError(400, `Quantidade máxima por vez é ${MAX_BULK_ASSIGN_QUANTITY} acessos.`);
  }

  const results = [];
  for (let i = 0; i < quantity; i += 1) {
    const slot = await assignSlotToClient(rest);
    results.push(slot);
  }
  return results;
}

export async function releaseSlotsForClient(clientId: string) {
  const supabase = createSupabaseClient(true);
  const { data: slots, error } = await supabase
    .from("tv_slots")
    .select("id")
    .eq("client_id", clientId);

  if (error) {
    handleSchemaError(error as PostgrestError);
  }

  if (!slots?.length) {
    return;
  }

  for (const slot of slots) {
    const password = generateNumericPassword();
    // Marca como "USED" ao invés de "AVAILABLE" para que não seja reutilizado
    const { data: released, error: releaseError } = await supabase
      .from("tv_slots")
      .update({
        status: "USED", // Marca como usado, não disponível
        client_id: null,
        sold_by: null,
        sold_at: null,
        expires_at: null,
        notes: null,
        password,
        plan_type: null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", slot.id)
      .select("id")
      .maybeSingle();

    if (releaseError) {
      handleSchemaError(releaseError as PostgrestError);
    }

    if (released) {
      const { error: historyError } = await supabase.from("tv_slot_history").insert({
        tv_slot_id: slot.id,
        action: "RELEASED",
        metadata: { reason: "SERVICE_REMOVED" },
      });

      if (historyError && !isSchemaMissing(historyError as PostgrestError)) {
        throw historyError;
      }
    }
  }
}

export async function ensureSlotPoolReady() {
  await ensureAvailableSlotExists();
}

export async function randomizeAllTvPasswords() {
  const supabase = createSupabaseClient(true);
  try {
    const { data, error } = await supabase.from("tv_slots").select("id");
    if (error) {
      if (isSchemaMissing(error)) {
        return;
      }
      throw error;
    }

    const slots = data ?? [];
    for (const slot of slots) {
      const password = generateNumericPassword();
      const { error: updateError } = await supabase
        .from("tv_slots")
        .update({
          password,
          updated_at: new Date().toISOString(),
        })
        .eq("id", slot.id);

      if (updateError && !isSchemaMissing(updateError)) {
        console.error("[randomizeAllTvPasswords] Falha ao atualizar senha do slot", slot.id, updateError);
      }
    }
  } catch (error) {
    console.error("[randomizeAllTvPasswords] Erro inesperado ao randomizar senhas", error);
  }
}
