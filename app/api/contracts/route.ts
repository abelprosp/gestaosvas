import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createApiHandler } from "@/lib/utils/apiHandler";
import { createServerClient } from "@/lib/supabase/server";
import { HttpError } from "@/lib/utils/httpError";
import { mapContractRow, contractInsertPayload, contractUpdatePayload } from "@/lib/utils/mappers";
import { mapClientRow, mapLineRow, mapTemplateRow } from "@/lib/utils/mappers";
import { generateContractContent } from "@/lib/utils/contractGenerator";
import { sendToZapsign } from "@/lib/services/zapsignSimulator";

const CONTRACT_STATUSES = ["DRAFT", "SENT", "SIGNED", "CANCELLED"] as const;
type ContractStatusValue = (typeof CONTRACT_STATUSES)[number];

const createContractSchema = z.object({
  title: z.string().min(3),
  clientId: z.string().uuid(),
  templateId: z.string().uuid().optional(),
  customFields: z.record(z.string(), z.string()).optional(),
  contentOverride: z.string().optional(),
});

export const GET = createApiHandler(async (req) => {
  const supabase = createServerClient();
  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status")?.toUpperCase() || undefined;
  const clientId = searchParams.get("clientId") || undefined;
  const searchRaw = searchParams.get("search")?.trim() || "";
  const pageParam = Number(searchParams.get("page") ?? "1");
  const limitParam = Number(searchParams.get("limit") ?? "50");
  const safePage = Number.isFinite(pageParam) && pageParam > 0 ? Math.floor(pageParam) : 1;
  const safeLimit = Number.isFinite(limitParam) && limitParam > 0 ? Math.floor(limitParam) : 50;
  const offset = (safePage - 1) * safeLimit;

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

  return NextResponse.json({
    data: mapped,
    page: safePage,
    limit: safeLimit,
    total,
    totalPages,
    summary: {
      statusCounts,
    },
  });
});

export const POST = createApiHandler(async (req) => {
  const supabase = createServerClient();
  const body = await req.json();
  const payload = createContractSchema.parse(body);
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
      : generateContractContent("Contrato para {{clientName}} gerado em {{currentDate}}", mergedFields);

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

  return NextResponse.json(mapContractRow(createdRow!), { status: 201 });
});





