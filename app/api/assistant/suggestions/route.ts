import { NextRequest, NextResponse } from "next/server";
import { createApiHandler } from "@/lib/utils/apiHandler";
import { createServerClient } from "@/lib/supabase/server";

const SCHEMA_ERROR_CODES = new Set(["PGRST200", "PGRST201", "PGRST202", "PGRST203", "PGRST204", "PGRST205"]);

function isSchemaMissing(error: unknown): boolean {
  return Boolean((error as { code?: string })?.code && SCHEMA_ERROR_CODES.has((error as { code: string }).code));
}

export const GET = createApiHandler(async (req) => {
  const supabase = createServerClient();
  const suggestions: Array<{
    type: "warning" | "info" | "success" | "action";
    title: string;
    description: string;
    action?: { label: string; route: string };
  }> = [];

  try {
    // Verificar contratos pendentes
    try {
      const { data: pendingContracts } = await supabase
        .from("contracts")
        .select("id")
        .in("status", ["DRAFT", "SENT"])
        .limit(5);

      if (pendingContracts && pendingContracts.length > 0) {
        suggestions.push({
          type: "warning",
          title: `${pendingContracts.length} contrato(s) pendente(s)`,
          description: "Existem contratos aguardando ação. Revise e envie ou finalize.",
          action: {
            label: "Ver contratos",
            route: "/contratos",
          },
        });
      }
    } catch (error) {
      if (!isSchemaMissing(error)) {
        console.error("[assistant/suggestions] Erro ao buscar contratos:", error);
      }
    }

    // Verificar vencimentos próximos (7 dias)
    try {
      const sevenDaysFromNow = new Date();
      sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7);
      const sevenDaysStr = sevenDaysFromNow.toISOString().slice(0, 10);
      const todayStr = new Date().toISOString().slice(0, 10);

      const [cloudExpiring, tvExpiring] = await Promise.all([
        supabase
          .from("cloud_accesses")
          .select("id")
          .not("client_id", "is", null)
          .lte("expires_at", sevenDaysStr)
          .gte("expires_at", todayStr)
          .limit(10),
        supabase
          .from("tv_slots")
          .select("id")
          .eq("status", "ASSIGNED")
          .not("client_id", "is", null)
          .not("expires_at", "is", null)
          .lte("expires_at", sevenDaysStr)
          .gte("expires_at", todayStr)
          .limit(10),
      ]);

      const totalExpiring = (cloudExpiring.data?.length ?? 0) + (tvExpiring.data?.length ?? 0);
      if (totalExpiring > 0) {
        suggestions.push({
          type: "warning",
          title: `${totalExpiring} serviço(s) vence(m) em breve`,
          description: "Alguns serviços estão próximos do vencimento. Entre em contato com os clientes.",
          action: {
            label: "Ver vencimentos",
            route: "/relatorios/servicos?category=ALL",
          },
        });
      }
    } catch (error) {
      if (!isSchemaMissing(error)) {
        console.error("[assistant/suggestions] Erro ao buscar vencimentos:", error);
      }
    }

    // Verificar slots TV disponíveis baixos
    try {
      const { count: availableCount } = await supabase
        .from("tv_slots")
        .select("id", { count: "exact", head: true })
        .eq("status", "AVAILABLE")
        .is("client_id", null);
      if (availableCount < 50) {
        suggestions.push({
          type: "info",
          title: "Poucos slots TV disponíveis",
          description: `Apenas ${availableCount} slot(s) disponível(is). Novos emails serão criados automaticamente.`,
          action: {
            label: "Ver TV",
            route: "/usuarios",
          },
        });
      }
    } catch (error) {
      if (!isSchemaMissing(error)) {
        console.error("[assistant/suggestions] Erro ao buscar slots TV:", error);
      }
    }

    // Verificar clientes cadastrados recentemente
    try {
      const last30Days = new Date();
      last30Days.setDate(last30Days.getDate() - 30);
      const { count: recentClients } = await supabase
        .from("clients")
        .select("id", { count: "exact", head: true })
        .gte("created_at", last30Days.toISOString());

      if (recentClients && recentClients > 0) {
        suggestions.push({
          type: "success",
          title: `${recentClients} novo(s) cliente(s) no último mês`,
          description: "Ótimo crescimento! Continue assim.",
          action: {
            label: "Ver clientes",
            route: "/clientes",
          },
        });
      }
    } catch (error) {
      if (!isSchemaMissing(error)) {
        console.error("[assistant/suggestions] Erro ao buscar clientes:", error);
      }
    }

    // Sugestão para criar novo cliente se não houver nenhum
    try {
      const { count: totalClients } = await supabase
        .from("clients")
        .select("id", { count: "exact", head: true });

      if (totalClients === 0) {
        suggestions.push({
          type: "action",
          title: "Cadastre seu primeiro cliente",
          description: "Comece adicionando um cliente ao sistema.",
          action: {
            label: "Novo cliente",
            route: "/clientes?action=new",
          },
        });
      }
    } catch (error) {
      if (!isSchemaMissing(error)) {
        console.error("[assistant/suggestions] Erro ao contar clientes:", error);
      }
    }

    return NextResponse.json({ results: suggestions });
  } catch (error) {
    if (isSchemaMissing(error)) {
      return NextResponse.json({ results: [] });
    }
    throw error;
  }
});

