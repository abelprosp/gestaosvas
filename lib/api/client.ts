"use client";

import axios from "axios";
import { supabase } from "@/lib/supabase/client";
import { CnpjLookupResult } from "@/types";

export const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || "/api",
});

// Interceptor para adicionar token de autenticação
api.interceptors.request.use(async (config) => {
  const { data: { session } } = await supabase.auth.getSession();
  if (session?.access_token) {
    config.headers.Authorization = `Bearer ${session.access_token}`;
  }
  return config;
});

function normalizeCnpj(document: string) {
  return document.replace(/\D/g, "");
}

export async function lookupCompanyByCnpj(document: string): Promise<CnpjLookupResult> {
  const cnpj = normalizeCnpj(document);
  const response = await api.get<CnpjLookupResult>(`/clients/lookup/cnpj/${cnpj}`);
  return response.data;
}

