import axios from "axios";
import { CnpjLookupResult } from "../types";

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? "http://localhost:4000/api",
});

function normalizeCnpj(document: string) {
  return document.replace(/\D/g, "");
}

export async function lookupCompanyByCnpj(document: string) {
  const cnpj = normalizeCnpj(document);
  const response = await api.get<CnpjLookupResult>(`/clients/lookup/cnpj/${cnpj}`);
  return response.data;
}

