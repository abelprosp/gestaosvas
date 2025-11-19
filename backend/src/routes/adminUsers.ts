import { Router } from "express";
import { z } from "zod";
import supabase from "../supabaseClient";
import { HttpError } from "../utils/httpError";

const router = Router();

router.get("/", async (_req, res, next) => {
  try {
    const { data, error } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 });
    if (error) {
      throw error;
    }

    const users = data.users.map((user) => ({
      id: user.id,
      email: user.email,
      role: (user.user_metadata as { role?: string } | undefined)?.role ?? "user",
      name: (user.user_metadata as { name?: string } | undefined)?.name ?? null,
      createdAt: user.created_at,
      lastSignInAt: user.last_sign_in_at,
    }));

    res.json(users);
  } catch (error) {
    next(error);
  }
});

const createUserSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  role: z.string().default("user"),
  name: z.string().min(1).optional(),
});

router.post("/", async (req, res, next) => {
  try {
    const payload = createUserSchema.parse(req.body);
    const { data, error } = await supabase.auth.admin.createUser({
      email: payload.email,
      password: payload.password,
      email_confirm: true,
      user_metadata: { role: payload.role, ...(payload.name ? { name: payload.name } : {}) },
    });

    if ((error as any)?.status === 422) {
      throw new HttpError(409, "Usuário já existe");
    }

    if (error) {
      throw error;
    }

    res.status(201).json({
      id: data.user?.id,
      email: data.user?.email,
      role: (data.user?.user_metadata as { role?: string } | undefined)?.role ?? payload.role,
      name: (data.user?.user_metadata as { name?: string } | undefined)?.name ?? payload.name ?? null,
    });
  } catch (error) {
    next(error);
  }
});

const updateUserSchema = z
  .object({
    email: z.string().email().optional(),
    password: z.string().min(6).optional(),
    role: z.string().optional(),
    name: z.union([z.string().min(1), z.literal("")]).optional(),
  })
  .superRefine((value, ctx) => {
    if (!value.email && !value.password && !value.role && value.name === undefined) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Nenhuma alteração fornecida" });
    }
  });

router.patch("/:id", async (req, res, next) => {
  try {
    const payload = updateUserSchema.parse(req.body);

    const existing = await supabase.auth.admin.getUserById(req.params.id);
    if (existing.error) {
      throw existing.error;
    }

    const currentMetadata = (existing.data.user?.user_metadata as Record<string, unknown>) ?? {};
    const updatedMetadata = { ...currentMetadata } as Record<string, unknown>;

    if (payload.role) {
      updatedMetadata.role = payload.role;
    }

    if (payload.name !== undefined) {
      if (payload.name === "") {
        delete updatedMetadata.name;
      } else {
        updatedMetadata.name = payload.name;
      }
    }

    const updateInput: Parameters<typeof supabase.auth.admin.updateUserById>[1] = {};
    if (payload.email) {
      updateInput.email = payload.email;
    }
    if (payload.password) {
      updateInput.password = payload.password;
    }
    if (Object.keys(updatedMetadata).length > 0) {
      updateInput.user_metadata = updatedMetadata;
    }

    const { data, error } = await supabase.auth.admin.updateUserById(req.params.id, updateInput);

    if ((error as any)?.status === 422) {
      throw new HttpError(409, "E-mail já está em uso");
    }

    if (error) {
      throw error;
    }

    res.json({
      id: data.user?.id,
      email: data.user?.email,
      role: (data.user?.user_metadata as { role?: string } | undefined)?.role ?? "user",
      name: (data.user?.user_metadata as { name?: string } | undefined)?.name ?? null,
      createdAt: data.user?.created_at,
      lastSignInAt: data.user?.last_sign_in_at,
    });
  } catch (error) {
    next(error);
  }
});

router.delete("/:id", async (req, res, next) => {
  try {
    const { error } = await supabase.auth.admin.deleteUser(req.params.id);
    if (error) {
      throw error;
    }
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

export default router;

