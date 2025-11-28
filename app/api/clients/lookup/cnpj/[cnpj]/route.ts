import { NextRequest, NextResponse } from "next/server";
import { createApiHandler } from "@/lib/utils/apiHandler";
import { HttpError } from "@/lib/utils/httpError";
import { rateLimit, RATE_LIMITS } from "@/lib/utils/rateLimit";
import { validateAndSanitizeCnpj } from "@/lib/utils/validation";

function sanitizeDocument(document: string): string {
  const digits = document.replace(/\D/g, "");
  if (digits.length === 11 || digits.length === 14) {
    return digits;
  }
  throw new HttpError(400, "Informe um CPF ou CNPJ válido.");
}

// Função removida - usando validateAndSanitizeCnpj diretamente do módulo de validação

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

// Função formatCep removida - agora retornamos apenas os dígitos
// A formatação será feita no frontend (máscara do input)

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
  const timeout = setTimeout(() => controller.abort(), 15000); // Aumentado para 15s
  const url = `https://brasilapi.com.br/api/cnpj/v1/${cnpj}`;
  
  try {
    console.log(`[fetchCnpjData] Fazendo requisição para: ${url}`);
    
    const response = await fetch(url, {
      headers: {
        accept: "application/json",
        "User-Agent": "GestaoSVAS/1.0",
      },
      signal: controller.signal,
    });
    
    console.log(`[fetchCnpjData] Status da resposta: ${response.status} ${response.statusText}`);
    
    let payload: unknown = null;
    let responseText = "";
    
    try {
      responseText = await response.text();
      console.log(`[fetchCnpjData] Resposta recebida (primeiros 500 chars):`, responseText.substring(0, 500));
      
      if (responseText) {
        payload = JSON.parse(responseText);
      }
    } catch (parseError) {
      console.error(`[fetchCnpjData] Falha ao converter resposta da BrasilAPI. Status: ${response.status}`, {
        parseError,
        responseText: responseText.substring(0, 200),
      });
    }

    if (!response.ok) {
      const message =
        (payload as { message?: string })?.message ??
        (payload as { error?: string })?.error ??
        (response.status === 404 
          ? "CNPJ não encontrado na base de dados." 
          : response.status === 429
          ? "Muitas requisições. Aguarde um momento e tente novamente."
          : `Erro ao consultar CNPJ (${response.status}). Tente novamente.`);
      console.error(`[fetchCnpjData] Resposta não OK. Status: ${response.status}, Message: ${message}`);
      throw new HttpError(response.status === 404 ? 404 : response.status === 429 ? 429 : 502, message);
    }
    
    if (!payload) {
      console.error(`[fetchCnpjData] Payload vazio após parsing`);
      throw new HttpError(502, "Resposta inválida da API de consulta CNPJ.");
    }

    console.log(`[fetchCnpjData] Dados parseados com sucesso`);
    return payload as BrasilApiCnpjResponse;
  } catch (error) {
    if (error instanceof HttpError) {
      throw error;
    }
    if ((error as Error)?.name === "AbortError") {
      console.error(`[fetchCnpjData] Timeout ao consultar CNPJ ${cnpj}`);
      throw new HttpError(504, "Tempo excedido ao consultar o CNPJ. Tente novamente.");
    }
    if (error instanceof TypeError && error.message.includes("fetch")) {
      console.error(`[fetchCnpjData] Erro de rede ao consultar CNPJ:`, error);
      throw new HttpError(503, "Erro de conexão com a API. Verifique sua conexão e tente novamente.");
    }
    console.error(`[fetchCnpjData] Erro inesperado ao consultar CNPJ ${cnpj}:`, {
      error,
      name: (error as Error)?.name,
      message: (error as Error)?.message,
      stack: (error as Error)?.stack,
    });
    throw new HttpError(502, `Não foi possível consultar o CNPJ: ${(error as Error)?.message ?? "Erro desconhecido"}`);
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

export const GET = async (req: NextRequest, context: { params: Promise<{ cnpj: string }> | { cnpj: string } }) => {
  // Aplicar rate limiting (rota pública que faz chamadas externas)
  const rateLimitResult = rateLimit(RATE_LIMITS.CNPJ_LOOKUP)(req);
  if (rateLimitResult) {
    return rateLimitResult; // Retorna 429 se excedido
  }

  const params = typeof context.params === "object" && "then" in context.params
    ? await context.params
    : context.params;

  try {
    const cnpj = validateAndSanitizeCnpj(params.cnpj ?? "");
    console.log(`[CNPJ Lookup] Buscando CNPJ`);
    
    const data = await fetchCnpjData(cnpj);
    // Log sanitizado - não expor dados completos
    console.log(`[CNPJ Lookup] Dados recebidos da BrasilAPI`);
    
    const companyName = data.razao_social?.trim() ?? null;
    const tradeName = data.nome_fantasia?.trim() ?? null;
    const name = tradeName || companyName || "";
    const address = buildAddress(data);
    const city = data.municipio?.trim() ?? null;
    const state = data.uf?.trim() ?? null;
    const phone = formatPhone(data.telefone, data.ddd_telefone_1);
    // Remove formatação do CEP para salvar apenas números
    const postalCode = data.cep ? data.cep.replace(/\D/g, "") : null;
    
    const result = {
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
    };
    
    console.log(`[CNPJ Lookup] Resultado processado com sucesso`);
    
    return NextResponse.json(result);
  } catch (error) {
    console.error(`[CNPJ Lookup] Erro ao buscar CNPJ:`, error);
    throw error;
  }
};



