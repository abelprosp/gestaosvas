import { Router } from "express";
import { z } from "zod";
import supabase from "../supabaseClient";
import { HttpError } from "../utils/httpError";
import { mapServiceRow, serviceInsertPayload, serviceUpdatePayload } from "../utils/mappers";
import { requireAdmin } from "../middleware/auth";

const router = Router();

function normalizePriceInput(input: string | number): number {
  if (typeof input === "number") {
    return input;
  }
  const sanitized = input.replace(/\s/g, "").replace(/\./g, "").replace(",", ".");
  const parsed = Number(sanitized);
  if (Number.isNaN(parsed)) {
    throw new Error("Valor inválido");
  }
  return parsed;
}

const priceSchema = z
  .union([z.string(), z.number()])
  .transform((value) => normalizePriceInput(value))
  .refine((value) => value >= 0, { message: "Valor não pode ser negativo" });

const serviceSchema = z.object({
  name: z.string().min(2, "Informe ao menos 2 caracteres"),
  description: z.string().max(2000).optional(),
  price: priceSchema,
  allowCustomPrice: z.boolean().optional().default(false),
});

const serviceUpdateSchema = serviceSchema
  .partial()
  .superRefine((value, ctx) => {
    if (value.name === undefined && value.description === undefined && value.price === undefined) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Nenhuma alteração fornecida" });
    }
  });

router.get("/", async (_req, res, next) => {
  try {
    const { data, error } = await supabase.from("services").select("*").order("name", { ascending: true });
    if (error) {
      throw error;
    }

    res.json((data ?? []).map(mapServiceRow));
  } catch (error) {
    next(error);
  }
});

router.post("/", requireAdmin, async (req, res, next) => {
  try {
    const payload = serviceSchema.parse(req.body);
    const insertPayload = serviceInsertPayload(payload);
    const { data, error } = await supabase.from("services").insert(insertPayload).select("*").maybeSingle();

    if (error) {
      throw error;
    }

    if (!data) {
      throw new HttpError(500, "Falha ao criar serviço");
    }

    res.status(201).json(mapServiceRow(data));
  } catch (error) {
    next(error);
  }
});

router.patch("/:id", requireAdmin, async (req, res, next) => {
  try {
    const payload = serviceUpdateSchema.parse(req.body);
    const updatePayload = serviceUpdatePayload(payload);
    const { data, error } = await supabase
      .from("services")
      .update(updatePayload)
      .eq("id", req.params.id)
      .select("*")
      .maybeSingle();

    if (error) {
      throw error;
    }

    if (!data) {
      throw new HttpError(404, "Serviço não encontrado");
    }

    res.json(mapServiceRow(data));
  } catch (error) {
    next(error);
  }
});

router.delete("/:id", requireAdmin, async (req, res, next) => {
  try {
    const { error } = await supabase.from("services").delete().eq("id", req.params.id);

    if (error) {
      throw error;
    }

    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

export default router;


