import { Router } from "express";
import { z } from "zod";
import supabase from "../supabaseClient";
import { HttpError } from "../utils/httpError";
import { requireAdmin } from "../middleware/auth";

const router = Router();

const updateSchema = z
  .object({
    expiresAt: z.string().min(8).optional(),
    isTest: z.boolean().optional(),
    notes: z.string().optional(),
  })
  .refine((value) => Object.keys(value).length > 0, { message: "Nenhuma alteração fornecida." });

function mapCloudRow(row: any) {
  return {
    id: row.id,
    clientId: row.client_id,
    serviceId: row.service_id,
    expiresAt: row.expires_at,
    isTest: row.is_test,
    notes: row.notes,
    client: row.client ?? null,
    service: row.service ?? null,
  };
}

router.get("/users", async (req, res, next) => {
  try {
    const searchRaw = typeof req.query.search === "string" ? req.query.search.trim() : "";
    const page = Number(req.query.page ?? "1");
    const limit = Number(req.query.limit ?? "50");
    const safePage = Number.isFinite(page) && page > 0 ? Math.floor(page) : 1;
    const safeLimit = Number.isFinite(limit) && limit > 0 ? Math.floor(limit) : 50;
    const offset = (safePage - 1) * safeLimit;

    const documentDigits =
      typeof req.query.document === "string" ? req.query.document.replace(/\D/g, "") : "";

    let query = supabase
      .from("cloud_accesses")
      .select(
        "id, client_id, service_id, expires_at, is_test, notes, client:clients(id, name, email, document), service:services(id, name)",
        { count: "exact" },
      )
      .order("expires_at", { ascending: true })
      .range(offset, offset + safeLimit - 1);

    if (documentDigits) {
      query = query.eq("client.document", documentDigits);
    }

    if (searchRaw) {
      const ilike = `%${searchRaw}%`;
      query = query.or([`notes.ilike.${ilike}`].join(","));

      const { data: clientMatches, error: clientsError } = await supabase
        .from("clients")
        .select("id")
        .or([`name.ilike.${ilike}`, `email.ilike.${ilike}`, `document.ilike.${ilike}`].join(","))
        .limit(500);

      if (clientsError) {
        throw clientsError;
      }

      const clientIds = (clientMatches ?? []).map((item) => item.id);
      if (clientIds.length) {
        query = query.in("client_id", clientIds);
      }
    }

    const { data, error, count } = await query;

    if (error) {
      throw error;
    }

    res.json({
      data: (data ?? []).map(mapCloudRow),
      page: safePage,
      limit: safeLimit,
      total: count ?? data?.length ?? 0,
      totalPages: Math.max(1, Math.ceil((count ?? data?.length ?? 0) / safeLimit)),
    });
  } catch (error) {
    next(error);
  }
});

router.patch("/accesses/:id", async (req, res, next) => {
  try {
    const payload = updateSchema.parse(req.body);
    const updatePayload = {
      ...(payload.expiresAt !== undefined ? { expires_at: payload.expiresAt } : {}),
      ...(payload.isTest !== undefined ? { is_test: payload.isTest } : {}),
      ...(payload.notes !== undefined ? { notes: payload.notes || null } : {}),
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await supabase
      .from("cloud_accesses")
      .update(updatePayload)
      .eq("id", req.params.id)
      .select(
        "id, client_id, service_id, expires_at, is_test, notes, client:clients(id, name, email, document), service:services(id, name)",
      )
      .maybeSingle();

    if (error) {
      throw error;
    }

    if (!data) {
      throw new HttpError(404, "Acesso não encontrado.");
    }

    res.json(mapCloudRow(data));
  } catch (error) {
    next(error);
  }
});

router.delete("/accesses/:id", requireAdmin, async (req, res, next) => {
  try {
    const { error } = await supabase.from("cloud_accesses").delete().eq("id", req.params.id);

    if (error) {
      throw error;
    }

    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

export default router;


