import { NextRequest, NextResponse } from "next/server";
import { createApiHandler } from "@/lib/utils/apiHandler";
import { createServerClient } from "@/lib/supabase/server";
import { mapTVAccountRow, mapTVSlotRow } from "@/lib/utils/mappers";
import { z } from "zod";
import { generateNumericPassword } from "@/lib/utils/password";
import { HttpError } from "@/lib/utils/httpError";

export const GET = createApiHandler(async (req) => {
  const supabase = createServerClient();
  const { data, error } = await supabase
    .from("tv_accounts")
    .select("id, email, max_slots, created_at, tv_slots(id, slot_number, username, custom_username, status, client_id)")
    .order("email", { ascending: true })
    .order("slot_number", { ascending: true, foreignTable: "tv_slots" });

  if (error) {
    throw error;
  }

  const formatted = (data ?? []).map((account) => ({
    account: mapTVAccountRow(account),
    slots: (account.tv_slots ?? []).map((slot: any) => mapTVSlotRow({ ...slot, tv_accounts: account })),
  }));

  return NextResponse.json(formatted);
});

const createAccountSchema = z.object({
  email: z.string().email("Email inválido"),
});

export const POST = createApiHandler(
  async (req) => {
    const body = await req.json();
    const { email } = createAccountSchema.parse(body);

    const supabase = createServerClient();

    // Verificar se o email já existe
    const { data: existing, error: checkError } = await supabase
      .from("tv_accounts")
      .select("id")
      .eq("email", email.toLowerCase().trim())
      .maybeSingle();

    if (checkError) {
      throw checkError;
    }

    if (existing) {
      throw new HttpError(409, "Este e-mail já está cadastrado");
    }

    // Criar a conta com max_slots padrão (8)
    const { data: account, error: accountError } = await supabase
      .from("tv_accounts")
      .insert({ email: email.toLowerCase().trim(), max_slots: 8 })
      .select("id")
      .single();

    if (accountError) {
      throw accountError;
    }

    // Criar os slots para a conta (padrão 8, mas pode ser configurado via max_slots)
    const maxSlots = 8; // Padrão ao criar manualmente
    const slotsToInsert = Array.from({ length: maxSlots }, (_, i) => ({
      tv_account_id: account.id,
      slot_number: i + 1,
      username: `#${i + 1}`,
      status: "AVAILABLE",
      password: generateNumericPassword(),
    }));

    const { error: slotsError } = await supabase.from("tv_slots").insert(slotsToInsert);

    if (slotsError) {
      // Se falhar ao criar slots, remover a conta criada
      await supabase.from("tv_accounts").delete().eq("id", account.id);
      throw slotsError;
    }

    // Buscar a conta criada com os slots
    const { data: createdAccount, error: fetchError } = await supabase
      .from("tv_accounts")
      .select("*, tv_slots(*)")
      .eq("id", account.id)
      .single();

    if (fetchError) {
      throw fetchError;
    }

    return NextResponse.json({
      account: mapTVAccountRow(createdAccount),
      slots: (createdAccount.tv_slots ?? []).map((slot: any) =>
        mapTVSlotRow({ ...slot, tv_accounts: createdAccount }),
      ),
    });
  },
  { requireAdmin: true }
);





