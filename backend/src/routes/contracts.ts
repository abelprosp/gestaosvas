import { Router } from "express";
import { z } from "zod";
import supabase from "../supabaseClient";
import { generateContractContent } from "../utils/contractGenerator";
import { HttpError } from "../utils/httpError";
import { sendToZapsign, waitForSignatureSimulation } from "../services/zapsignSimulator";
import {
  contractInsertPayload,
  contractUpdatePayload,
  mapClientRow,
  mapContractRow,
  mapLineRow,
  mapTemplateRow,
} from "../utils/mappers";

const router = Router();

const CONTRACT_STATUSES = ["DRAFT", "SENT", "SIGNED", "CANCELLED"] as const;
type ContractStatusValue = (typeof CONTRACT_STATUSES)[number];

const createContractSchema = z.object({
  title: z.string().min(3),
  clientId: z.string().uuid(),
  templateId: z.string().uuid().optional(),
  customFields: z.record(z.string(), z.string()).optional(),
  contentOverride: z.string().optional(),
});

router.get("/", async (req, res, next) => {
  const status = typeof req.query.status === "string" ? req.query.status.toUpperCase() : undefined;
  const clientId = req.query.clientId as string | undefined;
  const searchRaw = typeof req.query.search === "string" ? req.query.search.trim() : "";
  const pageParam = Number(req.query.page ?? "1");
  const limitParam = Number(req.query.limit ?? "50");
  const safePage = Number.isFinite(pageParam) && pageParam > 0 ? Math.floor(pageParam) : 1;
  const safeLimit = Number.isFinite(limitParam) && limitParam > 0 ? Math.floor(limitParam) : 50;
  const offset = (safePage - 1) * safeLimit;

  try {
    let query = supabase
      .from("contracts")
      .select("*, client:clients(*), template:contract_templates(*)", { count: "exact" })
      .order("created_at", { ascending: false });

    if (status && CONTRACT_STATUSES.includes(status as ContractStatusValue)) {
      query = query.eq("status", status);
    }
    if (clientId) {
      query = query.eq("client_id", clientId);
    }
    if (searchRaw.length) {
      const ilike = `%${searchRaw}%`;
      query = query.or([`title.ilike.${ilike}`, `status.ilike.${ilike}`].join(","));
      query = query.or(
        [`name.ilike.${ilike}`, `document.ilike.${ilike}`, `email.ilike.${ilike}`].join(","),
        { foreignTable: "client" },
      );
    }

    const { data, error, count } = await query.range(offset, offset + safeLimit - 1);

    if (error) {
      throw error;
    }

    const mapped = (data ?? []).map(mapContractRow);
    const total = count ?? mapped.length;
    const totalPages = Math.max(1, Math.ceil(total / safeLimit));

    const statusCountsEntries = await Promise.all(
      CONTRACT_STATUSES.map(async (value) => {
        const { count: statusCount, error: statusError } = await supabase
          .from("contracts")
          .select("id", { count: "exact", head: true })
          .eq("status", value);

        if (statusError) {
          throw statusError;
        }

        return [value, statusCount ?? 0] as const;
      }),
    );

    const statusCounts = Object.fromEntries(statusCountsEntries) as Record<ContractStatusValue, number>;

    res.json({
      data: mapped,
      page: safePage,
      limit: safeLimit,
      total,
      totalPages,
      summary: {
        statusCounts,
      },
    });
  } catch (error) {
    next(error);
  }
});

router.get("/:id", async (req, res, next) => {
  try {
    const { data, error } = await supabase
      .from("contracts")
      .select("*, client:clients(*, lines(*)), template:contract_templates(*)")
      .eq("id", req.params.id)
      .maybeSingle();

    if (error) {
      throw error;
    }

    if (!data) {
      throw new HttpError(404, "Contrato não encontrado");
    }

    const contract = mapContractRow(data);
    const clientLines = data.client?.lines ? data.client.lines.map(mapLineRow) : [];
    const client = data.client ? { ...mapClientRow(data.client), lines: clientLines } : undefined;
    const template = data.template ? mapTemplateRow(data.template) : undefined;

    res.json({ ...contract, client, template });
  } catch (error) {
    next(error);
  }
});

router.post("/", async (req, res, next) => {
  try {
    const payload = createContractSchema.parse(req.body);
    const { data: clientRow, error: clientError } = await supabase
      .from("clients")
      .select("*, lines(*)")
      .eq("id", payload.clientId)
      .maybeSingle();

    if (clientError) {
      throw clientError;
    }

    if (!clientRow) {
      throw new HttpError(404, "Cliente não encontrado");
    }

    const { data: templateRow, error: templateError } = payload.templateId
      ? await supabase
          .from("contract_templates")
          .select("*")
          .eq("id", payload.templateId)
          .maybeSingle()
      : { data: null, error: null };

    if (templateError) {
      throw templateError;
    }

    if (payload.templateId && !templateRow) {
      throw new HttpError(404, "Template não encontrado");
    }

    const linesList = (clientRow.lines ?? [])
      .map((line: any) => {
        const type = line.type === "TITULAR" ? "Titular" : "Dependente";
        const extra = [line.nickname, line.document].filter(Boolean).join(" · ");
        return `${type}: ${line.phone_number}${extra ? ` (${extra})` : ""}`;
      })
      .join("\n");

    const defaultFields: Record<string, string> = {
      clientName: clientRow.name,
      clientEmail: clientRow.email,
      clientDocument: clientRow.document,
      clientPhone: clientRow.phone ?? "",
      companyName: clientRow.company_name ?? "",
      clientAddress: clientRow.address ?? "",
      clientCity: clientRow.city ?? "",
      clientState: clientRow.state ?? "",
      linesList,
      currentDate: new Date().toLocaleDateString("pt-BR"),
    };

    const mergedFields: Record<string, string | number | null | undefined> = {
      ...defaultFields,
      ...(payload.customFields ?? {}),
    };

    const content = payload.contentOverride
      ? payload.contentOverride
      : templateRow
      ? generateContractContent(templateRow.content, mergedFields)
      : generateContractContent(
          "Contrato para {{clientName}} gerado em {{currentDate}}",
          mergedFields,
        );

    const insertPayload = contractInsertPayload({
      title: payload.title,
      clientId: payload.clientId,
      templateId: payload.templateId,
      content,
    });

    const { data: createdRow, error: insertError } = await supabase
      .from("contracts")
      .insert(insertPayload)
      .select("*, client:clients(*), template:contract_templates(*)")
      .maybeSingle();

    if (insertError) {
      throw insertError;
    }

    res.status(201).json(mapContractRow(createdRow!));
  } catch (error) {
    next(error);
  }
});

router.post("/:id/send", async (req, res, next) => {
  try {
    const { data: contractRow, error } = await supabase
      .from("contracts")
      .select("*, client:clients(*)")
      .eq("id", req.params.id)
      .maybeSingle();

    if (error) {
      throw error;
    }

    if (!contractRow) {
      throw new HttpError(404, "Contrato não encontrado");
    }

    if (contractRow.status === "CANCELLED") {
      throw new HttpError(400, "Contrato cancelado não pode ser enviado");
    }

    const result = await sendToZapsign({
      contractId: contractRow.id,
      title: contractRow.title,
      clientName: contractRow.client?.name ?? "",
      clientEmail: contractRow.client?.email ?? "",
    });

    const updatePayload = contractUpdatePayload({
      status: "SENT",
      sentAt: new Date().toISOString(),
      signUrl: result.signUrl,
      externalId: result.externalId,
    });

    const { data: updatedRow, error: updateError } = await supabase
      .from("contracts")
      .update(updatePayload)
      .eq("id", contractRow.id)
      .select("*, client:clients(*), template:contract_templates(*)")
      .maybeSingle();

    if (updateError) {
      throw updateError;
    }

    res.json({ contract: mapContractRow(updatedRow!), message: result.message });
  } catch (error) {
    next(error);
  }
});

router.post("/:id/sign", async (req, res, next) => {
  try {
    const { data: contractRow, error } = await supabase
      .from("contracts")
      .select("*")
      .eq("id", req.params.id)
      .maybeSingle();

    if (error) {
      throw error;
    }

    if (!contractRow) {
      throw new HttpError(404, "Contrato não encontrado");
    }

    if (contractRow.status !== "SENT") {
      throw new HttpError(400, "Contrato precisa estar enviado para ser assinado");
    }

    await waitForSignatureSimulation(contractRow.id);

    const updatePayload = contractUpdatePayload({
      status: "SIGNED",
      signedAt: new Date().toISOString(),
    });

    const { data: updatedRow, error: updateError } = await supabase
      .from("contracts")
      .update(updatePayload)
      .eq("id", contractRow.id)
      .select("*, client:clients(*), template:contract_templates(*)")
      .maybeSingle();

    if (updateError) {
      throw updateError;
    }

    res.json({ contract: mapContractRow(updatedRow!), message: "Contrato assinado com sucesso" });
  } catch (error) {
    next(error);
  }
});

router.post("/:id/cancel", async (req, res, next) => {
  try {
    const updatePayload = contractUpdatePayload({ status: "CANCELLED" });
    const { data, error } = await supabase
      .from("contracts")
      .update(updatePayload)
      .eq("id", req.params.id)
      .select("*, client:clients(*), template:contract_templates(*)")
      .maybeSingle();

    if (error) {
      throw error;
    }

    if (!data) {
      throw new HttpError(404, "Contrato não encontrado");
    }

    res.json({ contract: mapContractRow(data), message: "Contrato cancelado" });
  } catch (error) {
    next(error);
  }
});

export default router;

