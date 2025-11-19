import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createApiHandler } from "@/lib/utils/apiHandler";
import { createServerClient } from "@/lib/supabase/server";
import { HttpError } from "@/lib/utils/httpError";

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

export const PATCH = createApiHandler(
  async (req, { params }) => {
    const supabase = createServerClient();
    const body = await req.json();
    const payload = updateUserSchema.parse(body);

    const existing = await supabase.auth.admin.getUserById(params.id);
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

    const updatePayload: any = {
      user_metadata: updatedMetadata,
    };

    if (payload.email) {
      updatePayload.email = payload.email;
    }

    if (payload.password) {
      updatePayload.password = payload.password;
    }

    const { data, error } = await supabase.auth.admin.updateUserById(params.id, updatePayload);

    if (error) {
      throw error;
    }

    return NextResponse.json({
      id: data.user?.id,
      email: data.user?.email,
      role: (data.user?.user_metadata as { role?: string } | undefined)?.role ?? "user",
      name: (data.user?.user_metadata as { name?: string } | undefined)?.name ?? null,
    });
  },
  { requireAdmin: true }
);

export const DELETE = createApiHandler(
  async (req, { params }) => {
    const supabase = createServerClient();
    const { error } = await supabase.auth.admin.deleteUser(params.id);

    if (error) {
      throw error;
    }

    return new NextResponse(null, { status: 204 });
  },
  { requireAdmin: true }
);





