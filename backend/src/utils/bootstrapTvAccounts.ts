import { ensureSlotPoolReady } from "../services/tvAssignments";

export async function bootstrapTvAccounts() {
  try {
    await ensureSlotPoolReady();
  } catch (error) {
    console.error("[bootstrapTvAccounts] Failed to initialize TV accounts", error);
  }
}

