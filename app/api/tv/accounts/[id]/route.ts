import { NextRequest, NextResponse } from "next/server";
import { createApiHandler } from "@/lib/utils/apiHandler";
import { createServerClient } from "@/lib/supabase/server";
import { mapTVAccountRow } from "@/lib/utils/mappers";
import { z } from "zod";
import { HttpError } from "@/lib/utils/httpError";
import { PostgrestError } from "@supabase/supabase-js";

function isUniqueViolation(error: PostgrestError) {
  return error.code === "23505";
}

const updateAccountSchema = z.object({
  email: z.string().trim().min(1, "Email não pode estar vazio").email("Email inválido"),
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
      throw new HttpError(
        409,
        "Este e-mail já está cadastrado em outra conta de TV. Cada e-mail deve ser único no sistema."
      );
    }

    // Atualizar o email da conta
    const { data: account, error: updateError } = await supabase
      .from("tv_accounts")
      .update({ email: email.toLowerCase().trim() })
      .eq("id", accountId)
      .select()
      .single();

    if (updateError) {
      // Se for erro de constraint única (pode acontecer em race conditions)
      if (isUniqueViolation(updateError as PostgrestError)) {
        throw new HttpError(
          409,
          "Este e-mail já está cadastrado em outra conta de TV. Cada e-mail deve ser único no sistema."
        );
      }
      throw updateError;
    }

    if (!account) {
      throw new HttpError(404, "Conta não encontrada");
    }

    return NextResponse.json(mapTVAccountRow(account));
  },
  { requireAdmin: true }
);

export const DELETE = createApiHandler(
  async (req, { params }) => {
    const accountId = params.id;
    const supabase = createServerClient();

    // Verificar se a conta existe
    const { data: account, error: fetchError } = await supabase
      .from("tv_accounts")
      .select("id, email")
      .eq("id", accountId)
      .maybeSingle();

    if (fetchError) {
      throw fetchError;
    }

    if (!account) {
      throw new HttpError(404, "Conta não encontrada");
    }

    // Verificar se há slots atribuídos a clientes (apenas para informar)
    const { data: assignedSlots, error: slotsError } = await supabase
      .from("tv_slots")
      .select("id, client_id")
      .eq("tv_account_id", accountId)
      .not("client_id", "is", null);

    if (slotsError) {
      throw slotsError;
    }

    const assignedCount = assignedSlots?.length ?? 0;

    // Deletar a conta (os slots serão deletados automaticamente por cascade)
    const { error: deleteError } = await supabase
      .from("tv_accounts")
      .delete()
      .eq("id", accountId);

    if (deleteError) {
      throw deleteError;
    }

    return NextResponse.json({
      message: "Conta removida com sucesso",
      deletedAccount: {
        id: account.id,
        email: account.email,
      },
      slotsRemoved: assignedCount > 0 ? `${assignedCount} slot(s) atribuído(s) também foram removido(s)` : undefined,
    });
  },
  { requireAdmin: true }
);


