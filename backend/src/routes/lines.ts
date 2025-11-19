import { Router } from "express";
import { z } from "zod";
import supabase from "../supabaseClient";
import { HttpError } from "../utils/httpError";
import { lineInsertPayload, lineUpdatePayload, mapLineRow } from "../utils/mappers";

const router = Router();

const lineSchema = z.object({
  clientId: z.string().uuid(),
  nickname: z.string().optional(),
  phoneNumber: z.string().min(8),
  type: z.enum(["TITULAR", "DEPENDENTE"]).default("TITULAR"),
  document: z.string().optional(),
  notes: z.string().optional(),
});

const lineUpdateSchema = lineSchema.partial().extend({
  clientId: z.string().uuid().optional(),
});

router.get("/", async (req, res, next) => {
  const clientId = req.query.clientId as string | undefined;
  try {
    const query = supabase.from("lines").select("*").order("created_at", { ascending: false });
    if (clientId) {
      query.eq("client_id", clientId);
    }

    const { data, error } = await query;

    if (error) {
      throw error;
    }

    res.json((data ?? []).map(mapLineRow));
  } catch (error) {
    next(error);
  }
});

router.post("/", async (req, res, next) => {
  try {
    const payload = lineSchema.parse(req.body);
    const insertPayload = lineInsertPayload(payload);
    const { data, error } = await supabase
      .from("lines")
      .insert(insertPayload)
      .select("*")
      .maybeSingle();

    if (error) {
      throw error;
    }

    res.status(201).json(mapLineRow(data!));
  } catch (error) {
    next(error);
  }
});

router.put("/:id", async (req, res, next) => {
  try {
    const payload = lineUpdateSchema.parse(req.body);
    const updatePayload = lineUpdatePayload(payload);
    const { data, error } = await supabase
      .from("lines")
      .update(updatePayload)
      .eq("id", req.params.id)
      .select("*")
      .maybeSingle();

    if (error) {
      throw error;
    }

    if (!data) {
      throw new HttpError(404, "Linha não encontrada");
    }

    res.json(mapLineRow(data));
  } catch (error) {
    next(error);
  }
});

router.delete("/:id", async (req, res, next) => {
  try {
    const { error } = await supabase.from("lines").delete().eq("id", req.params.id);

    if (error) {
      throw error;
    }

    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

export default router;

