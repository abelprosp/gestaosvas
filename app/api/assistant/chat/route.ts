import { NextRequest, NextResponse } from "next/server";
import { createApiHandler } from "@/lib/utils/apiHandler";
import { createServerClient } from "@/lib/supabase/server";

export interface ChatMessage {
  sender: "assistant" | "user";
  content: string;
}

type Row = Record<string, unknown>;

function asRow(value: unknown): Row | null {
  if (!value || typeof value !== "object") return null;
  return value as Row;
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function getString(row: Row, key: string): string {
  const v = row[key];
  return typeof v === "string" ? v : "";
}

function getNullableString(row: Row, key: string): string | null {
  const v = row[key];
  return typeof v === "string" ? v : null;
}

function getNullableNumber(row: Row, key: string): number | null {
  const v = row[key];
  return typeof v === "number" ? v : null;
}

function getNullableBoolean(row: Row, key: string): boolean | null {
  const v = row[key];
  return typeof v === "boolean" ? v : null;
}

function buildSystemPrompt(nowPtBr: string) {
  return `Você é um especialista (“doutor”) no Sistema de Gestão de Serviços (telefonia, TV e serviços digitais) desta empresa.

Data/hora atual (referência confiável): ${nowPtBr}. Use isso quando o usuário perguntar por data/hora, "hoje", "amanhã" etc.

### Objetivo
- Ajudar o usuário a usar o sistema: cadastrar, editar, buscar e operar cada função.
- Responder sempre em PT-BR, de forma clara, didática, com passo a passo quando fizer sentido.
- Se a pergunta for ambígua, faça 1-2 perguntas de clarificação.

### Mapa do sistema (telas / menus)
- Dashboard: visão geral, métricas e atalhos.
- Clientes: cadastro, edição, observações do cliente, serviços vinculados, valores, exportação.
- Serviços: catálogo de serviços e preços (inclusive preços personalizados).
- Contratos: criação/edição/envio/assinatura e status.
- Templates: modelos de contrato (conteúdo e ativação).
- Usuários TV: gestão de acessos/slots, plano (Essencial/Premium), vencimentos, observações por acesso e nomes (usernames).
- Usuários Cloud / Hub / Tele: gestão de acessos por serviço, vencimentos, observações.
- Relatórios: relatórios de serviços e exportação (CSV).
- Guia: documentação interna de uso.

### Regras e conceitos importantes (como o sistema funciona)
- “Observações do cliente” (cliente.notes) são diferentes de “observações do acesso/serviço” (ex.: TV slot notes). Nunca misture.
- TV tem dois planos: ESSENCIAL e PREMIUM. Um cliente pode ter ambos.
- Um cliente pode ter “serviços contratados” (Service) e também “acessos” (ex.: slots de TV e acessos cloud).
- Quando o usuário pedir “onde clicar/como fazer”, responda com passo a passo e o nome do botão/tela (ex.: “Clientes” → abrir o cliente → botão “Serviços”).

### Como explicar ações (padrão de resposta)
Quando explicar um fluxo do sistema, use este formato:
1) Onde ir (menu/tela)
2) O que clicar (botões/abas)
3) O que preencher (campos obrigatórios e opcionais)
4) O que esperar (resultado/validações)
5) Dicas/erros comuns (se relevante)

### Conteúdos que você deve cobrir bem (sempre que perguntarem)
- Cadastrar cliente, editar cliente, preencher por CNPJ, onde ficam observações, como adicionar serviços, como definir TV Essencial/Premium, como ver valores, como exportar relatórios, como gerenciar acessos (TV/Cloud/Hub/Tele) e vencimentos.

Se pedirem algo que dependa de dados (ex.: “quantos clientes temos?”), responda explicando como ver no sistema (tela/relatório) e, se possível, peça um critério (período, filtro, cliente).`;
}

function formatNowPtBr() {
  // Queremos hora correta para o Brasil. Em alguns ambientes (ex.: Vercel) TZ vem como UTC (ou ":UTC").
  // Preferimos sempre America/Sao_Paulo, a menos que o usuário configure explicitamente ASSISTANT_TIMEZONE.
  const rawTz = process.env.ASSISTANT_TIMEZONE ?? process.env.TZ;
  const candidate =
    typeof rawTz === "string" && rawTz.trim().length > 0 ? rawTz.trim().replace(/^:/, "") : "";

  const DEFAULT_TZ = "America/Sao_Paulo";
  const blocked = new Set(["UTC", "Etc/UTC", "GMT", "Etc/GMT"]);
  const tzToUse = candidate && !blocked.has(candidate) ? candidate : DEFAULT_TZ;

  const dt = new Date();
  try {
    // valida timezone
    new Intl.DateTimeFormat("pt-BR", { timeZone: tzToUse }).format(dt);
    return new Intl.DateTimeFormat("pt-BR", {
      timeZone: tzToUse,
      dateStyle: "full",
      timeStyle: "medium",
    }).format(dt);
  } catch (error) {
    console.error("[assistant/chat] Timezone inválido, usando DEFAULT_TZ:", {
      rawTz,
      candidate,
      tzToUse,
      error,
    });
    return new Intl.DateTimeFormat("pt-BR", {
      timeZone: DEFAULT_TZ,
      dateStyle: "full",
      timeStyle: "medium",
    }).format(dt);
  }
}

function handleDateTimeQuestion(message: string): string | null {
  const q = message.toLowerCase();
  // perguntas típicas
  if (
    /(que horas|qual.*hora|horas\s*s[aã]o|hora atual)/i.test(q) ||
    /(qual.*data|que dia|data de hoje|hoje\s*(é|eh)\s*que\s*dia|dia de hoje)/i.test(q) ||
    /(que dia.*hoje|hoje.*que dia)/i.test(q)
  ) {
    return formatNowPtBr();
  }
  return null;
}

function normalizeDigits(value: string) {
  return value.replace(/\D/g, "");
}

function extractCpfCnpjDigits(text: string): string | null {
  const digits = normalizeDigits(text);
  const match = digits.match(/(\d{11}|\d{14})/);
  return match?.[1] ?? null;
}

function extractDays(text: string, fallbackDays: number) {
  const m = text.match(/(\d{1,3})\s*(dia|dias)/i);
  if (!m) return fallbackDays;
  const n = Number(m[1]);
  if (!Number.isFinite(n) || n <= 0) return fallbackDays;
  return Math.min(365, n);
}

function looksLikeEmail(text: string) {
  return /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i.test(text);
}

function isLikelyClientQuery(text: string) {
  return /(cliente|cpf|cnpj|documento|empresa|raz[aã]o|nome\s+fantasia|e-?mail)/i.test(text) || looksLikeEmail(text);
}

function isLikelyContractsQuery(text: string) {
  return /(contrato|assinatura|assinar|enviado|rascunho|draft|pendente)/i.test(text);
}

function isLikelyExpiringQuery(text: string) {
  return /(vence|vencimento|vencendo|expira|expirando|renovar|renova[cç][aã]o)/i.test(text);
}

function isLikelyTvQuery(text: string) {
  return /(tv|slot|acesso|perfil|essencial|premium)/i.test(text);
}

function isLikelyServicesQuery(text: string) {
  return /(servi[cç]o|servi[cç]os|cat[aá]logo|pre[cç]o|valores|negoci[aá]vel)/i.test(text);
}

type AssistantQueryContext = {
  nowPtBr: string;
  intent: {
    clients: boolean;
    contracts: boolean;
    expiring: boolean;
    tv: boolean;
    services: boolean;
  };
  extracted: {
    cpfCnpj?: string | null;
    days?: number;
    emailLike?: boolean;
  };
  data: {
    stats?: { clients: number; contracts: number; tvActive: number; services: number };
    clientsSearch?: Array<{ id: string; name: string; document: string; email: string }>;
    clientDetail?: {
      id: string;
      name: string;
      document: string;
      email: string | null;
      phone: string | null;
      companyName: string | null;
      costCenter: string | null;
      notes: string | null;
      createdAt: string | null;
      tv?: {
        essencial: number;
        premium: number;
        active: number;
        slots: Array<{
          slotId: string;
          slotNumber: number | null;
          planType: string | null;
          status: string | null;
          expiresAt: string | null;
          email: string | null;
          username: string | null;
          notes: string | null;
        }>;
      };
      cloudAccesses?: Array<{
        id: string;
        serviceName: string | null;
        expiresAt: string | null;
        isTest: boolean | null;
        notes: string | null;
      }>;
    };
    pendingContracts?: Array<{ id: string; title: string; status: string; clientName: string }>;
    expiring?: Array<{ type: "cloud" | "tv"; expiresAt: string; clientName: string; serviceName: string }>;
    tvAvailable?: number;
    servicesList?: Array<{ id: string; name: string; price: number; allowCustomPrice: boolean }>;
  };
};

async function buildAssistantContext(question: string): Promise<AssistantQueryContext> {
  const nowPtBr = formatNowPtBr();
  const q = question.trim();
  const days = extractDays(q, 30);
  const cpfCnpj = extractCpfCnpjDigits(q);

  const intent = {
    clients: isLikelyClientQuery(q),
    contracts: isLikelyContractsQuery(q),
    expiring: isLikelyExpiringQuery(q),
    tv: isLikelyTvQuery(q),
    services: isLikelyServicesQuery(q),
  };

  let supabase: ReturnType<typeof createServerClient> | null = null;
  try {
    // Para consultas do “cérebro”, preferimos Service Role (não depende de RLS do usuário).
    // Se não existir no ambiente, fazemos fallback para ANON.
    supabase = createServerClient(true);
  } catch (e) {
    console.warn("[assistant/chat] Service role indisponível, usando anon key para contexto:", e);
    supabase = createServerClient(false);
  }

  const context: AssistantQueryContext = {
    nowPtBr,
    intent,
    extracted: { cpfCnpj, days, emailLike: looksLikeEmail(q) },
    data: {},
  };

  const tasks: Array<Promise<void>> = [
    (async () => {
      const [clientsCount, contractsCount, tvSlotsCount, servicesCount] = await Promise.all([
        supabase.from("clients").select("id", { count: "exact", head: true }),
        supabase.from("contracts").select("id", { count: "exact", head: true }),
        supabase.from("tv_slots").select("id", { count: "exact", head: true }).eq("status", "ASSIGNED"),
        supabase.from("services").select("id", { count: "exact", head: true }),
      ]);
      context.data.stats = {
        clients: clientsCount.count ?? 0,
        contracts: contractsCount.count ?? 0,
        tvActive: tvSlotsCount.count ?? 0,
        services: servicesCount.count ?? 0,
      };
    })(),
  ];

  if (intent.clients) {
    tasks.push(
      (async () => {
        const query = cpfCnpj ? cpfCnpj : q;
        const ilike = `%${query}%`;
        const { data } = await supabase
          .from("clients")
          .select("id, name, document, email, phone, company_name, cost_center, notes, created_at")
          .or(`name.ilike.${ilike},document.ilike.${ilike},email.ilike.${ilike}`)
          .limit(10);

        context.data.clientsSearch = asArray(data).map((raw) => {
          const c = asRow(raw) ?? {};
          return {
            id: getString(c, "id"),
            name: getString(c, "name"),
            document: getString(c, "document"),
            email: getString(c, "email"),
          };
        });

        if (cpfCnpj) {
          const exact =
            asArray(data).find((raw) => {
              const c = asRow(raw);
              if (!c) return false;
              return normalizeDigits(getString(c, "document")) === cpfCnpj;
            }) ?? asArray(data)[0];
          const exactRow = asRow(exact);
          if (exactRow) {
            const clientId = getString(exactRow, "id");
            context.data.clientDetail = {
              id: clientId,
              name: getString(exactRow, "name"),
              document: getString(exactRow, "document"),
              email: getNullableString(exactRow, "email"),
              phone: getNullableString(exactRow, "phone"),
              companyName: getNullableString(exactRow, "company_name"),
              costCenter: getNullableString(exactRow, "cost_center"),
              notes: getNullableString(exactRow, "notes"),
              createdAt: getNullableString(exactRow, "created_at"),
            };

            const tvSlots = await supabase
              .from("tv_slots")
              .select("id, slot_number, username, status, expires_at, notes, plan_type, tv_accounts(email)")
              .eq("client_id", clientId)
              .limit(50);

            const tvList = asArray(tvSlots.data).map((rawSlot) => {
              const s = asRow(rawSlot) ?? {};
              const acc = asRow(s["tv_accounts"]);
              return {
                slotId: getString(s, "id"),
                slotNumber: getNullableNumber(s, "slot_number"),
                planType: getNullableString(s, "plan_type"),
                status: getNullableString(s, "status"),
                expiresAt: getNullableString(s, "expires_at"),
                email: acc ? getNullableString(acc, "email") : null,
                username: getNullableString(s, "username"),
                notes: getNullableString(s, "notes"),
              };
            });

            const essencial = tvList.filter((x) => (x.planType ?? "ESSENCIAL") === "ESSENCIAL").length;
            const premium = tvList.filter((x) => x.planType === "PREMIUM").length;
            const active = tvList.filter((x) => x.status === "ASSIGNED").length;
            context.data.clientDetail.tv = { essencial, premium, active, slots: tvList };

            const cloud = await supabase
              .from("cloud_accesses")
              .select("id, expires_at, is_test, notes, service:services(name)")
              .eq("client_id", clientId)
              .limit(50);

            context.data.clientDetail.cloudAccesses = asArray(cloud.data).map((rawAccess) => {
              const a = asRow(rawAccess) ?? {};
              const svc = asRow(a["service"]);
              return {
                id: getString(a, "id"),
                serviceName: svc ? getNullableString(svc, "name") : null,
                expiresAt: getNullableString(a, "expires_at"),
                isTest: getNullableBoolean(a, "is_test"),
                notes: getNullableString(a, "notes"),
              };
            });
          }
        }
      })(),
    );
  }

  if (intent.contracts) {
    tasks.push(
      (async () => {
        const { data } = await supabase
          .from("contracts")
          .select("id, title, status, client:clients(name)")
          .in("status", ["DRAFT", "SENT"])
          .limit(15)
          .order("created_at", { ascending: false });
        context.data.pendingContracts = asArray(data).map((raw) => {
          const c = asRow(raw) ?? {};
          const client = asRow(c["client"]);
          return {
            id: getString(c, "id"),
            title: getString(c, "title"),
            status: getString(c, "status"),
            clientName: client ? getString(client, "name") || "-" : "-",
          };
        });
      })(),
    );
  }

  if (intent.expiring) {
    tasks.push(
      (async () => {
        const targetDate = new Date();
        targetDate.setDate(targetDate.getDate() + days);
        const targetDateStr = targetDate.toISOString().slice(0, 10);
        const todayStr = new Date().toISOString().slice(0, 10);

        const [cloudExpiring, tvExpiring] = await Promise.all([
          supabase
            .from("cloud_accesses")
            .select("id, expires_at, client:clients(name), service:services(name)")
            .lte("expires_at", targetDateStr)
            .gte("expires_at", todayStr)
            .limit(25),
          supabase
            .from("tv_slots")
            .select("id, expires_at, client:clients(name)")
            .lte("expires_at", targetDateStr)
            .gte("expires_at", todayStr)
            .eq("status", "ASSIGNED")
            .not("expires_at", "is", null)
            .limit(25),
        ]);

        const cloudResults = asArray(cloudExpiring.data).map((rawAccess) => {
          const access = asRow(rawAccess) ?? {};
          const client = asRow(access["client"]);
          const service = asRow(access["service"]);
          return {
            type: "cloud" as const,
            expiresAt: getString(access, "expires_at"),
            clientName: client ? getString(client, "name") || "-" : "-",
            serviceName: service ? getString(service, "name") || "-" : "-",
          };
        });
        const tvResults = asArray(tvExpiring.data).map((rawSlot) => {
          const slot = asRow(rawSlot) ?? {};
          const client = asRow(slot["client"]);
          return {
            type: "tv" as const,
            expiresAt: getString(slot, "expires_at"),
            clientName: client ? getString(client, "name") || "-" : "-",
            serviceName: "TV",
          };
        });
        context.data.expiring = [...cloudResults, ...tvResults].slice(0, 25);
      })(),
    );
  }

  if (intent.tv) {
    tasks.push(
      (async () => {
        const { data } = await supabase
          .from("tv_slots")
          .select("id")
          .eq("status", "AVAILABLE")
          .is("client_id", null)
          .limit(2000);
        context.data.tvAvailable = (data ?? []).length;
      })(),
    );
  }

  if (intent.services) {
    tasks.push(
      (async () => {
        const { data } = await supabase
          .from("services")
          .select("id, name, price, allow_custom_price")
          .limit(50)
          .order("name", { ascending: true });
        context.data.servicesList = asArray(data).map((raw) => {
          const s = asRow(raw) ?? {};
          const priceRaw = s["price"];
          const price = typeof priceRaw === "number" ? priceRaw : 0;
          return {
            id: getString(s, "id"),
            name: getString(s, "name"),
            price,
            allowCustomPrice: Boolean(s["allow_custom_price"]),
          };
        });
      })(),
    );
  }

  try {
    await Promise.allSettled(tasks);
  } catch (e) {
    console.error("[assistant/chat] Falha ao montar contexto (continuando sem contexto):", e);
  }
  return context;
}

type GeminiModelPick = { version: "v1" | "v1beta"; model: string };

// Função auxiliar para descobrir modelo disponível e validar o modelo preferido
async function pickAvailableGeminiModel(apiKey: string, preferredModel?: string | null): Promise<GeminiModelPick | null> {
  const versions = ["v1", "v1beta"];
  
  for (const version of versions) {
    try {
      // Tentar listar modelos disponíveis
      const listUrl = `https://generativelanguage.googleapis.com/${version}/models?key=${apiKey}`;
      console.log("[Gemini] Listando modelos da versão", version);
      
      const response = await fetch(listUrl, {
        signal: AbortSignal.timeout(5000),
      });
      
      if (response.ok) {
        const data = await response.json();
        const models = data.models || [];
        console.log("[Gemini] Modelos encontrados:", models.length);

        const supportedModels: string[] = asArray(models)
          .map((raw) => asRow(raw))
          .filter((m): m is Row => Boolean(m))
          .filter((m) => {
            const name = getString(m, "name");
            const methodsVal = m["supportedGenerationMethods"];
            const methods = Array.isArray(methodsVal) ? methodsVal : [];
            const supportsGenerate = methods.some((x) => typeof x === "string" && x === "generateContent");
            const isGemini = name.includes("gemini");
            return isGemini && supportsGenerate;
          })
          .map((m) => getString(m, "name").replace("models/", ""))
          .filter(Boolean);

        // Logs resumidos (não spam)
        console.log("[Gemini] Modelos com generateContent:", supportedModels.slice(0, 10));

        // Se o usuário definiu um modelo, validar contra a lista
        const preferred = preferredModel?.trim();
        if (preferred) {
          if (supportedModels.includes(preferred)) {
            console.log("[Gemini] ✅ Modelo preferido é válido:", preferred, "na versão", version);
            return { version: version as "v1" | "v1beta", model: preferred };
          }
          console.warn("[Gemini] ⚠️ Modelo preferido NÃO está disponível:", preferred);
        }

        // Caso contrário, usar o primeiro modelo disponível
        const first = supportedModels[0];
        if (first) {
          console.log("[Gemini] ✅ Modelo selecionado automaticamente:", first, "na versão", version);
          return { version: version as "v1" | "v1beta", model: first };
        }
      } else {
        const errorText = await response.text();
        console.log("[Gemini] Erro ao listar modelos na versão", version, ":", response.status, errorText.substring(0, 200));
      }
    } catch (error) {
      console.log("[Gemini] Erro ao listar modelos na versão", version, ":", error);
    }
  }
  
  console.log("[Gemini] ❌ Nenhum modelo encontrado na listagem");
  return null;
}

// Função para chamar Google Gemini (GRATUITO - 6M tokens/dia)
async function callGoogleGemini(
  message: string,
  history: ChatMessage[]
): Promise<{ response: string; model: string } | null> {
  const nowPtBr = formatNowPtBr();
  const SYSTEM_PROMPT = buildSystemPrompt(nowPtBr);
  let assistantContext: AssistantQueryContext | null = null;
  try {
    assistantContext = await buildAssistantContext(message);
  } catch (e) {
    console.error("[assistant/chat] Erro ao montar contexto (Gemini). Continuando sem contexto:", e);
  }

  const apiKey = process.env.GOOGLE_API_KEY;
  
  // Log para debug (sem expor a chave completa)
  console.log("[Gemini] API Key presente:", apiKey ? `SIM (${apiKey.substring(0, 10)}...)` : "NÃO");
  
  if (!apiKey) {
    console.log("[Gemini] ❌ API Key não encontrada nas variáveis de ambiente");
    return null;
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);

    const contextBlock = assistantContext
      ? `\n\n### CONTEXTO (DADOS REAIS DO SISTEMA)\n${JSON.stringify(assistantContext, null, 2)}\n\nRegras:\n- Use o CONTEXTO para responder com precisão.\n- Nunca invente dados.\n- Nunca inclua senhas ou credenciais.\n- Se faltar dado no contexto, diga como o usuário pode consultar no sistema (tela/botão) ou peça um critério.\n`
      : `\n\nObservação: contexto do banco indisponível nesta requisição; responda apenas com conhecimento de uso do sistema.\n`;

    // Construir histórico de conversa de forma mais simples
    const contents: Array<{ role: string; parts: Array<{ text: string }> }> = [];
    
    // Se não houver histórico, começar com o prompt do sistema + mensagem
    if (history.length === 0) {
      contents.push({
        role: "user",
        parts: [{ text: `${SYSTEM_PROMPT}${contextBlock}\n\nPergunta do usuário: ${message}` }],
      });
    } else {
      // Adicionar histórico de conversa
      history.slice(-10).forEach((msg) => {
        contents.push({
          role: msg.sender === "user" ? "user" : "model",
          parts: [{ text: msg.content }],
        });
      });
      // Adicionar mensagem atual
      contents.push({
        role: "user",
        parts: [{ text: `${SYSTEM_PROMPT}${contextBlock}\n\nPergunta do usuário: ${message}` }],
      });
    }

    // Descobrir modelo disponível primeiro (e validar GOOGLE_MODEL se estiver setado)
    console.log("[Gemini] Descobrindo modelos disponíveis...");
    const preferredModel = process.env.GOOGLE_MODEL;
    const pick = await pickAvailableGeminiModel(apiKey, preferredModel);
    
    if (!pick) {
      console.error("[Gemini] ❌ Não foi possível descobrir nenhum modelo disponível");
      return null;
    }
    
    console.log("[Gemini] Usando modelo:", pick.model, "na versão", pick.version);

    // Tentar diferentes endpoints
    const endpoints = [
      { version: pick.version, model: pick.model },
      // fallback de versão (caso alguma key tenha diferenças)
      { version: pick.version === "v1" ? "v1beta" : "v1", model: pick.model },
    ];

    let lastError: unknown = null;
    
    for (const endpoint of endpoints) {
      const url = `https://generativelanguage.googleapis.com/${endpoint.version}/models/${endpoint.model}:generateContent?key=${apiKey}`;
      
      console.log("[Gemini] Tentando:", endpoint.version, endpoint.model);
      
      try {
        const response = await fetch(url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            contents,
            generationConfig: {
              temperature: 0.7,
              maxOutputTokens: 500,
            },
          }),
          signal: controller.signal,
        });

        const responseText = await response.text();
        console.log("[Gemini] Status:", response.status, "para", endpoint.model);
        
        if (response.ok) {
          clearTimeout(timeout);
          let data;
          try {
            data = JSON.parse(responseText);
          } catch (parseError) {
            console.error("[Gemini] ❌ Erro ao parsear resposta:", parseError);
            continue;
          }

          console.log("[Gemini] ✅ Resposta recebida da API");
          
          const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
          
          if (text) {
            console.log("[Gemini] ✅ Texto extraído:", text.substring(0, 100) + "...");
            return {
              response: text,
              model: endpoint.model,
            };
          }
        } else {
          let error;
          try {
            error = JSON.parse(responseText);
          } catch {
            error = { error: responseText };
          }
          lastError = error;
          console.log("[Gemini] ❌ Erro com", endpoint.model, ":", error.error?.message || error.error);
        }
      } catch (fetchError) {
        console.log("[Gemini] ❌ Erro de fetch com", endpoint.model);
        continue;
      }
    }

    clearTimeout(timeout);
    
    if (lastError) {
      console.error("[Gemini] ❌ Todos os endpoints falharam. Último erro:", JSON.stringify(lastError, null, 2));
    }
    return null;

  } catch (error) {
    if ((error as Error)?.name === "AbortError") {
      console.error("[Gemini] ❌ Timeout após 15 segundos");
    } else {
      console.error("[Gemini] ❌ Erro:", error);
    }
    return null;
  }
}

// Função para chamar OpenAI
async function callOpenAI(
  message: string,
  history: ChatMessage[]
): Promise<{ response: string; model: string } | null> {
  const nowPtBr = formatNowPtBr();
  const SYSTEM_PROMPT = buildSystemPrompt(nowPtBr);
  let assistantContext: AssistantQueryContext | null = null;
  try {
    assistantContext = await buildAssistantContext(message);
  } catch (e) {
    console.error("[assistant/chat] Erro ao montar contexto (OpenAI). Continuando sem contexto:", e);
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);

    const contextBlock = assistantContext
      ? `\n\n### CONTEXTO (DADOS REAIS DO SISTEMA)\n${JSON.stringify(assistantContext, null, 2)}\n\nRegras:\n- Use o CONTEXTO para responder com precisão.\n- Nunca invente dados.\n- Nunca inclua senhas ou credenciais.\n- Se faltar dado no contexto, diga como o usuário pode consultar no sistema (tela/botão) ou peça um critério.\n`
      : `\n\nObservação: contexto do banco indisponível nesta requisição; responda apenas com conhecimento de uso do sistema.\n`;

    const messages = [
      { role: "system", content: `${SYSTEM_PROMPT}${contextBlock}` },
      ...history.slice(-10).map((msg) => ({
        role: msg.sender === "user" ? "user" : "assistant",
        content: msg.content,
      })),
      { role: "user", content: message },
    ];

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL || "gpt-3.5-turbo",
        messages,
        temperature: 0.7,
        max_tokens: 500,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      console.error("[OpenAI] Erro:", response.status, error);
      return null;
    }

    const data = await response.json();
    const text = data.choices?.[0]?.message?.content;
    
    if (!text) {
      console.error("[OpenAI] Resposta sem texto:", data);
      return null;
    }

    return {
      response: text,
      model: data.model || "gpt-3.5-turbo",
    };
  } catch (error) {
    if ((error as Error)?.name === "AbortError") {
      console.error("[OpenAI] Timeout");
    } else {
      console.error("[OpenAI] Erro:", error);
    }
    return null;
  }
}

// Função principal que tenta múltiplas APIs com fallback
async function getAIResponse(
  message: string,
  history: ChatMessage[]
): Promise<{ response: string; model: string } | null> {
  // Ordem de tentativa (da mais gratuita para a menos)
  // 1. Google Gemini (GRATUITO - 6M tokens/dia)
  const geminiResult = await callGoogleGemini(message, history);
  if (geminiResult) {
    console.log("[AI Chat] ✅ Resposta do Gemini");
    return geminiResult;
  }

  // 2. OpenAI (pode ter créditos gratuitos)
  const openaiResult = await callOpenAI(message, history);
  if (openaiResult) {
    console.log("[AI Chat] ✅ Resposta do OpenAI");
    return openaiResult;
  }

  // Se nenhuma API funcionou
  console.log("[AI Chat] ❌ Nenhuma API disponível");
  return null;
}

export const POST = createApiHandler(async (req: NextRequest) => {
  try {
    const { message, history } = await req.json();

    if (!message || typeof message !== "string") {
      return NextResponse.json(
        { error: "Mensagem é obrigatória" },
        { status: 400 }
      );
    }

    console.log("[AI Chat] ========== NOVA REQUISIÇÃO ==========");
    console.log("[AI Chat] Processando mensagem:", message.substring(0, 50));
    console.log("[AI Chat] Variáveis de ambiente:");
    console.log("[AI Chat] - GOOGLE_API_KEY:", process.env.GOOGLE_API_KEY ? `SIM (${process.env.GOOGLE_API_KEY.substring(0, 10)}...)` : "NÃO");
    console.log("[AI Chat] - GOOGLE_MODEL:", process.env.GOOGLE_MODEL || "gemini-1.5-flash (padrão)");

    // Responder data/hora de forma determinística (evita alucinação)
    const dateTimeAnswer = handleDateTimeQuestion(message);
    if (dateTimeAnswer) {
      return NextResponse.json({
        response: dateTimeAnswer,
        model: "server-time",
      });
    }

    // Tentar obter resposta de alguma API de IA
    const result = await getAIResponse(message, history || []);

    if (!result) {
      // Nenhuma API disponível - retornar fallback
      return NextResponse.json(
        {
          error: "API de IA não configurada ou indisponível",
          fallback: true,
        },
        { status: 503 }
      );
    }

    return NextResponse.json({
      response: result.response,
      model: result.model,
    });
  } catch (error) {
    console.error("[AI Chat] Erro:", error);
    return NextResponse.json(
      {
        error: "Erro interno do servidor",
        fallback: true,
      },
      { status: 500 }
    );
  }
});
