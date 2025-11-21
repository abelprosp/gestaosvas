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
  hasTelephony: z.boolean().optional(),
});

export const POST = createApiHandler(
  async (req) => {
    try {
      const body = await req.json();
      console.log("[POST /api/tv/slots/assign] Payload recebido:", JSON.stringify(body, null, 2));
      
      const payload = assignSchema.parse(body);
      console.log("[POST /api/tv/slots/assign] Payload validado:", JSON.stringify(payload, null, 2));
      
      console.log("[POST /api/tv/slots/assign] Iniciando atribuição de slot...");
      const slot = await assignSlotToClient(payload);
      console.log("[POST /api/tv/slots/assign] ✅ Slot atribuído com sucesso:", slot.id);
      
      return NextResponse.json(slot, { status: 201 });
    } catch (error) {
      console.error("[POST /api/tv/slots/assign] ❌ ERRO:", error);
      if (error instanceof z.ZodError) {
        console.error("[POST /api/tv/slots/assign] Erro de validação Zod:", error.errors);
        throw new Error(`Dados inválidos: ${error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ')}`);
      }
      throw error;
    }
  },
  { requireAdmin: true }
);





