import { api } from "./client";
import { ClientTVAssignment, PaginatedResponse, TVOverviewRecord, TVPlanType, TVSlotStatus } from "@/types";

export interface AssignTVSlotPayload {
  clientId: string;
  soldBy?: string;
  soldAt?: string;
  startsAt?: string;
  expiresAt?: string;
  notes?: string;
  planType?: TVPlanType;
  hasTelephony?: boolean;
}

export interface UpdateTVSlotPayload {
  soldBy?: string | null;
  soldAt?: string | null;
  startsAt?: string | null;
  expiresAt?: string | null;
  status?: TVSlotStatus;
  notes?: string | null;
  password?: string;
  planType?: TVPlanType | null;
  hasTelephony?: boolean | null;
}

type ApiError = {
  response?: {
    status?: number;
    data?: { code?: string };
  };
  code?: string;
  message?: string;
};

function isSchemaUnavailable(error: ApiError) {
  const status = error?.response?.status;
  if (status === 503) return true;
  const code = error?.response?.data?.code ?? error?.code;
  return typeof code === "string" && code.startsWith("PGRST2");
}

export async function createTVAccount(email: string) {
  const response = await api.post<{ account: any; slots: any[] }>("/tv/accounts", { email });
  return response.data;
}

export async function updateTVAccountEmail(accountId: string, email: string) {
  try {
    const response = await api.patch<{ id: string; email: string; createdAt: string }>(
      `/tv/accounts/${accountId}`,
      { email }
    );
    return response.data;
  } catch (error) {
    const typedError = error as ApiError;
    if (isSchemaUnavailable(typedError)) {
      throw new Error("As tabelas de TV não estão configuradas. Execute o script supabase/schema.sql.");
    }
    throw typedError;
  }
}

export async function deleteTVAccount(accountId: string) {
  try {
    const response = await api.delete<{
      message: string;
      deletedAccount: { id: string; email: string };
      slotsRemoved?: string;
    }>(`/tv/accounts/${accountId}`);
    return response.data;
  } catch (error) {
    const typedError = error as ApiError;
    if (isSchemaUnavailable(typedError)) {
      throw new Error("As tabelas de TV não estão configuradas. Execute o script supabase/schema.sql.");
    }
    throw typedError;
  }
}

export async function fetchTVAccountUsage(accountId: string): Promise<{ totalSlots: number; assignedSlots: number }> {
  try {
    const response = await api.get<{ totalSlots: number; assignedSlots: number }>(
      `/tv/accounts/${accountId}/usage`
    );
    return response.data;
  } catch (error) {
    const typedError = error as ApiError;
    if (isSchemaUnavailable(typedError)) {
      return { totalSlots: 0, assignedSlots: 0 };
    }
    throw typedError;
  }
}

export interface NextEmailInfo {
  nextEmail: string;
  availableSlots: number;
  exists: boolean;
}

export async function getNextEmailInfo(): Promise<NextEmailInfo> {
  try {
    const response = await api.get<NextEmailInfo>("/tv/next-email");
    return response.data;
  } catch (error) {
    const typedError = error as ApiError;
    if (isSchemaUnavailable(typedError)) {
      return {
        nextEmail: "1a8@nexusrs.com.br",
        availableSlots: 0,
        exists: false,
      };
    }
    throw typedError;
  }
}

export async function resetTVAccounts() {
  try {
    const response = await api.post<{
      message: string;
      nextEmail: string;
      availableSlots: number;
    }>("/tv/accounts/reset");
    return response.data;
  } catch (error) {
    const typedError = error as ApiError;
    if (isSchemaUnavailable(typedError)) {
      throw new Error("As tabelas de TV não estão configuradas. Execute o script supabase/schema.sql.");
    }
    throw typedError;
  }
}

export interface TVAccountInfo {
  id: string;
  email: string;
  totalSlots: number;
  availableSlots: number;
  assignedSlots: number;
  createdAt: string;
}

export async function listTVAccounts(): Promise<TVAccountInfo[]> {
  try {
    const response = await api.get<TVAccountInfo[]>("/tv/accounts/list");
    return response.data;
  } catch (error) {
    const typedError = error as ApiError;
    if (isSchemaUnavailable(typedError)) {
      return [];
    }
    throw typedError;
  }
}

export interface TVAccountSlot {
  id: string;
  slotNumber: number;
  username: string;
  status: string;
  clientId: string | null;
  client: { id: string; name: string; email: string; document: string } | null;
  planType: string | null;
  soldBy: string | null;
  soldAt: string | null;
  expiresAt: string | null;
  notes: string | null;
  hasTelephony: boolean | null;
}

export async function getTVAccountSlots(accountId: string): Promise<TVAccountSlot[]> {
  try {
    const response = await api.get<TVAccountSlot[]>(`/tv/accounts/${accountId}/slots`);
    return response.data;
  } catch (error) {
    const typedError = error as ApiError;
    if (isSchemaUnavailable(typedError)) {
      return [];
    }
    throw typedError;
  }
}

export async function fetchClientTVAssignments(clientId: string): Promise<ClientTVAssignment[]> {
  try {
    const response = await api.get<ClientTVAssignment[]>(`/tv/slots`, {
      params: { clientId, includeHistory: true },
    });
    return response.data;
  } catch (error) {
    const typedError = error as ApiError;
    if (isSchemaUnavailable(typedError)) {
      return [];
    }
    throw typedError;
  }
}

export async function assignNextTVSlot(payload: AssignTVSlotPayload): Promise<ClientTVAssignment> {
  try {
    const response = await api.post<ClientTVAssignment>(`/tv/slots/assign`, payload);
    return response.data;
  } catch (error) {
    const typedError = error as ApiError;
    if (isSchemaUnavailable(typedError)) {
      throw new Error(
        "Para gerar acessos de TV é necessário executar o script supabase/schema.sql e atualizar o cache do Supabase.",
      );
    }
    throw typedError;
  }
}

export interface AssignMultipleTVSlotPayload extends AssignTVSlotPayload {
  quantity: number;
}

export async function assignMultipleTVSlots(
  payload: AssignMultipleTVSlotPayload,
): Promise<ClientTVAssignment[]> {
  try {
    const response = await api.post<ClientTVAssignment[]>(`/tv/slots/batch-assign`, payload);
    return response.data;
  } catch (error) {
    const typedError = error as ApiError;
    if (isSchemaUnavailable(typedError)) {
      throw new Error(
        "Para gerar acessos de TV é necessário executar o script supabase/schema.sql e atualizar o cache do Supabase.",
      );
    }
    throw typedError;
  }
}

export async function releaseTVSlot(slotId: string) {
  try {
    const response = await api.post(`/tv/slots/${slotId}/release`);
    return response.data;
  } catch (error) {
    const typedError = error as ApiError;
    if (isSchemaUnavailable(typedError)) {
      throw new Error(
        "As tabelas de TV ainda não estão disponíveis. Rode as migrações no Supabase para utilizar essa funcionalidade.",
      );
    }
    throw typedError;
  }
}

export async function deleteTVSlot(slotId: string) {
  try {
    const response = await api.delete<{
      message: string;
      deletedSlot: {
        id: string;
        slotNumber: number;
        email?: string;
      };
    }>(`/tv/slots/${slotId}`);
    return response.data;
  } catch (error) {
    const typedError = error as ApiError;
    if (isSchemaUnavailable(typedError)) {
      throw new Error(
        "As tabelas de TV ainda não estão disponíveis. Rode as migrações no Supabase para utilizar essa funcionalidade.",
      );
    }
    throw typedError;
  }
}

export async function regenerateTVSlotPassword(slotId: string) {
  try {
    const response = await api.post(`/tv/slots/${slotId}/regenerate-password`);
    return response.data;
  } catch (error) {
    const typedError = error as ApiError;
    if (isSchemaUnavailable(typedError)) {
      throw new Error("As tabelas de TV não estão configuradas. Execute o script supabase/schema.sql.");
    }
    throw typedError;
  }
}

export async function updateTVSlot(slotId: string, payload: UpdateTVSlotPayload) {
  try {
    const response = await api.patch(`/tv/slots/${slotId}`, payload);
    return response.data;
  } catch (error) {
    const typedError = error as ApiError;
    if (isSchemaUnavailable(typedError)) {
      throw new Error("As tabelas de TV não estão configuradas. Execute o script supabase/schema.sql.");
    }
    throw typedError;
  }
}

export interface FetchTVOverviewParams {
  search?: string;
  page?: number;
  limit?: number;
}

export async function fetchTVOverview(params: FetchTVOverviewParams = {}) {
  try {
    const query = new URLSearchParams();
    if (params.search && params.search.trim().length) {
      query.set("search", params.search.trim());
    }
    if (params.page && params.page > 0) {
      query.set("page", String(params.page));
    }
    if (params.limit && params.limit > 0) {
      query.set("limit", String(params.limit));
    }
    const response = await api.get<PaginatedResponse<TVOverviewRecord>>(`/tv/overview?${query.toString()}`);
    return response.data;
  } catch (error) {
    const typedError = error as ApiError;
    if (isSchemaUnavailable(typedError)) {
      return {
        data: [],
        page: params.page ?? 1,
        limit: params.limit ?? 50,
        total: 0,
        totalPages: 1,
      };
    }
    throw typedError;
  }
}

