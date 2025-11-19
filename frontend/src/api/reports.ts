import { api } from "./client";
import { ServiceReportRow } from "../types";

export interface FetchServiceReportParams {
  document?: string;
  search?: string;
  service?: string;
  category?: "ALL" | "TV" | "CLOUD" | "HUB" | "TELE" | "SERVICE";
  limit?: number;
}

export interface ServiceReportResponse {
  data: ServiceReportRow[];
  total: number;
}

export async function fetchServiceReport(params: FetchServiceReportParams) {
  const response = await api.get<ServiceReportResponse>("/reports/services", {
    params,
  });
  return response.data;
}




