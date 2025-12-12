import { NextRequest, NextResponse } from "next/server";
import { createApiHandler } from "@/lib/utils/apiHandler";

export interface ChatMessage {
  sender: "assistant" | "user";
  content: string;
}

// Preparar contexto do sistema
const SYSTEM_PROMPT = `Você é um assistente virtual especializado em um sistema de gestão de serviços de telefonia e TV.

O sistema permite:
- Gerenciar clientes (cadastrar, editar, buscar por nome, documento, e-mail)
- Criar e gerenciar contratos
- Gerenciar acessos de TV (planos Essencial e Premium)
- Gerenciar serviços Cloud, Hub e Telemedicina
- Gerar relatórios e estatísticas
- Acompanhar vencimentos e renovações
- Gerenciar templates de contratos

Responda de forma clara, amigável e em português brasileiro. Seja conciso mas completo. Use emojis quando apropriado para tornar a resposta mais amigável.

Se a pergunta for sobre funcionalidades específicas do sistema, explique como usar. Se for uma pergunta geral, responda de forma útil e relevante.`;

// Função para chamar Google Gemini (GRATUITO - 6M tokens/dia)
async function callGoogleGemini(
  message: string,
  history: ChatMessage[]
): Promise<{ response: string; model: string } | null> {
  const apiKey = process.env.GOOGLE_API_KEY;
  if (!apiKey) return null;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);

    // Preparar mensagens para Gemini
    // Gemini usa um formato de contents com role e parts
    const conversationHistory = history.slice(-10).map((msg) => ({
      role: msg.sender === "user" ? "user" : "model",
      parts: [{ text: msg.content }],
    }));

    // Adicionar prompt do sistema como primeira mensagem do usuário
    const contents = [
      {
        role: "user" as const,
        parts: [{ text: SYSTEM_PROMPT }],
      },
      {
        role: "model" as const,
        parts: [{ text: "Entendido! Estou pronto para ajudar com o sistema de gestão de serviços." }],
      },
      ...conversationHistory,
      {
        role: "user" as const,
        parts: [{ text: message }],
      },
    ];

    const model = process.env.GOOGLE_MODEL || "gemini-pro";
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
      {
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
      }
    );

    clearTimeout(timeout);

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      console.error("[Gemini] Erro:", response.status, error);
      return null;
    }

    const data = await response.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
    
    if (!text) {
      console.error("[Gemini] Resposta sem texto:", data);
      return null;
    }

    return {
      response: text,
      model: "gemini-pro",
    };
  } catch (error) {
    if ((error as Error)?.name === "AbortError") {
      console.error("[Gemini] Timeout");
    } else {
      console.error("[Gemini] Erro:", error);
    }
    return null;
  }
}

// Função para chamar OpenAI
async function callOpenAI(
  message: string,
  history: ChatMessage[]
): Promise<{ response: string; model: string } | null> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);

    const messages = [
      { role: "system", content: SYSTEM_PROMPT },
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

    console.log("[AI Chat] Processando mensagem:", message.substring(0, 50));

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
