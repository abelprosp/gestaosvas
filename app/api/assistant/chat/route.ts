import { NextRequest, NextResponse } from "next/server";
import { createApiHandler } from "@/lib/utils/apiHandler";

export interface ChatMessage {
  sender: "assistant" | "user";
  content: string;
}

export const POST = createApiHandler(async (req: NextRequest, { user }) => {
  try {
    const { message, history } = await req.json();

    if (!message || typeof message !== "string") {
      return NextResponse.json(
        { error: "Mensagem é obrigatória" },
        { status: 400 }
      );
    }

    // Verificar se há API key configurada
    const openaiApiKey = process.env.OPENAI_API_KEY;
    
    if (!openaiApiKey) {
      return NextResponse.json(
        { 
          error: "API de IA não configurada",
          fallback: true 
        },
        { status: 503 }
      );
    }

    // Preparar contexto do sistema
    const systemPrompt = `Você é um assistente virtual especializado em um sistema de gestão de serviços de telefonia e TV.

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

    // Preparar histórico de mensagens para contexto (últimas 10)
    const messages = [
      { role: "system", content: systemPrompt },
      ...(history?.slice(-10).map((msg: ChatMessage) => ({
        role: msg.sender === "user" ? "user" : "assistant",
        content: msg.content,
      })) || []),
      { role: "user", content: message },
    ];

    // Chamar API da OpenAI
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${openaiApiKey}`,
      },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL || "gpt-3.5-turbo",
        messages,
        temperature: 0.7,
        max_tokens: 500,
      }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: "Erro desconhecido" }));
      console.error("Erro na API OpenAI:", error);
      return NextResponse.json(
        { 
          error: "Erro ao processar com IA",
          fallback: true 
        },
        { status: 500 }
      );
    }

    const data = await response.json();
    const aiResponse = data.choices[0]?.message?.content || "Desculpe, não consegui gerar uma resposta.";

    return NextResponse.json({ 
      response: aiResponse,
      model: data.model 
    });
  } catch (error) {
    console.error("Erro no chat com IA:", error);
    return NextResponse.json(
      { 
        error: "Erro interno do servidor",
        fallback: true 
      },
      { status: 500 }
    );
  }
});

