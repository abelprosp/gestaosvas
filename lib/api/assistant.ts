"use client";

import { api } from "./client";

export interface AssistantStats {
  clients: number;
  contracts: number;
  tvActive: number;
  services: number;
}

export interface ClientSearchResult {
  id: string;
  name: string;
  document: string;
  email: string;
}

export interface PendingContract {
  id: string;
  title: string;
  status: string;
  clientName: string;
}

export interface ExpiringService {
  type: "cloud" | "tv";
  expiresAt: string;
  clientName: string;
  serviceName: string;
}

export async function getAssistantStats(): Promise<AssistantStats> {
  const response = await api.get<AssistantStats>("/assistant/stats");
  return response.data;
}

export async function searchClients(query: string): Promise<ClientSearchResult[]> {
  if (!query || query.length < 2) return [];
  const response = await api.get<{ results: ClientSearchResult[] }>("/assistant/search/clients", {
    params: { q: query },
  });
  return response.data.results;
}

export async function getPendingContracts(): Promise<PendingContract[]> {
  const response = await api.get<{ results: PendingContract[] }>("/assistant/contracts/pending");
  return response.data.results;
}

export async function getAvailableTVSlots(): Promise<number> {
  const response = await api.get<{ count: number }>("/assistant/tv/available");
  return response.data.count;
}

export async function getExpiringServices(days: number = 30): Promise<ExpiringService[]> {
  const response = await api.get<{ results: ExpiringService[] }>("/assistant/expiring", {
    params: { days },
  });
  return response.data.results;
}

export interface SalesAnalysis {
  totalSales: number;
  services: Array<{ key: string; name: string; group: "TV" | "SERVICO" }>;
  points: Array<{
    month: string;
    label: string;
    totals: Record<string, number>;
    total: number;
  }>;
  range: {
    start: string;
    end: string;
  };
}

export async function getSalesAnalysis(): Promise<SalesAnalysis> {
  const response = await api.get<SalesAnalysis>("/stats/sales");
  return response.data;
}

export interface ProactiveSuggestion {
  type: "warning" | "info" | "success" | "action";
  title: string;
  description: string;
  action?: {
    label: string;
    route: string;
  };
}

export async function getProactiveSuggestions(): Promise<ProactiveSuggestion[]> {
  const response = await api.get<{ results: ProactiveSuggestion[] }>("/assistant/suggestions");
  return response.data.results;
}

export interface ChatMessage {
  sender: "assistant" | "user";
  content: string;
}

export async function chatWithAI(
  message: string,
  history: ChatMessage[] = []
): Promise<string | null> {
  try {
    const response = await api.post<{ response: string; model?: string; fallback?: boolean }>(
      "/assistant/chat",
      { message, history }
    );
    
    // Se a API retornou fallback, significa que não está configurada
    if (response.data.fallback) {
      return null;
    }
    
    return response.data.response;
  } catch (error: any) {
    // Se a API não estiver configurada ou houver erro, retornar null para usar fallback
    if (error?.response?.status === 503 || error?.response?.status === 500) {
      return null; // Retornar null para indicar que deve usar fallback
    }
    throw error;
  }
}

