import { api } from "./client";

export async function createRequest(action: string, payload?: Record<string, unknown>) {
  await api.post("/requests", {
    action,
    payload: payload ?? {},
  });
}









