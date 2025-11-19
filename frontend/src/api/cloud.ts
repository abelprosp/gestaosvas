import { api } from "./client";
import { CloudAccess, PaginatedResponse } from "../types";

export interface FetchCloudUsersParams {
  page?: number;
  limit?: number;
  search?: string;
  document?: string;
  service?: string;
}

export async function fetchCloudUsers(params: FetchCloudUsersParams = {}) {
  const response = await api.get<PaginatedResponse<CloudAccess>>("/cloud/users", {
    params,
  });
  return response.data;
}

export interface UpdateCloudAccessPayload {
  expiresAt?: string;
  isTest?: boolean;
  notes?: string;
}

export async function updateCloudAccess(id: string, payload: UpdateCloudAccessPayload) {
  const response = await api.patch<CloudAccess>(`/cloud/accesses/${id}`, payload);
  return response.data;
}

export async function deleteCloudAccess(id: string) {
  await api.delete(`/cloud/accesses/${id}`);
}

