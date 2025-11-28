"use client";

import axios from "axios";
import { supabase } from "@/lib/supabase/client";
import { CnpjLookupResult } from "@/types";

export const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || "/api",
});

// Interceptor para adicionar token de autenticação
api.interceptors.request.use(async (config) => {
  try {
    // Sempre obter a sessão mais recente
    const { data: { session }, error } = await supabase.auth.getSession();
    
    if (error) {
      console.error("[API Interceptor] Erro ao obter sessão:", error.message);
      delete config.headers.Authorization;
      return config;
    }
    
    if (!session) {
      console.warn("[API Interceptor] Nenhuma sessão encontrada");
      delete config.headers.Authorization;
      return config;
    }
    
    if (!session.access_token) {
      console.warn("[API Interceptor] Sessão sem access_token");
      delete config.headers.Authorization;
      return config;
    }
    
    // Verificar se o token está expirado ou próximo de expirar
    const expiresAt = session.expires_at;
    const now = Math.floor(Date.now() / 1000);
    
    if (expiresAt && expiresAt < now + 60) {
      // Token expira em menos de 1 minuto, tentar refresh
      console.log("[API Interceptor] Token próximo de expirar, tentando refresh...");
      try {
        const { data: { session: refreshedSession }, error: refreshError } = await supabase.auth.refreshSession();
        if (!refreshError && refreshedSession?.access_token) {
          config.headers.Authorization = `Bearer ${refreshedSession.access_token}`;
          console.log("[API Interceptor] Token atualizado com sucesso");
        } else {
          config.headers.Authorization = `Bearer ${session.access_token}`;
          if (refreshError) {
            console.warn("[API Interceptor] Erro ao atualizar token, usando token atual:", refreshError.message);
          }
        }
      } catch (refreshError) {
        console.error("[API Interceptor] Erro ao fazer refresh:", refreshError);
        config.headers.Authorization = `Bearer ${session.access_token}`;
      }
    } else {
      config.headers.Authorization = `Bearer ${session.access_token}`;
    }
    
    // Log apenas em desenvolvimento para debug
    if (process.env.NODE_ENV === 'development') {
      const tokenPreview = config.headers.Authorization?.toString().substring(0, 30) + "...";
      console.log(`[API Interceptor] Token adicionado para: ${config.url?.substring(0, 50)}...`);
      console.log(`[API Interceptor] Header Authorization: ${tokenPreview}`);
      console.log(`[API Interceptor] Token length: ${session.access_token.length}`);
    }
  } catch (error) {
    console.error("[API Interceptor] Erro inesperado:", error);
    delete config.headers.Authorization;
  }
  
  return config;
});

// Interceptor de resposta para tratar erros 401 automaticamente
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // Se for erro 401 e ainda não tentamos refresh
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      console.log("[API Interceptor] Erro 401 detectado, tentando refresh da sessão...");

      try {
        // Tentar fazer refresh da sessão
        const { data: { session }, error: refreshError } = await supabase.auth.refreshSession();

        if (!refreshError && session?.access_token) {
          console.log("[API Interceptor] Sessão atualizada com sucesso, repetindo requisição...");
          // Garantir que o header seja atualizado corretamente
          originalRequest.headers = originalRequest.headers || {};
          originalRequest.headers.Authorization = `Bearer ${session.access_token}`;
          
          // Também atualizar o header padrão do axios
          api.defaults.headers.common.Authorization = `Bearer ${session.access_token}`;
          
          // Repetir a requisição com o novo token
          return api(originalRequest);
        } else {
          console.error("[API Interceptor] Erro ao fazer refresh:", refreshError);
          console.error("[API Interceptor] Detalhes:", {
            hasSession: !!session,
            hasToken: !!session?.access_token,
            error: refreshError?.message,
          });
          
          // Se o refresh falhar, pode ser que a sessão expirou completamente
          if (typeof window !== 'undefined') {
            console.warn("[API Interceptor] Sessão expirada. Faça login novamente.");
            // Opcional: redirecionar para login
            // window.location.href = '/login';
          }
        }
      } catch (refreshError) {
        console.error("[API Interceptor] Erro ao tentar refresh:", refreshError);
      }
    }

    return Promise.reject(error);
  }
);

function normalizeCnpj(document: string) {
  return document.replace(/\D/g, "");
}

export async function lookupCompanyByCnpj(document: string): Promise<CnpjLookupResult> {
  const cnpj = normalizeCnpj(document);
  const response = await api.get<CnpjLookupResult>(`/clients/lookup/cnpj/${cnpj}`);
  return response.data;
}

