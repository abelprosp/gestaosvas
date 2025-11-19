import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createApiHandler } from "@/lib/utils/apiHandler";
import { assignSlotToClient } from "@/lib/services/tvAssignments";

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

export const POST = createApiHandler(
  async (req) => {
    const body = await req.json();
    const payload = assignSchema.parse(body);
    const slot = await assignSlotToClient(payload);
    return NextResponse.json(slot, { status: 201 });
  },
  { requireAdmin: true }
);





