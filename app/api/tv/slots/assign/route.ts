import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createApiHandler } from "@/lib/utils/apiHandler";
import { HttpError } from "@/lib/utils/httpError";
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
    let body;
    try {
      body = await req.json();
    } catch (error) {
      console.error("[POST /api/tv/slots/assign] Erro ao fazer parse do JSON:", error);
      throw new HttpError(400, "Corpo da requisição inválido ou malformado. Verifique o formato JSON.");
    }
    
    console.log("[POST /api/tv/slots/assign] Payload recebido:", JSON.stringify(body, null, 2));
    
    let payload;
    try {
      payload = assignSchema.parse(body);
    } catch (error) {
      if (error instanceof z.ZodError) {
        const errorMessages = error.errors.map((e) => {
          const path = e.path.length > 0 ? e.path.join(".") : "raiz";
          return `${path}: ${e.message}`;
        }).join(", ");
        console.error("[POST /api/tv/slots/assign] Erro de validação:", error.errors);
        throw new HttpError(400, `Dados inválidos: ${errorMessages}`);
      }
      throw error;
    }
    
    console.log("[POST /api/tv/slots/assign] Payload validado:", JSON.stringify(payload, null, 2));
    console.log("[POST /api/tv/slots/assign] Iniciando atribuição de slot...");
    const slot = await assignSlotToClient(payload);
    console.log("[POST /api/tv/slots/assign] ✅ Slot atribuído com sucesso:", slot.id);
    
    return NextResponse.json(slot, { status: 201 });
  },
  { requireAdmin: true }
);





