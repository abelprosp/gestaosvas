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

