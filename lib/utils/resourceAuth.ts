import { SupabaseClient } from "@supabase/supabase-js";
import { HttpError } from "./httpError";
import { AuthUser } from "@/lib/auth";

/**
 * Verifica se um usuário tem permissão para acessar um recurso específico
 */
export async function checkResourceAccess(
  resourceType: "client" | "contract",
  resourceId: string,
  user: AuthUser,
  supabase: SupabaseClient
): Promise<boolean> {
  // Admin tem acesso a tudo
  if (user.role === "admin") {
    return true;
  }

  try {
    if (resourceType === "client") {
      const { data, error } = await supabase
        .from("clients")
        .select("opened_by")
        .eq("id", resourceId)
        .single();

      if (error) {
        console.error(`[checkResourceAccess] Erro ao verificar acesso ao cliente ${resourceId}:`, error);
        return false;
      }

      // Se opened_by não existir, permitir acesso (compatibilidade com dados antigos)
      if (!data?.opened_by) {
        return true;
      }

      // Verificar se o usuário criou o recurso
      return data.opened_by === user.id;
    }

    if (resourceType === "contract") {
      const { data, error } = await supabase
        .from("contracts")
        .select("created_by")
        .eq("id", resourceId)
        .single();

      if (error) {
        console.error(`[checkResourceAccess] Erro ao verificar acesso ao contrato ${resourceId}:`, error);
        return false;
      }

      // Se created_by não existir, permitir acesso
      if (!data?.created_by) {
        return true;
      }

      return data.created_by === user.id;
    }
  } catch (error) {
    console.error(`[checkResourceAccess] Erro inesperado:`, error);
    return false;
  }

  return false;
}

/**
 * Garante que o usuário tem acesso ao recurso, caso contrário lança erro 403
 */
export async function requireResourceAccess(
  resourceType: "client" | "contract",
  resourceId: string,
  user: AuthUser,
  supabase: SupabaseClient
): Promise<void> {
  const hasAccess = await checkResourceAccess(resourceType, resourceId, user, supabase);
  
  if (!hasAccess) {
    throw new HttpError(
      403,
      "Acesso negado. Você não tem permissão para acessar este recurso."
    );
  }
}

