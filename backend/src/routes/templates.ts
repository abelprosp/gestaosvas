import { Router } from "express";
import { z } from "zod";
import supabase from "../supabaseClient";
import { HttpError } from "../utils/httpError";
import {
  mapTemplateRow,
  templateInsertPayload,
  templateUpdatePayload,
} from "../utils/mappers";
import { requireAdmin } from "../middleware/auth";

const router = Router();

const templateSchema = z.object({
  name: z.string().min(3),
  content: z.string().min(10),
  active: z.boolean().optional(),
});

const templateUpdateSchema = templateSchema.partial();
const templateDeleteSchema = z.object({
  password: z.string().min(1, "Informe sua senha para confirmar."),
});

router.get("/", async (_req, res, next) => {
  try {
    const { data, error } = await supabase
      .from("contract_templates")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      throw error;
    }

    res.json((data ?? []).map(mapTemplateRow));
  } catch (error) {
    next(error);
  }
});

router.post("/", async (req, res, next) => {
  try {
    const payload = templateSchema.parse(req.body);
    const insertPayload = templateInsertPayload(payload);
    const { data, error } = await supabase
      .from("contract_templates")
      .insert(insertPayload)
      .select("*")
      .maybeSingle();

    if (error) {
      throw error;
    }

    res.status(201).json(mapTemplateRow(data!));
  } catch (error) {
    next(error);
  }
});

router.put("/:id", async (req, res, next) => {
  try {
    const payload = templateUpdateSchema.parse(req.body);
    const updatePayload = templateUpdatePayload(payload);
    const { data, error } = await supabase
      .from("contract_templates")
      .update(updatePayload)
      .eq("id", req.params.id)
      .select("*")
      .maybeSingle();

    if (error) {
      throw error;
    }

    if (!data) {
      throw new HttpError(404, "Template não encontrado");
    }

    res.json(mapTemplateRow(data));
  } catch (error) {
    next(error);
  }
});

router.delete("/:id", requireAdmin, async (req, res, next) => {
  try {
    const { password } = templateDeleteSchema.parse(req.body ?? {});

    if (!req.user?.email) {
      throw new HttpError(400, "Conta sem e-mail. Faça login novamente.");
    }

    const { error: authError } = await supabase.auth.signInWithPassword({
      email: req.user.email,
      password,
    });

    if (authError) {
      throw new HttpError(401, "Senha incorreta. Tente novamente.");
    }

    const { error } = await supabase.from("contract_templates").delete().eq("id", req.params.id);

    if (error) {
      throw error;
    }

    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

export default router;

