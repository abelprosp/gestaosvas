import { api } from "./client";

export interface Vendor {
  id: string;
  email: string | null;
  name: string | null;
  role: string;
}

export async function fetchVendors(): Promise<Vendor[]> {
  const response = await api.get<Vendor[]>("/users/vendors");
  return response.data;
}









