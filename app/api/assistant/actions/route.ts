import { NextResponse } from "next/server";
import { z } from "zod";
import { createApiHandler } from "@/lib/utils/apiHandler";
import { createServerClient } from "@/lib/supabase/server";
import { HttpError } from "@/lib/utils/httpError";
import { generateNumericPassword } from "@/lib/utils/password";
import { assignMultipleSlotsToClient, assignSlotToClient } from "@/lib/services/tvAssignments";
import type { TVPlanType } from "@/types";

const actionSchema = z.discriminatedUnion("key", [
  z.object({
    key: z.literal("VENDOR_CREATE_REQUEST"),
    args: z.object({ description: z.string().min(3) }),
  }),
  z.object({
    key: z.literal("TV_RENEW"),
    args: z.object({
      email: z.string().email(),
      slotNumber: z.number().int().min(1).max(50),
      expiresAt: z.string().min(8),
    }),
  }),
  z.object({
    key: z.literal("TV_REGENERATE_PASSWORD"),
    args: z.object({
      email: z.string().email(),
      slotNumber: z.number().int().min(1).max(50),
    }),
  }),
  z.object({
    key: z.literal("TV_SET_PASSWORD"),
    args: z.object({
      email: z.string().email(),
      slotNumber: z.number().int().min(1).max(50),
      password: z.string().min(4).max(32),
    }),
  }),
  z.object({
    key: z.literal("CLIENT_CREATE"),
    args: z.object({
      name: z.string().min(2),
      email: z.string().email(),
      document: z.string().min(5),
      costCenter: z.enum(["LUXUS", "NEXUS"]),
      phone: z.string().optional(),
      companyName: z.string().optional(),
      notes: z.string().optional(),
    }),
  }),
  z.object({
    key: z.literal("CLIENT_ADD_SERVICES"),
    args: z.object({
      clientDocument: z.string().min(5),
      serviceNames: z.array(z.string().min(2)).default([]),
      tv: z
        .object({
          quantityEssencial: z.number().int().min(0).max(50).default(0),
          quantityPremium: z.number().int().min(0).max(50).default(0),
          soldBy: z.string().min(1).optional(),
          expiresAt: z.string().min(8).optional(),
          hasTelephony: z.boolean().optional(),
        })
        .optional(),
      cloud: z
        .array(
          z.object({
            serviceName: z.string().min(2),
            expiresAt: z.string().min(8),
            isTest: z.boolean().optional(),
            notes: z.string().optional(),
          }),
        )
        .default([]),
    }),
  }),
]);

type ActionInput = z.infer<typeof actionSchema>;

function normalizeDigits(value: string) {
  return value.replace(/\D/g, "");
}

async function findClientIdByDocument(supabase: ReturnType<typeof createServerClient>, document: string) {
  const doc = normalizeDigits(document);
  const { data, error } = await supabase.from("clients").select("id").eq("document", doc).maybeSingle();
  if (error) throw error;
  if (!data?.id) throw new HttpError(404, "Cliente não encontrado para o documento informado.");
  return data.id as string;
}

async function findTvSlotIdByEmailAndSlotNumber(
  supabase: ReturnType<typeof createServerClient>,
  email: string,
  slotNumber: number,
) {
  const normalizedEmail = email.toLowerCase().trim();
  const { data: account, error: accError } = await supabase
    .from("tv_accounts")
    .select("id")
    .eq("email", normalizedEmail)
    .maybeSingle();
  if (accError) throw accError;
  if (!account?.id) throw new HttpError(404, "Conta de TV não encontrada para o e-mail informado.");

  const { data: slot, error: slotError } = await supabase
    .from("tv_slots")
    .select("id")
    .eq("tv_account_id", account.id)
    .eq("slot_number", slotNumber)
    .maybeSingle();
  if (slotError) throw slotError;
  if (!slot?.id) throw new HttpError(404, "Slot não encontrado para o e-mail e número de slot informados.");
  return slot.id as string;
}

export const POST = createApiHandler(async (req, { user }) => {
  const input = actionSchema.parse(await req.json()) as ActionInput;

  if (!user?.id) {
    throw new HttpError(401, "Usuário não autenticado.");
  }

  const isAdminUser = user.role === "admin";

  // Não-admin: sempre registrar como solicitação (execução manual pelo admin)
  if (!isAdminUser) {
    const supabase = createServerClient();
    const { error } = await supabase.from("action_requests").insert({
      user_id: user.id,
      action: input.key,
      payload: (input as any).args ?? null,
    });
    if (error) throw error;
    return NextResponse.json({ message: "Solicitação enviada. O administrador foi notificado.", mode: "request" });
  }

  // Admin: executar ações
  const supabase = createServerClient(true);

  switch (input.key) {
    case "VENDOR_CREATE_REQUEST": {
      const { error } = await supabase.from("action_requests").insert({
        user_id: user.id,
        action: input.key,
        payload: input.args,
      });
      if (error) throw error;
      return NextResponse.json({ message: "Solicitação registrada.", mode: "request" });
    }
    case "TV_RENEW": {
      const slotId = await findTvSlotIdByEmailAndSlotNumber(supabase, input.args.email, input.args.slotNumber);
      const { error } = await supabase
        .from("tv_slots")
        .update({ expires_at: input.args.expiresAt, updated_at: new Date().toISOString() })
        .eq("id", slotId);
      if (error) throw error;
      return NextResponse.json({ message: "Vencimento atualizado com sucesso.", mode: "executed" });
    }
    case "TV_REGENERATE_PASSWORD": {
      const slotId = await findTvSlotIdByEmailAndSlotNumber(supabase, input.args.email, input.args.slotNumber);
      const password = generateNumericPassword();
      const { error } = await supabase
        .from("tv_slots")
        .update({ password, updated_at: new Date().toISOString() })
        .eq("id", slotId);
      if (error) throw error;
      await supabase.from("tv_slot_history").insert({
        tv_slot_id: slotId,
        action: "PASSWORD_REGENERATED",
        metadata: { password },
      });
      return NextResponse.json({ message: `Senha gerada: ${password}`, mode: "executed" });
    }
    case "TV_SET_PASSWORD": {
      const slotId = await findTvSlotIdByEmailAndSlotNumber(supabase, input.args.email, input.args.slotNumber);
      const { error } = await supabase
        .from("tv_slots")
        .update({ password: input.args.password, updated_at: new Date().toISOString() })
        .eq("id", slotId);
      if (error) throw error;
      await supabase.from("tv_slot_history").insert({
        tv_slot_id: slotId,
        action: "PASSWORD_SET",
        metadata: { password: input.args.password },
      });
      return NextResponse.json({ message: "Senha definida com sucesso.", mode: "executed" });
    }
    case "CLIENT_CREATE": {
      const doc = normalizeDigits(input.args.document);
      const { data, error } = await supabase
        .from("clients")
        .insert({
          name: input.args.name,
          email: input.args.email,
          document: doc,
          cost_center: input.args.costCenter,
          phone: input.args.phone ?? null,
          company_name: input.args.companyName ?? null,
          notes: input.args.notes ?? null,
          opened_by: user.id,
        })
        .select("id")
        .maybeSingle();
      if (error) throw error;
      return NextResponse.json({ message: "Cliente criado com sucesso.", clientId: data?.id ?? null, mode: "executed" });
    }
    case "CLIENT_ADD_SERVICES": {
      const clientId = await findClientIdByDocument(supabase, input.args.clientDocument);
      const soldBy = input.args.tv?.soldBy ?? user.id;

      // Resolver serviços por nome
      const serviceNames = input.args.serviceNames ?? [];
      const uniqueNames = Array.from(new Set(serviceNames.map((s) => s.trim()).filter(Boolean)));
      const { data: services } = uniqueNames.length
        ? await supabase
            .from("services")
            .select("id, name")
            .or(uniqueNames.map((name) => `name.ilike.%${name}%`).join(","))
            .limit(200)
        : { data: [] as any[] };

      const selections: Array<{ serviceId: string; soldBy?: string | null }> = [];
      for (const s of services ?? []) {
        if (!s?.id) continue;
        selections.push({ serviceId: s.id, soldBy });
      }

      // Garantir vínculo do serviço "TV" caso vá atribuir slots
      const qE = input.args.tv?.quantityEssencial ?? 0;
      const qP = input.args.tv?.quantityPremium ?? 0;
      if (qE > 0 || qP > 0) {
        const { data: tvService } = await supabase
          .from("services")
          .select("id, name")
          .ilike("name", "tv")
          .limit(1)
          .maybeSingle();
        if (tvService?.id && !selections.some((x) => x.serviceId === tvService.id)) {
          selections.push({ serviceId: tvService.id, soldBy });
        }
      }

      // Sincronizar client_services (modo set)
      await supabase.from("client_services").delete().eq("client_id", clientId);
      if (selections.length) {
        await supabase.from("client_services").insert(
          selections.map((s) => ({
            client_id: clientId,
            service_id: s.serviceId,
            custom_price: null,
            custom_price_essencial: null,
            custom_price_premium: null,
            sold_by: s.soldBy ?? null,
          })),
        );
      }

      // Criar cloud_accesses
      for (const cloud of input.args.cloud ?? []) {
        const { data: cloudService } = await supabase
          .from("services")
          .select("id, name")
          .ilike("name", `%${cloud.serviceName}%`)
          .limit(1)
          .maybeSingle();
        if (!cloudService?.id) continue;
        await supabase.from("cloud_accesses").insert({
          client_id: clientId,
          service_id: cloudService.id,
          expires_at: cloud.expiresAt,
          is_test: cloud.isTest ?? false,
          notes: cloud.notes ?? null,
          sold_by: user.id,
        });
      }

      // Atribuir TV slots
      if (qE > 0) {
        if (qE === 1) {
          await assignSlotToClient({
            clientId,
            soldBy,
            expiresAt: input.args.tv?.expiresAt ?? null,
            planType: "ESSENCIAL" as TVPlanType,
            hasTelephony: input.args.tv?.hasTelephony ?? null,
          });
        } else {
          await assignMultipleSlotsToClient({
            clientId,
            soldBy,
            expiresAt: input.args.tv?.expiresAt ?? null,
            planType: "ESSENCIAL" as TVPlanType,
            hasTelephony: input.args.tv?.hasTelephony ?? null,
            quantity: qE,
          });
        }
      }
      if (qP > 0) {
        if (qP === 1) {
          await assignSlotToClient({
            clientId,
            soldBy,
            expiresAt: input.args.tv?.expiresAt ?? null,
            planType: "PREMIUM" as TVPlanType,
            hasTelephony: input.args.tv?.hasTelephony ?? null,
          });
        } else {
          await assignMultipleSlotsToClient({
            clientId,
            soldBy,
            expiresAt: input.args.tv?.expiresAt ?? null,
            planType: "PREMIUM" as TVPlanType,
            hasTelephony: input.args.tv?.hasTelephony ?? null,
            quantity: qP,
          });
        }
      }

      return NextResponse.json({ message: "Serviços atualizados com sucesso.", mode: "executed" });
    }
  }
});


