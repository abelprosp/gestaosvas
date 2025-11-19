import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl) {
  throw new Error("NEXT_PUBLIC_SUPABASE_URL não configurado no ambiente");
}

if (!supabaseAnonKey) {
  throw new Error("NEXT_PUBLIC_SUPABASE_ANON_KEY não configurado no ambiente");
}

// Cliente do Supabase para operações no servidor (usando Service Role Key quando necessário)
export function createServerClient() {
  if (supabaseServiceRoleKey) {
    return createClient(supabaseUrl, supabaseServiceRoleKey, {
      auth: {
        persistSession: false,
      },
    });
  }

  // Fallback para anon key (menos seguro, apenas para desenvolvimento)
  return createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: false,
    },
  });
}

// Cliente do Supabase para operações que requerem autenticação do usuário
export async function createAuthenticatedServerClient() {
  const cookieStore = await cookies();
  const accessToken = cookieStore.get("sb-access-token")?.value;

  const client = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: false,
    },
  });

  if (accessToken) {
    await client.auth.setSession({
      access_token: accessToken,
      refresh_token: cookieStore.get("sb-refresh-token")?.value || "",
    });
  }

  return client;
}

// Removido export const supabase - deve ser criado apenas quando necessário
// Para usar o cliente, chame createServerClient() ou createAuthenticatedServerClient() diretamente





