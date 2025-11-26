import { NextRequest, NextResponse } from "next/server";
import { createApiHandler } from "@/lib/utils/apiHandler";
import { createServerClient } from "@/lib/supabase/server";
import { mapTVAccountRow } from "@/lib/utils/mappers";
import { z } from "zod";
import { HttpError } from "@/lib/utils/httpError";

const updateAccountSchema = z.object({
  email: z.string().email("Email inválido"),
});

export const PATCH = createApiHandler(
  async (req, { params }) => {
    const accountId = params.id;
    const body = await req.json();
    const { email } = updateAccountSchema.parse(body);

    const supabase = createServerClient();

    // Verificar se o email já existe em outra conta
    const { data: existing, error: checkError } = await supabase
      .from("tv_accounts")
      .select("id")
      .eq("email", email.toLowerCase().trim())
      .neq("id", accountId)
      .maybeSingle();

    if (checkError) {
      throw checkError;
    }

    if (existing) {
      throw new HttpError(409, "Este e-mail já está cadastrado em outra conta");
    }

    // Atualizar o email da conta
    const { data: account, error: updateError } = await supabase
      .from("tv_accounts")
      .update({ email: email.toLowerCase().trim() })
      .eq("id", accountId)
      .select()
      .single();

    if (updateError) {
      throw updateError;
    }

    if (!account) {
      throw new HttpError(404, "Conta não encontrada");
    }

    return NextResponse.json(mapTVAccountRow(account));
  },
  { requireAdmin: true }
);


