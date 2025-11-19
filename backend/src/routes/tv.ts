import { Router } from "express";
import { z } from "zod";
import supabase from "../supabaseClient";
import { HttpError } from "../utils/httpError";
import {
  mapClientTVAssignment,
  mapTVSlotHistoryRow,
  mapTVSlotRow,
  mapTVAccountRow,
} from "../utils/mappers";
import { generateNumericPassword } from "../utils/password";
import { requireAdmin, requireAuth } from "../middleware/auth";
import { PostgrestError } from "@supabase/supabase-js";
import { assignMultipleSlotsToClient, assignSlotToClient } from "../services/tvAssignments";
import { ClientTVAssignment } from "../types";

const router = Router();

const SCHEMA_ERROR_CODES = new Set(["PGRST200", "PGRST201", "PGRST202", "PGRST203", "PGRST204", "PGRST205"]);

function isSchemaMissing(error: unknown): error is PostgrestError {
  return Boolean((error as PostgrestError)?.code && SCHEMA_ERROR_CODES.has((error as PostgrestError).code));
}

function ensureTablesAvailable(error: PostgrestError) {
  if (isSchemaMissing(error)) {
    throw new HttpError(
      503,
      "Funcionalidade de TV indisponível. Execute o script supabase/schema.sql e atualize o cache do Supabase.",
    );
  }
}

const PLAN_TYPE_ENUM = z.enum(["ESSENCIAL", "PREMIUM"]);

const assignSchema = z.object({
  clientId: z.string().uuid(),
  soldBy: z.string().optional(),
  soldAt: z.string().optional(),
  startsAt: z.string().optional(),
  expiresAt: z.string().optional(),
  notes: z.string().optional(),
  planType: PLAN_TYPE_ENUM.optional(),
});

const bulkAssignSchema = assignSchema.extend({
  quantity: z.number().int().min(1, "Informe ao menos 1 acesso").max(50, "Máximo de 50 acessos por vez"),
});

const updateSchema = z
  .object({
    soldBy: z.string().optional(),
    soldAt: z.string().optional(),
    startsAt: z.string().optional().nullable(),
    expiresAt: z.string().optional().nullable(),
    status: z.enum(["AVAILABLE", "ASSIGNED", "INACTIVE", "SUSPENDED"]).optional(),
    notes: z.string().optional().nullable(),
    planType: PLAN_TYPE_ENUM.optional().nullable(),
    password: z
      .string()
      .regex(/^\d{4}$/, { message: "A senha deve conter exatamente 4 dígitos." })
      .optional(),
  })
  .refine((value) => Object.keys(value).length > 0, { message: "Nenhuma alteração fornecida" });

router.get("/slots", requireAuth, async (req, res, next) => {
  try {
    const availableOnly = req.query.available === "true";
    const clientId = req.query.clientId as string | undefined;
    const withHistory = req.query.includeHistory === "true";

    let query = supabase
      .from("tv_slots")
      .select("*, tv_accounts(*)")
      .order("email", { ascending: true, foreignTable: "tv_accounts" })
      .order("slot_number", { ascending: true });

    if (availableOnly) {
      query = query.eq("status", "AVAILABLE").is("client_id", null);
    }

    if (clientId) {
      query = query.eq("client_id", clientId);
    }

    const { data, error } = await query;

    if (error) {
      if (isSchemaMissing(error)) {
        return res.json([]);
      }
      throw error;
    }

    if (!withHistory) {
      res.json((data ?? []).map((row) => mapTVSlotRow(row)));
      return;
    }

    const slotIds = (data ?? []).map((row) => row.id);

    const { data: historyData, error: historyError } = slotIds.length
      ? await supabase.from("tv_slot_history").select("*").in("tv_slot_id", slotIds).order("created_at", { ascending: false })
      : { data: [], error: null };

    if (historyError) {
      if (isSchemaMissing(historyError)) {
        return res.json((data ?? []).map((row) => mapTVSlotRow(row)));
      }
      throw historyError;
    }

    const historiesBySlot = new Map<string, typeof historyData>();
    (historyData ?? []).forEach((history) => {
      const list = historiesBySlot.get(history.tv_slot_id) ?? [];
      list.push(history);
      historiesBySlot.set(history.tv_slot_id, list);
    });

    const result = (data ?? []).map((row) => mapClientTVAssignment(row, historiesBySlot.get(row.id) ?? []));

    const assignmentsByClient = new Map<string, ClientTVAssignment[]>();
    result.forEach((assignment) => {
      const clientKey = assignment.clientId ?? ((assignment as any)?.client?.id ?? null);
      if (!clientKey) {
        return;
      }
      const list = assignmentsByClient.get(clientKey) ?? [];
      list.push(assignment);
      assignmentsByClient.set(clientKey, list);
    });

    assignmentsByClient.forEach((list) => {
      list.sort((a, b) => {
        const emailCompare = a.email.localeCompare(b.email, "pt-BR", { sensitivity: "base" });
        if (emailCompare !== 0) {
          return emailCompare;
        }
        return a.slotNumber - b.slotNumber;
      });

      list.forEach((item, index) => {
        item.profileLabel = `Perfil ${index + 1}`;
        item.history.sort((a, b) => (a.createdAt > b.createdAt ? -1 : 1));
      });
    });

    res.json(result);
  } catch (error) {
    next(error);
  }
});

router.get("/overview", requireAuth, async (req, res, next) => {
  try {
    const searchRaw = typeof req.query.search === "string" ? req.query.search.trim() : "";
    const page = Number(req.query.page ?? "1");
    const limit = Number(req.query.limit ?? "50");
    const safePage = Number.isFinite(page) && page > 0 ? Math.floor(page) : 1;
    const safeLimit = Number.isFinite(limit) && limit > 0 ? Math.floor(limit) : 50;
    const offset = (safePage - 1) * safeLimit;

    // Busca todos os slots inicialmente
    let query = supabase
      .from("tv_slots")
      .select("*, client_id, tv_accounts(*), client:clients(name, id, email, phone, document)", { count: "exact" })
      .neq("status", "USED") // Exclui slots que já foram usados
      .order("email", { ascending: true, foreignTable: "tv_accounts" })
      .order("slot_number", { ascending: true });

    if (searchRaw) {
      const ilike = `%${searchRaw}%`;

      query = query.or(
        [
          `username.ilike.${ilike}`,
          `sold_by.ilike.${ilike}`,
          `notes.ilike.${ilike}`,
          `plan_type.ilike.${ilike}`,
          `status.ilike.${ilike}`,
          `slot_number::text.ilike.${ilike}`,
        ].join(","),
      );

      query = query.or([`email.ilike.${ilike}`].join(","), { foreignTable: "tv_accounts" });

      const { data: clientIdsData, error: clientIdsError } = await supabase
        .from("clients")
        .select("id")
        .or(
          [`name.ilike.${ilike}`, `email.ilike.${ilike}`, `phone.ilike.${ilike}`, `document.ilike.${ilike}`].join(","),
        )
        .limit(500);

      if (clientIdsError) {
        throw clientIdsError;
      }

      const matchingClientIds = (clientIdsData ?? []).map((item: { id: string }) => item.id);
      if (matchingClientIds.length > 0) {
        query = query.or(
          matchingClientIds.map((id, index) => `client_id.eq.${id}${index === matchingClientIds.length - 1 ? "" : ""}`).join(","),
        );
      }
    }

    query = query.range(offset, offset + safeLimit - 1);

    let { data, error, count } = await query;

    if (error) {
      if (isSchemaMissing(error)) {
        return res.json({ data: [], page: safePage, limit: safeLimit, total: 0, totalPages: 1 });
      }
      throw error;
    }

    // Remove slots disponíveis que já foram usados (têm histórico de ASSIGNED)
    // Mas mantém slots que estão atualmente atribuídos (status ASSIGNED com cliente)
    const availableSlotIds = (data ?? [])
      .filter((slot) => slot.status === "AVAILABLE" && !slot.client_id)
      .map((slot) => slot.id);

    if (availableSlotIds.length > 0) {
      const { data: assignedHistory } = await supabase
        .from("tv_slot_history")
        .select("tv_slot_id")
        .eq("action", "ASSIGNED")
        .in("tv_slot_id", availableSlotIds);

      const usedSlotIds = new Set((assignedHistory ?? []).map((h) => h.tv_slot_id));

      // Remove slots disponíveis que já foram usados
      data = (data ?? []).filter((slot) => {
        // Se está disponível e já foi usado, remove
        if (slot.status === "AVAILABLE" && !slot.client_id && usedSlotIds.has(slot.id)) {
          return false;
        }
        return true;
      });

      // Ajusta o count para refletir a remoção
      if (count !== null && count !== undefined) {
        count = count - usedSlotIds.size;
      }
    }

    const formatted = (data ?? []).map((row) => {
      const mapped = mapTVSlotRow(row);
      return {
        id: mapped.id,
        slotNumber: mapped.slotNumber,
        username: mapped.username,
        email: mapped.account?.email ?? "",
        status: mapped.status,
        password: mapped.password,
        soldBy: mapped.soldBy,
        soldAt: mapped.soldAt,
        startsAt: mapped.startsAt,
        expiresAt: mapped.expiresAt,
        notes: mapped.notes,
        planType: mapped.planType ?? null,
        client: row.client ?? null,
        clientId: mapped.clientId ?? null,
        profileLabel: null as string | null,
        document: row.client?.document ?? null,
      };
    });

    const grouped = new Map<string, typeof formatted>();
    formatted.forEach((record) => {
      const key = record.clientId ?? record.client?.id ?? null;
      if (!key) {
        return;
      }
      const list = grouped.get(key) ?? [];
      list.push(record);
      grouped.set(key, list);
    });

    grouped.forEach((list) => {
      list.sort((a, b) => {
        const emailCompare = a.email.localeCompare(b.email, "pt-BR", { sensitivity: "base" });
        if (emailCompare !== 0) {
          return emailCompare;
        }
        return a.slotNumber - b.slotNumber;
      });
      list.forEach((item, index) => {
        item.profileLabel = `Perfil ${index + 1}`;
      });
    });

    const total = count ?? formatted.length;
    const totalPages = Math.max(1, Math.ceil(total / safeLimit));

    res.json({
      data: formatted,
      page: safePage,
      limit: safeLimit,
      total,
      totalPages,
    });
  } catch (error) {
    next(error);
  }
});

router.post("/slots/assign", requireAdmin, async (req, res, next) => {
  try {
    const payload = assignSchema.parse(req.body);
    const slot = await assignSlotToClient(payload);
    res.status(201).json(slot);
  } catch (error) {
    next(error);
  }
});

router.post("/slots/batch-assign", requireAdmin, async (req, res, next) => {
  try {
    const payload = bulkAssignSchema.parse(req.body);
    const slots = await assignMultipleSlotsToClient(payload);
    res.status(201).json(slots);
  } catch (error) {
    next(error);
  }
});

router.post("/slots/:id/regenerate-password", requireAdmin, async (req, res, next) => {
  try {
    const slotId = req.params.id;
    const password = generateNumericPassword();

    const { data, error } = await supabase
      .from("tv_slots")
      .update({ password, updated_at: new Date().toISOString() })
      .eq("id", slotId)
      .select("*, tv_accounts(*)")
      .maybeSingle();

    if (error) {
      ensureTablesAvailable(error);
      throw error;
    }

    if (!data) {
      throw new HttpError(404, "Slot não encontrado");
    }

    const { error: historyError } = await supabase.from("tv_slot_history").insert({
      tv_slot_id: slotId,
      action: "PASSWORD_REGENERATED",
      metadata: { password },
    });

    if (historyError && !isSchemaMissing(historyError)) {
      throw historyError;
    }

    res.json(mapTVSlotRow(data));
  } catch (error) {
    next(error);
  }
});

router.post("/slots/:id/release", requireAdmin, async (req, res, next) => {
  try {
    const slotId = req.params.id;

    const { data, error } = await supabase
      .from("tv_slots")
      .update({
        status: "AVAILABLE",
        client_id: null,
        sold_by: null,
        sold_at: null,
        expires_at: null,
        notes: null,
        password: generateNumericPassword(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", slotId)
      .select("*, tv_accounts(*)")
      .maybeSingle();

    if (error) {
      ensureTablesAvailable(error);
      throw error;
    }

    if (!data) {
      throw new HttpError(404, "Slot não encontrado");
    }

    const { error: historyError } = await supabase.from("tv_slot_history").insert({
      tv_slot_id: slotId,
      action: "RELEASED",
      metadata: {},
    });

    if (historyError && !isSchemaMissing(historyError)) {
      throw historyError;
    }

    res.json(mapTVSlotRow(data));
  } catch (error) {
    next(error);
  }
});

router.patch("/slots/:id", requireAuth, async (req, res, next) => {
  try {
    const slotId = req.params.id;
    const payload = updateSchema.parse(req.body);
    const isAdmin = req.user?.role === "admin";

    if (!isAdmin) {
      const forbiddenKeys = Object.keys(payload).filter(
        (key) => !["notes"].includes(key) && (payload as Record<string, unknown>)[key] !== undefined,
      );
      if (forbiddenKeys.length > 0) {
        throw new HttpError(403, "Apenas administradores podem alterar esses campos.");
      }
    }

    const updateData: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (payload.soldBy !== undefined) updateData.sold_by = payload.soldBy;
    if (payload.soldAt !== undefined) updateData.sold_at = payload.soldAt;
    if (payload.expiresAt !== undefined) updateData.expires_at = payload.expiresAt;
    if (payload.startsAt !== undefined) {
      updateData.starts_at = payload.startsAt && payload.startsAt.trim().length ? payload.startsAt : null;
    }
    if (payload.planType !== undefined) {
      updateData.plan_type = payload.planType ?? null;
    }
    let shouldRandomize = false;
    if (payload.status !== undefined) {
      updateData.status = payload.status;
      if (payload.status !== "ASSIGNED") {
        shouldRandomize = true;
      }
    }
    if (payload.notes !== undefined) updateData.notes = payload.notes;
    if (payload.password !== undefined) {
      updateData.password = payload.password;
      shouldRandomize = false;
    } else if (shouldRandomize) {
      updateData.password = generateNumericPassword();
    }

    const { data, error } = await supabase
      .from("tv_slots")
      .update(updateData)
      .eq("id", slotId)
      .select("*, tv_accounts(*)")
      .maybeSingle();

    if (error) {
      ensureTablesAvailable(error as PostgrestError);
      throw error;
    }

    if (!data) {
      throw new HttpError(404, "Slot não encontrado");
    }

    const { error: historyError } = await supabase.from("tv_slot_history").insert({
      tv_slot_id: slotId,
      action: "UPDATED",
      metadata: updateData,
    });

    if (historyError && !isSchemaMissing(historyError)) {
      throw historyError;
    }

    res.json(mapTVSlotRow(data));
  } catch (error) {
    next(error);
  }
});

router.get("/slots/:id/history", requireAuth, async (req, res, next) => {
  try {
    const slotId = req.params.id;
    const { data, error } = await supabase
      .from("tv_slot_history")
      .select("*")
      .eq("tv_slot_id", slotId)
      .order("created_at", { ascending: false });

    if (error) {
      if (isSchemaMissing(error)) {
        return res.json([]);
      }
      throw error;
    }

    res.json((data ?? []).map(mapTVSlotHistoryRow));
  } catch (error) {
    next(error);
  }
});

router.get("/accounts", requireAuth, async (_req, res, next) => {
  try {
    const { data, error } = await supabase
      .from("tv_accounts")
      .select("*, tv_slots(*)")
      .order("email", { ascending: true })
      .order("slot_number", { ascending: true, foreignTable: "tv_slots" });

    if (error) {
      throw error;
    }

    const formatted = (data ?? []).map((account) => ({
      account: mapTVAccountRow(account),
      slots: (account.tv_slots ?? []).map((slot: any) => mapTVSlotRow({ ...slot, tv_accounts: account })),
    }));

    res.json(formatted);
  } catch (error) {
    next(error);
  }
});

export default router;

