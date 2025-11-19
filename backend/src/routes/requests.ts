import { Router } from "express";
import { z } from "zod";
import supabase from "../supabaseClient";
import { HttpError } from "../utils/httpError";

const router = Router();

const requestSchema = z.object({
  action: z.string().min(1),
  payload: z.record(z.string(), z.any()).optional(),
});

router.post("/", async (req, res, next) => {
  try {
    const { action, payload } = requestSchema.parse(req.body);

    if (!req.user) {
      throw new HttpError(401, "Usuário não autenticado.");
    }

    const { error } = await supabase.from("action_requests").insert({
      user_id: req.user.id,
      action,
      payload: payload ?? null,
    });

    if (error) {
      throw error;
    }

    res.status(201).json({ message: "Solicitação registrada com sucesso." });
  } catch (error) {
    next(error);
  }
});

export default router;

