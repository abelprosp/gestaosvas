import { NextRequest, NextResponse } from "next/server";
import { createApiHandler } from "@/lib/utils/apiHandler";
import { HttpError } from "@/lib/utils/httpError";

function sanitizeDocument(document: string): string {
  const digits = document.replace(/\D/g, "");
  if (digits.length === 11 || digits.length === 14) {
    return digits;
  }
  throw new HttpError(400, "Informe um CPF ou CNPJ válido.");
}

function sanitizeCnpj(document: string): string {
  const digits = sanitizeDocument(document);
  if (digits.length !== 14) {
    throw new HttpError(400, "Informe um CNPJ válido com 14 dígitos.");
  }
  return digits;
}

type BrasilApiCnpjResponse = {
  cnpj: string;
  razao_social?: string | null;
  nome_fantasia?: string | null;
  logradouro?: string | null;
  numero?: string | null;
  complemento?: string | null;
  bairro?: string | null;
  municipio?: string | null;
  uf?: string | null;
  cep?: string | null;
  telefone?: string | null;
  ddd_telefone_1?: string | null;
  email?: string | null;
  porte?: string | null;
  abertura?: string | null;
};

function formatCep(value?: string | null) {
  if (!value) {
    return null;
  }
  const digits = value.replace(/\D/g, "");
  if (digits.length !== 8) {
    return digits || null;
  }
  return `${digits.substring(0, 2)}.${digits.substring(2, 5)}-${digits.substring(5)}`;
}

function formatPhone(value?: string | null, fallbackDdd?: string | null) {
  if (!value && !fallbackDdd) {
    return null;
  }
  const digits = `${fallbackDdd ?? ""}${value ?? ""}`.replace(/\D/g, "");
  if (!digits) {
    return null;
  }
  if (digits.length === 11) {
    return `(${digits.substring(0, 2)}) ${digits.substring(2, 7)}-${digits.substring(7)}`;
  }
  if (digits.length === 10) {
    return `(${digits.substring(0, 2)}) ${digits.substring(2, 6)}-${digits.substring(6)}`;
  }
  return digits;
}

async function fetchCnpjData(cnpj: string): Promise<BrasilApiCnpjResponse> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  try {
    const response = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${cnpj}`, {
      headers: {
        accept: "application/json",
      },
      signal: controller.signal,
    });
    let payload: unknown = null;
    try {
      payload = await response.json();
    } catch (parseError) {
      console.error("[fetchCnpjData] Falha ao converter resposta da BrasilAPI", parseError);
    }

    if (!response.ok || !payload) {
      const message =
        (payload as { message?: string })?.message ??
        (response.status === 404 ? "CNPJ não encontrado." : "Não foi possível consultar o CNPJ no momento.");
      throw new HttpError(response.status === 404 ? 404 : 502, message);
    }

    return payload as BrasilApiCnpjResponse;
  } catch (error) {
    if (error instanceof HttpError) {
      throw error;
    }
    if ((error as Error)?.name === "AbortError") {
      throw new HttpError(504, "Tempo excedido ao consultar o CNPJ. Tente novamente.");
    }
    console.error("[fetchCnpjData] Erro inesperado", error);
    throw new HttpError(502, "Não foi possível consultar o CNPJ no momento.");
  } finally {
    clearTimeout(timeout);
  }
}

function buildAddress(row: BrasilApiCnpjResponse) {
  const street = [row.logradouro?.trim(), row.numero?.trim()].filter(Boolean).join(", ");
  const complement = row.complemento?.trim();
  const neighborhood = row.bairro?.trim();
  const parts = [street || null, complement || null, neighborhood || null].filter(
    (value): value is string => Boolean(value),
  );
  return parts.join(" · ") || null;
}

export const GET = createApiHandler(async (req, { params }) => {
  const cnpj = sanitizeCnpj(params.cnpj ?? "");
  const data = await fetchCnpjData(cnpj);
  const companyName = data.razao_social?.trim() ?? null;
  const tradeName = data.nome_fantasia?.trim() ?? null;
  const name = tradeName || companyName || "";
  const address = buildAddress(data);
  const city = data.municipio?.trim() ?? null;
  const state = data.uf?.trim() ?? null;
  const phone = formatPhone(data.telefone, data.ddd_telefone_1);
  const postalCode = formatCep(data.cep);

  return NextResponse.json({
    document: cnpj,
    name: name || null,
    companyName,
    tradeName,
    address,
    city,
    state,
    phone,
    postalCode,
    email: data.email?.trim() || null,
    openingDate: data.abertura ?? null,
  });
});



