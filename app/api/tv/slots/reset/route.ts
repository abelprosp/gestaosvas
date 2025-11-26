import { NextRequest, NextResponse } from "next/server";
import { createApiHandler } from "@/lib/utils/apiHandler";
import { resetTvSlotsToStart } from "@/lib/services/tvAssignments";

export const POST = createApiHandler(
  async (req) => {
    const result = await resetTvSlotsToStart();
    return NextResponse.json({
      message: "Slots TV resetados com sucesso. Sistema pronto para começar do 1a8.",
      ...result,
    });
  },
  { requireAdmin: true } // Apenas admin pode executar
);




