import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createApiHandler } from "@/lib/utils/apiHandler";
import { assignMultipleSlotsToClient } from "@/lib/services/tvAssignments";

const PLAN_TYPE_ENUM = z.enum(["ESSENCIAL", "PREMIUM"]);

const bulkAssignSchema = z
  .object({
    clientId: z.string().uuid(),
    soldBy: z.string().optional(),
    soldAt: z.string().optional(),
    startsAt: z.string().optional(),
    expiresAt: z.string().optional(),
    notes: z.string().optional(),
    planType: PLAN_TYPE_ENUM.optional(),
    quantity: z.number().int().min(1, "Informe ao menos 1 acesso").max(50, "Máximo de 50 acessos por vez"),
  });

export const POST = createApiHandler(
  async (req) => {
    const body = await req.json();
    const payload = bulkAssignSchema.parse(body);
    const slots = await assignMultipleSlotsToClient(payload);
    return NextResponse.json(slots, { status: 201 });
  },
  { requireAdmin: true }
);





