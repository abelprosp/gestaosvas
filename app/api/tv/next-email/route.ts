import { NextRequest, NextResponse } from "next/server";
import { createApiHandler } from "@/lib/utils/apiHandler";
import { createServerClient } from "@/lib/supabase/server";
import { PostgrestError } from "@supabase/supabase-js";

const SCHEMA_ERROR_CODES = new Set(["PGRST200", "PGRST201", "PGRST202", "PGRST203", "PGRST204", "PGRST205"]);
const USERS_PER_ACCOUNT = 8;
const TV_EMAIL_DOMAIN = "nexusrs.com.br";

function isSchemaMissing(error: unknown): error is PostgrestError {
  return Boolean((error as PostgrestError)?.code && SCHEMA_ERROR_CODES.has((error as PostgrestError).code));
}

// Função para construir email padrão baseado no índice
function buildEmail(index: number) {
  const start = index * USERS_PER_ACCOUNT + 1;
  const end = start + USERS_PER_ACCOUNT - 1;
  return `${start}a${end}@${TV_EMAIL_DOMAIN}`;
}

// Função para extrair índice de um email padrão
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

// Verifica se um email é padrão (formato XaY@nexusrs.com.br)
function isStandardEmail(email: string): boolean {
  return /^\d+a\d+@nexusrs\.com\.br$/.test(email);
}

export const GET = createApiHandler(async (req) => {
  const supabase = createServerClient();
  
  try {
    // Buscar todas as contas padrão (ignorar emails personalizados)
    const { data: allAccounts, error: accountsError } = await supabase
      .from("tv_accounts")
      .select("id, email")
      .order("email", { ascending: true });

    if (accountsError && !isSchemaMissing(accountsError)) {
      throw accountsError;
    }

    // Filtrar apenas emails padrão e extrair índices
    const standardAccounts = (allAccounts ?? [])
      .filter(acc => isStandardEmail(acc.email))
      .map(acc => ({
        id: acc.id,
        email: acc.email,
        index: parseEmailIndex(acc.email),
      }))
      .filter(acc => acc.index !== null)
      .sort((a, b) => (a.index ?? 0) - (b.index ?? 0));

    // Encontrar o próximo email padrão disponível
    let nextEmail = buildEmail(0); // Começa com 1a8
    let availableSlots = 0;
    let exists = false;

    // Verificar cada email padrão em sequência até encontrar um com slots disponíveis
    for (let index = 0; index < 100; index++) { // Limite de segurança
      const email = buildEmail(index);
      const account = standardAccounts.find(acc => acc.email === email);

      if (account) {
        // Conta existe, verificar slots disponíveis
        const { data: slots, error: slotsError } = await supabase
          .from("tv_slots")
          .select("id, status, client_id")
          .eq("tv_account_id", account.id)
          .eq("status", "AVAILABLE")
          .is("client_id", null);

        if (slotsError && !isSchemaMissing(slotsError)) {
          throw slotsError;
        }

        const available = slots?.length ?? 0;
        if (available > 0) {
          // Encontrou um email com slots disponíveis
          nextEmail = email;
          availableSlots = available;
          exists = true;
          break;
        }
        // Se não tem slots disponíveis, continua para o próximo
      } else {
        // Conta não existe, este será o próximo email a ser criado
        nextEmail = email;
        availableSlots = 0;
        exists = false;
        break;
      }
    }

    return NextResponse.json({
      nextEmail,
      availableSlots,
      exists,
    });
  } catch (error) {
    if (isSchemaMissing(error as PostgrestError)) {
      return NextResponse.json({
        nextEmail: "1a8@nexusrs.com.br",
        availableSlots: 0,
        exists: false,
      });
    }
    throw error;
  }
});

