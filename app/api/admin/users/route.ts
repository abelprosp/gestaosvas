import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createApiHandler } from "@/lib/utils/apiHandler";
import { createServerClient } from "@/lib/supabase/server";
import { HttpError } from "@/lib/utils/httpError";

const createUserSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  role: z.string().default("user"),
  name: z.string().min(1).optional(),
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

export const GET = createApiHandler(
  async (req) => {
    const supabase = createServerClient();
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

    return NextResponse.json(users);
  },
  { requireAdmin: true }
);

export const POST = createApiHandler(
  async (req) => {
    const supabase = createServerClient();
    const body = await req.json();
    const payload = createUserSchema.parse(body);
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

    return NextResponse.json(
      {
        id: data.user?.id,
        email: data.user?.email,
        role: (data.user?.user_metadata as { role?: string } | undefined)?.role ?? payload.role,
        name: (data.user?.user_metadata as { name?: string } | undefined)?.name ?? payload.name ?? null,
      },
      { status: 201 }
    );
  },
  { requireAdmin: true }
);





