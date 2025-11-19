import { Router } from "express";
import supabase from "../supabaseClient";
import { HttpError } from "../utils/httpError";
import { requireAuth } from "../middleware/auth";

const router = Router();

const SCHEMA_ERROR_CODES = new Set(["PGRST200", "PGRST201", "PGRST202", "PGRST203", "PGRST204", "PGRST205"]);

function isSchemaMissing(error: unknown): boolean {
  return Boolean((error as { code?: string })?.code && SCHEMA_ERROR_CODES.has((error as { code: string }).code));
}

// Endpoint para buscar estatísticas rápidas
router.get("/stats", requireAuth, async (req, res, next) => {
  try {
    const [clientsCount, contractsCount, tvSlotsCount, servicesCount] = await Promise.all([
      supabase.from("clients").select("id", { count: "exact", head: true }),
      supabase.from("contracts").select("id", { count: "exact", head: true }),
      supabase.from("tv_slots").select("id", { count: "exact", head: true }).eq("status", "ASSIGNED"),
      supabase.from("services").select("id", { count: "exact", head: true }),
    ]);

    res.json({
      clients: clientsCount.count ?? 0,
      contracts: contractsCount.count ?? 0,
      tvActive: tvSlotsCount.count ?? 0,
      services: servicesCount.count ?? 0,
    });
  } catch (error) {
    if (isSchemaMissing(error as { code?: string })) {
      return res.json({ clients: 0, contracts: 0, tvActive: 0, services: 0 });
    }
    next(error);
  }
});

// Endpoint para buscar clientes por nome/documento
router.get("/search/clients", requireAuth, async (req, res, next) => {
  try {
    const query = typeof req.query.q === "string" ? req.query.q.trim() : "";
    if (!query || query.length < 2) {
      return res.json({ results: [] });
    }

    const ilike = `%${query}%`;
    const { data, error } = await supabase
      .from("clients")
      .select("id, name, document, email")
      .or(`name.ilike.${ilike},document.ilike.${ilike},email.ilike.${ilike}`)
      .limit(10);

    if (error) {
      if (isSchemaMissing(error as { code?: string })) {
        return res.json({ results: [] });
      }
      throw error;
    }

    res.json({
      results: (data ?? []).map((client) => ({
        id: client.id,
        name: client.name,
        document: client.document,
        email: client.email,
      })),
    });
  } catch (error) {
    next(error);
  }
});

// Endpoint para buscar contratos pendentes
router.get("/contracts/pending", requireAuth, async (req, res, next) => {
  try {
    const { data, error } = await supabase
      .from("contracts")
      .select("id, title, status, client:clients(name)")
      .in("status", ["DRAFT", "SENT"])
      .limit(10)
      .order("created_at", { ascending: false });

    if (error) {
      if (isSchemaMissing(error as { code?: string })) {
        return res.json({ results: [] });
      }
      throw error;
    }

    res.json({
      results: (data ?? []).map((contract: any) => ({
        id: contract.id,
        title: contract.title,
        status: contract.status,
        clientName: contract.client?.name ?? "-",
      })),
    });
  } catch (error) {
    next(error);
  }
});

// Endpoint para buscar slots de TV disponíveis
router.get("/tv/available", requireAuth, async (req, res, next) => {
  try {
    // Busca slots disponíveis que nunca foram atribuídos
    const { data: allSlots, error: fetchError } = await supabase
      .from("tv_slots")
      .select("id, status, tv_accounts(email)")
      .eq("status", "AVAILABLE")
      .is("client_id", null);

    if (fetchError) {
      if (isSchemaMissing(fetchError as { code?: string })) {
        return res.json({ count: 0 });
      }
      throw fetchError;
    }

    if (!allSlots || allSlots.length === 0) {
      return res.json({ count: 0 });
    }

    // Verifica quais slots nunca foram atribuídos
    const slotIds = allSlots.map((slot: any) => slot.id);
    const { data: assignedHistory } = await supabase
      .from("tv_slot_history")
      .select("tv_slot_id")
      .eq("action", "ASSIGNED")
      .in("tv_slot_id", slotIds);

    const usedSlotIds = new Set((assignedHistory ?? []).map((h: any) => h.tv_slot_id));
    const availableCount = allSlots.filter((slot: any) => !usedSlotIds.has(slot.id)).length;

    res.json({ count: availableCount });
  } catch (error) {
    if (isSchemaMissing(error as { code?: string })) {
      return res.json({ count: 0 });
    }
    next(error);
  }
});

// Endpoint para buscar vencimentos próximos
router.get("/expiring", requireAuth, async (req, res, next) => {
  try {
    const days = Number(req.query.days ?? "30");
    const targetDate = new Date();
    targetDate.setDate(targetDate.getDate() + days);
    const targetDateStr = targetDate.toISOString().slice(0, 10);

    const [cloudExpiring, tvExpiring] = await Promise.all([
      supabase
        .from("cloud_accesses")
        .select("id, expires_at, client:clients(name), service:services(name)")
        .lte("expires_at", targetDateStr)
        .gte("expires_at", new Date().toISOString().slice(0, 10))
        .limit(10),
      supabase
        .from("tv_slots")
        .select("id, expires_at, client:clients(name)")
        .lte("expires_at", targetDateStr)
        .gte("expires_at", new Date().toISOString().slice(0, 10))
        .eq("status", "ASSIGNED")
        .not("expires_at", "is", null)
        .limit(10),
    ]);

    const cloudResults = (cloudExpiring.data ?? []).map((access: any) => ({
      type: "cloud",
      expiresAt: access.expires_at,
      clientName: access.client?.name ?? "-",
      serviceName: access.service?.name ?? "-",
    }));

    const tvResults = (tvExpiring.data ?? []).map((slot: any) => ({
      type: "tv",
      expiresAt: slot.expires_at,
      clientName: slot.client?.name ?? "-",
      serviceName: "TV",
    }));

    res.json({ results: [...cloudResults, ...tvResults].slice(0, 10) });
  } catch (error) {
    if (isSchemaMissing(error as { code?: string })) {
      return res.json({ results: [] });
    }
    next(error);
  }
});

export default router;

