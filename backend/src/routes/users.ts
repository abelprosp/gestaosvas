import { Router } from "express";
import supabase from "../supabaseClient";
import { HttpError } from "../utils/httpError";

const router = Router();

router.get("/vendors", async (_req, res, next) => {
  try {
    const { data, error } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 });
    if (error) {
      throw error;
    }

    const vendors = data.users.map((user) => ({
      id: user.id,
      email: user.email,
      name: (user.user_metadata as { name?: string } | undefined)?.name ?? null,
      role: (user.user_metadata as { role?: string } | undefined)?.role ?? "user",
    }));

    res.json(vendors);
  } catch (error) {
    next(error);
  }
});

export default router;









