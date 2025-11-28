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
export function createServerClient(requireServiceRole = false) {
  // Se requer Service Role Key, usar ela
  if (requireServiceRole) {
    if (!supabaseServiceRoleKey) {
      throw new Error(
        "SUPABASE_SERVICE_ROLE_KEY não está configurada. Esta operação requer Service Role Key."
      );
    }
    return createClient(supabaseUrl, supabaseServiceRoleKey, {
      auth: {
        persistSession: false,
      },
    });
  }

  // Para validar tokens de usuário, SEMPRE usar ANON_KEY
  // A Service Role Key bypassa RLS e não valida tokens de usuário corretamente
  if (!supabaseAnonKey) {
    throw new Error("NEXT_PUBLIC_SUPABASE_ANON_KEY não configurado no ambiente");
  }

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





