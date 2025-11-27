"use client";

import {
  Box,
  Button,
  Flex,
  Icon,
  IconButton,
  Input,
  Link,
  Spinner,
  Stack,
  Text,
  Tooltip,
  useColorModeValue,
  VStack,
  Badge,
  Divider,
  useToast,
} from "@chakra-ui/react";
import { useState, useEffect, useRef } from "react";
import { FiMessageCircle, FiSend, FiX, FiUsers, FiFileText, FiMonitor, FiSettings, FiArrowRight, FiTrendingUp, FiLightbulb, FiTrash2, FiBarChart2 } from "react-icons/fi";
import NextLink from "next/link";
import { useRouter, usePathname } from "next/navigation";
import {
  getAssistantStats,
  searchClients,
  getPendingContracts,
  getAvailableTVSlots,
  getExpiringServices,
  getSalesAnalysis,
  getProactiveSuggestions,
  type ClientSearchResult,
  type PendingContract,
  type ExpiringService,
  type SalesAnalysis,
  type ProactiveSuggestion,
} from "@/lib/api/assistant";

interface Message {
  sender: "assistant" | "user";
  content: string;
  type?: "text" | "stats" | "search" | "commands" | "contracts" | "expiring" | "sales" | "suggestions";
  data?: {
    stats?: { clients: number; contracts: number; tvActive: number; services: number };
    clients?: ClientSearchResult[];
    contracts?: PendingContract[];
    expiring?: ExpiringService[];
    tvAvailable?: number;
    route?: string;
    sales?: SalesAnalysis;
    suggestions?: ProactiveSuggestion[];
  };
}

const QUICK_COMMANDS = [
  { label: "📊 Mostrar estatísticas", command: "estatísticas" },
  { label: "🔍 Buscar cliente", command: "buscar cliente" },
  { label: "📄 Contratos pendentes", command: "contratos pendentes" },
  { label: "⏰ Vencimentos próximos", command: "vencimentos" },
  { label: "📺 TV disponível", command: "tv disponível" },
  { label: "➕ Novo cliente", command: "cadastrar cliente" },
  { label: "📝 Novo contrato", command: "criar contrato" },
  { label: "📈 Análise de vendas", command: "análise de vendas" },
  { label: "📊 Relatório completo", command: "relatório completo" },
  { label: "💡 Sugestões", command: "sugestões" },
  { label: "❓ Ajuda", command: "ajuda" },
];

const CHAT_HISTORY_KEY = "assistant_chat_history";
const MAX_HISTORY_MESSAGES = 100;

function loadChatHistory(): Message[] {
  if (typeof window === "undefined") return [];
  try {
    // Usar sessionStorage ao invés de localStorage para melhor segurança
    // Dados são apagados quando a aba é fechada, reduzindo risco de XSS
    const stored = sessionStorage.getItem(CHAT_HISTORY_KEY);
    if (stored) {
      const parsed = JSON.parse(stored) as Message[];
      return Array.isArray(parsed) ? parsed : [];
    }
  } catch (error) {
    console.error("Erro ao carregar histórico do chat:", error);
  }
  return [];
}

function saveChatHistory(messages: Message[]) {
  if (typeof window === "undefined") return;
  try {
    // Limita o histórico aos últimos N mensagens
    // Usar sessionStorage ao invés de localStorage para melhor segurança
    const limitedMessages = messages.slice(-MAX_HISTORY_MESSAGES);
    sessionStorage.setItem(CHAT_HISTORY_KEY, JSON.stringify(limitedMessages));
  } catch (error) {
    console.error("Erro ao salvar histórico do chat:", error);
  }
}

const initialMessage: Message = {
  sender: "assistant",
  content: "Olá! 👋 Sou o assistente virtual do sistema de gestão de serviços. Como posso ajudar você hoje?",
  type: "text",
  data: {},
};

export function VirtualAssistantChat() {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Message[]>(() => {
    const history = loadChatHistory();
    return history.length > 0 ? history : [initialMessage];
  });
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const pathname = usePathname();
  const toast = useToast();

  const panelBg = useColorModeValue("rgba(255,255,255,0.95)", "rgba(13, 18, 34, 0.95)");
  const assistantBubbleBg = useColorModeValue("gray.100", "gray.700");
  const toggleBorder = useColorModeValue("rgba(148, 163, 184, 0.4)", "rgba(148, 163, 184, 0.2)");
  const cardBg = useColorModeValue("rgba(255,255,255,0.8)", "rgba(26, 32, 44, 0.8)");

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    if (open) {
      scrollToBottom();
    }
  }, [messages, open]);

  // Salvar histórico sempre que mensagens mudarem
  useEffect(() => {
    if (messages.length > 1 || (messages.length === 1 && messages[0] !== initialMessage)) {
      saveChatHistory(messages);
    }
  }, [messages]);

  // Carregar histórico quando componente montar (apenas uma vez)
  const [hasLoadedHistory, setHasLoadedHistory] = useState(false);
  useEffect(() => {
    if (!hasLoadedHistory) {
      const history = loadChatHistory();
      if (history.length > 0) {
        setMessages(history);
      }
      setHasLoadedHistory(true);
    }
  }, [hasLoadedHistory]);

  const processMessage = async (question: string): Promise<Message> => {
    const lowerQuestion = question.toLowerCase().trim();

    // ========== SAUDAÇÕES E INTERAÇÕES SOCIAIS ==========
    
    // Saudações gerais
    if (/^(olá|ola|oi|oie|hey|hi|hello)$/i.test(lowerQuestion)) {
      const greetings = [
        "Olá! 👋 Como posso ajudar você hoje?",
        "Oi! 😊 Em que posso ser útil?",
        "Olá! Estou aqui para ajudar. O que você precisa?",
      ];
      return {
        sender: "assistant",
        content: greetings[Math.floor(Math.random() * greetings.length)],
        type: "text",
      };
    }

    // Bom dia
    if (/^(bom dia|bomdia|good morning)$/i.test(lowerQuestion)) {
      return {
        sender: "assistant",
        content: "Bom dia! ☀️ Como posso ajudar você hoje?",
        type: "text",
      };
    }

    // Boa tarde
    if (/^(boa tarde|boatarde|good afternoon)$/i.test(lowerQuestion)) {
      return {
        sender: "assistant",
        content: "Boa tarde! 🌤️ Em que posso ser útil?",
        type: "text",
      };
    }

    // Boa noite
    if (/^(boa noite|boanoite|good evening|good night)$/i.test(lowerQuestion)) {
      return {
        sender: "assistant",
        content: "Boa noite! 🌙 Como posso ajudar?",
        type: "text",
      };
    }

    // Tudo bem / Como vai
    if (/^(tudo bem|tudo bom|como vai|como está|como vc está|como você está|como ta|como está você)$/i.test(lowerQuestion)) {
      return {
        sender: "assistant",
        content: "Tudo ótimo, obrigado! 😊 Estou aqui para ajudar você com o sistema. O que você precisa?",
        type: "text",
      };
    }

    // Agradecimentos
    if (/^(obrigado|obrigada|valeu|thanks|thank you|grato|grata)$/i.test(lowerQuestion)) {
      return {
        sender: "assistant",
        content: "De nada! 😊 Fico feliz em ajudar. Precisa de mais alguma coisa?",
        type: "text",
      };
    }

    // Despedidas
    if (/^(tchau|até logo|até mais|bye|até breve|falou|flw)$/i.test(lowerQuestion)) {
      return {
        sender: "assistant",
        content: "Até logo! 👋 Estarei aqui sempre que precisar. Tenha um ótimo dia!",
        type: "text",
      };
    }

    // ========== PERGUNTAS SOBRE O SISTEMA ==========

    // Como cadastrar cliente
    if (/(como.*cadastrar.*cliente|como.*adicionar.*cliente|como.*criar.*cliente|passo.*a.*passo.*cliente|tutorial.*cliente)/i.test(lowerQuestion)) {
      return {
        sender: "assistant",
        content: `Para cadastrar um novo cliente no sistema, siga estes passos:

1️⃣ Acesse o menu lateral e clique em "Clientes" (ou use o comando "cadastrar cliente")

2️⃣ Clique no botão "Novo cliente" ou "Adicionar cliente"

3️⃣ Preencha os dados obrigatórios:
   • Nome completo
   • E-mail
   • Documento (CPF ou CNPJ)
   • Centro de custo (LUXUS ou NEXUS)

4️⃣ Preencha dados opcionais (se necessário):
   • Telefone
   • Empresa
   • Endereço, Cidade, Estado
   • CEP
   • Observações

5️⃣ Clique em "Salvar"

💡 Dica: Após cadastrar o cliente, você pode adicionar serviços clicando no botão "Serviços" na lista de clientes.

Quer que eu abra a página de clientes para você?`,
        type: "text",
        data: { route: "/clientes?action=new" },
      };
    }

    // Como editar cliente
    if (/(como.*editar.*cliente|como.*alterar.*cliente|como.*modificar.*cliente|atualizar.*cliente)/i.test(lowerQuestion)) {
      return {
        sender: "assistant",
        content: `Para editar um cliente:

1️⃣ Acesse a página "Clientes" no menu

2️⃣ Encontre o cliente na lista (use a busca se necessário)

3️⃣ Clique no botão "Editar" ao lado do cliente

4️⃣ Modifique os dados desejados

5️⃣ Clique em "Salvar"

💡 Importante: 
• Para editar informações de contato, use o botão "Editar"
• Para adicionar ou modificar serviços, use o botão "Serviços"
• As alterações são salvas imediatamente

Quer que eu abra a página de clientes?`,
        type: "text",
        data: { route: "/clientes" },
      };
    }

    // Como adicionar serviços a um cliente
    if (/(como.*adicionar.*serviço|como.*adicionar.*serviços|como.*vincular.*serviço|adicionar.*serviço.*cliente)/i.test(lowerQuestion)) {
      return {
        sender: "assistant",
        content: `Para adicionar serviços a um cliente:

1️⃣ Acesse a página "Clientes"

2️⃣ Encontre o cliente na lista

3️⃣ Clique no botão "Serviços" (ou "Adicionar serviços" se ainda não tiver)

4️⃣ Selecione os serviços desejados:
   • Marque os checkboxes dos serviços
   • Para TV: configure quantidade Essencial e Premium
   • Para Cloud: configure data de vencimento
   • Defina preços personalizados se necessário

5️⃣ Preencha as informações obrigatórias:
   • Para TV: Vendedor e Data de vencimento
   • Para Cloud: Data de vencimento

6️⃣ Clique em "Salvar serviços"

💡 Dica: Os acessos de TV são gerados automaticamente quando você salva!

Quer que eu abra a página de clientes?`,
        type: "text",
        data: { route: "/clientes" },
      };
    }

    // Como criar contrato
    if (/(como.*criar.*contrato|como.*gerar.*contrato|como.*fazer.*contrato|passo.*a.*passo.*contrato)/i.test(lowerQuestion)) {
      return {
        sender: "assistant",
        content: `Para criar um novo contrato:

1️⃣ Acesse "Contratos" no menu (ou use "criar contrato")

2️⃣ Clique em "Novo contrato"

3️⃣ Selecione o cliente

4️⃣ Escolha um template (opcional) ou crie um contrato personalizado

5️⃣ Preencha os campos do contrato:
   • Título
   • Campos personalizados (se houver)
   • Conteúdo (pode editar se necessário)

6️⃣ Clique em "Criar contrato"

7️⃣ Após criar, você pode:
   • Enviar para assinatura
   • Visualizar prévia
   • Editar ou cancelar

💡 Dica: Use templates para agilizar a criação de contratos similares.

Quer que eu abra a página de contratos?`,
        type: "text",
        data: { route: "/contratos?action=new" },
      };
    }

    // Como ver relatórios
    if (/(como.*ver.*relatório|como.*gerar.*relatório|onde.*relatório|relatórios.*onde)/i.test(lowerQuestion)) {
      return {
        sender: "assistant",
        content: `Para acessar os relatórios do sistema:

1️⃣ Acesse "Relatórios" no menu lateral

2️⃣ Você verá o relatório completo de serviços com:
   • Resumo por serviços
   • Estatísticas de vendas
   • Gráficos e análises

3️⃣ Na página de clientes, você também pode:
   • Exportar CSV de todos os clientes
   • Exportar por documento específico
   • Filtrar e exportar resultados

💡 Dica: Use "relatório completo" para ver análises detalhadas.

Quer que eu abra os relatórios?`,
        type: "text",
        data: { route: "/relatorios/servicos" },
      };
    }

    // Como gerenciar usuários TV
    if (/(como.*gerenciar.*tv|como.*ver.*usuários.*tv|acessos.*tv|onde.*usuários.*tv)/i.test(lowerQuestion)) {
      return {
        sender: "assistant",
        content: `Para gerenciar usuários e acessos de TV:

1️⃣ Acesse "Usuários TV" no menu

2️⃣ Você verá todos os acessos ativos atribuídos a clientes

3️⃣ Para cada acesso, você pode:
   • Ver detalhes (cliente, plano, vencimento)
   • Gerar nova senha
   • Definir senha manualmente
   • Renovar vencimento
   • Excluir acesso (apenas admin)
   • Adicionar comentários

4️⃣ Use os filtros para:
   • Buscar por cliente, email ou CPF/CNPJ
   • Filtrar por status
   • Filtrar por vencimento
   • Filtrar por telefonia

💡 Importante: Apenas acessos atribuídos a clientes aparecem na lista. Slots disponíveis não são exibidos.

Quer que eu abra a página de usuários TV?`,
        type: "text",
        data: { route: "/usuarios" },
      };
    }

    // Como funciona o sistema de TV
    if (/(como.*funciona.*tv|sistema.*tv|acessos.*tv.*como|planos.*tv)/i.test(lowerQuestion)) {
      return {
        sender: "assistant",
        content: `O sistema de TV funciona assim:

📺 **Planos disponíveis:**
• TV Essencial: Plano básico
• TV Premium: Plano premium

🔧 **Funcionamento:**
1. Ao adicionar serviço TV a um cliente, você define:
   • Quantidade de acessos Essencial
   • Quantidade de acessos Premium
   • Vendedor
   • Data de vencimento
   • Outras configurações

2. O sistema automaticamente:
   • Cria emails de acesso (formato: 1a8@nexusrs.com.br)
   • Gera senhas de 4 dígitos
   • Atribui os slots ao cliente
   • Organiza por email e slot

3. Os acessos aparecem em "Usuários TV" onde você pode:
   • Ver todos os acessos ativos
   • Gerenciar senhas
   • Renovar vencimentos
   • Excluir acessos

💡 Dica: Os emails são criados automaticamente quando necessário. Não precisa criar manualmente!

Quer saber mais sobre alguma funcionalidade específica?`,
        type: "text",
      };
    }

    // O que é o sistema / Sobre o sistema
    if (/(o que é|o que é este|sobre o sistema|o que faz|para que serve|quem criou)/i.test(lowerQuestion) && !/(cliente|contrato|serviço|tv)/i.test(lowerQuestion)) {
      return {
        sender: "assistant",
        content: `Este é o **Sistema de Gestão de Serviços de Telefonia** 🎯

**Funcionalidades principais:**
• 📋 Gestão completa de clientes
• 📄 Criação e gerenciamento de contratos
• 📺 Controle de acessos de TV (Essencial e Premium)
• ☁️ Gestão de serviços Cloud
• 📊 Relatórios e análises de vendas
• 👥 Gerenciamento de usuários e colaboradores
• 📈 Dashboard com estatísticas em tempo real

**O que você pode fazer:**
• Cadastrar e editar clientes
• Vincular serviços aos clientes
• Gerar contratos personalizados
• Acompanhar vencimentos
• Ver relatórios detalhados
• Gerenciar acessos de TV
• Exportar dados

Estou aqui para ajudar você a usar todas essas funcionalidades! 😊

Quer saber como fazer algo específico?`,
        type: "text",
      };
    }

    // Comandos de estatísticas
    if (
      /^(quantos|quantas|total|estatística|estatísticas|stats|resumo)/i.test(lowerQuestion) ||
      /(quantos clientes|quantos contratos|total de)/i.test(lowerQuestion)
    ) {
      try {
        const stats = await getAssistantStats();
        return {
          sender: "assistant",
          type: "stats",
          content: "Aqui estão as estatísticas do sistema:",
          data: { stats },
        };
      } catch (error) {
        return {
          sender: "assistant",
          content: "Desculpe, não consegui buscar as estatísticas no momento. Tente novamente.",
        };
      }
    }

    // Busca de clientes
    if (/^(buscar|encontrar|procurar|localizar)/i.test(lowerQuestion) && /cliente/i.test(lowerQuestion)) {
      const searchTerm = question.replace(/^(buscar|encontrar|procurar|localizar)\s*(cliente)?s?\s*/i, "").trim();
      if (searchTerm.length < 2) {
        return {
          sender: "assistant",
          content: "Informe pelo menos 2 caracteres para buscar um cliente. Exemplo: 'buscar cliente João'",
        };
      }
      try {
        const clients = await searchClients(searchTerm);
        if (clients.length === 0) {
          return {
            sender: "assistant",
            content: `Nenhum cliente encontrado com "${searchTerm}". Tente outro termo de busca.`,
          };
        }
        return {
          sender: "assistant",
          type: "search",
          content: `Encontrei ${clients.length} cliente(s):`,
          data: { clients },
        };
      } catch (error) {
        return {
          sender: "assistant",
          content: "Desculpe, não consegui buscar os clientes no momento. Tente novamente.",
        };
      }
    }

    // Contratos pendentes
    if (/(contrato.*pendente|pendente.*contrato|contratos.*aguardando)/i.test(lowerQuestion)) {
      try {
        const contracts = await getPendingContracts();
        if (contracts.length === 0) {
          return {
            sender: "assistant",
            content: "Não há contratos pendentes no momento. Todos os contratos foram enviados ou assinados!",
          };
        }
        return {
          sender: "assistant",
          type: "contracts",
          content: `Encontrei ${contracts.length} contrato(s) pendente(s):`,
          data: { contracts },
        };
      } catch (error) {
        return {
          sender: "assistant",
          content: "Desculpe, não consegui buscar os contratos pendentes no momento.",
        };
      }
    }

    // Vencimentos próximos
    if (/(vencimento|vencer|expirar|expira|próximo.*vencimento)/i.test(lowerQuestion)) {
      try {
        const expiring = await getExpiringServices(30);
        if (expiring.length === 0) {
          return {
            sender: "assistant",
            content: "Não há serviços com vencimento nos próximos 30 dias. Tudo em dia!",
          };
        }
        return {
          sender: "assistant",
          type: "expiring",
          content: `Encontrei ${expiring.length} serviço(s) com vencimento próximo:`,
          data: { expiring },
        };
      } catch (error) {
        return {
          sender: "assistant",
          content: "Desculpe, não consegui buscar os vencimentos no momento.",
        };
      }
    }

    // Slots TV disponíveis
    if (/(tv.*disponível|disponível.*tv|slots.*tv|acesso.*tv.*livre)/i.test(lowerQuestion)) {
      try {
        const available = await getAvailableTVSlots();
        return {
          sender: "assistant",
          content: `Atualmente temos ${available} slot(s) de TV disponível(is). Os emails serão criados automaticamente conforme a necessidade.`,
          data: { tvAvailable: available },
        };
      } catch (error) {
        return {
          sender: "assistant",
          content: "Desculpe, não consegui verificar os slots de TV no momento.",
        };
      }
    }

    // Análise de vendas
    if (/(análise.*vendas|vendas.*análise|tendência.*vendas|relatório.*vendas|gráfico.*vendas)/i.test(lowerQuestion)) {
      try {
        const sales = await getSalesAnalysis();
        return {
          sender: "assistant",
          type: "sales",
          content: "Aqui está a análise de vendas dos últimos 12 meses:",
          data: { sales },
        };
      } catch (error) {
        return {
          sender: "assistant",
          content: "Desculpe, não consegui buscar a análise de vendas no momento.",
        };
      }
    }

    // Sugestões proativas
    if (/(sugestão|sugestões|recomendação|recomendações|o que fazer|dicas|insights)/i.test(lowerQuestion)) {
      try {
        const suggestions = await getProactiveSuggestions();
        if (suggestions.length === 0) {
          return {
            sender: "assistant",
            content: "Tudo está em ordem! Não há sugestões no momento.",
          };
        }
        return {
          sender: "assistant",
          type: "suggestions",
          content: `Encontrei ${suggestions.length} sugestão(ões) para você:`,
          data: { suggestions },
        };
      } catch (error) {
        return {
          sender: "assistant",
          content: "Desculpe, não consegui gerar sugestões no momento.",
        };
      }
    }

    // Cadastrar novo cliente
    if (/(cadastrar.*cliente|novo.*cliente|adicionar.*cliente|criar.*cliente)/i.test(lowerQuestion)) {
      setTimeout(() => router.push("/clientes?action=new"), 500);
      return {
        sender: "assistant",
        content: "Abrindo formulário para cadastrar novo cliente...",
        type: "text",
        data: { route: "/clientes?action=new" },
      };
    }

    // Criar novo contrato
    if (/(criar.*contrato|novo.*contrato|adicionar.*contrato|gerar.*contrato)/i.test(lowerQuestion)) {
      setTimeout(() => router.push("/contratos?action=new"), 500);
      return {
        sender: "assistant",
        content: "Abrindo formulário para criar novo contrato...",
        type: "text",
        data: { route: "/contratos?action=new" },
      };
    }

    // Relatório completo
    if (/(relatório.*completo|relatório.*geral|visão.*geral|dashboard|painel)/i.test(lowerQuestion)) {
      setTimeout(() => router.push("/relatorios/servicos"), 500);
      return {
        sender: "assistant",
        content: "Abrindo relatório completo de serviços...",
        type: "text",
        data: { route: "/relatorios/servicos" },
      };
    }

    // Limpar histórico
    if (/(limpar.*histórico|apagar.*histórico|resetar.*chat|novo.*chat)/i.test(lowerQuestion)) {
      if (typeof window !== "undefined") {
        sessionStorage.removeItem(CHAT_HISTORY_KEY);
      }
      return {
        sender: "assistant",
        content: "Histórico limpo! Começando uma nova conversa...",
        type: "text",
      };
    }

    // Análises avançadas - Comparação de planos
    if (/(comparar.*planos|plano.*essencial.*vs.*premium|diferença.*planos)/i.test(lowerQuestion)) {
      try {
        const stats = await getAssistantStats();
        // Criar uma análise comparativa
        return {
          sender: "assistant",
          content: `Comparação de planos TV:\n\n📺 TV Essencial: Disponível para clientes básicos\n🎬 TV Premium: Disponível para clientes premium\n\nTotal de TV ativos: ${stats.tvActive}\n\nPara mais detalhes, use "análise de vendas" para ver tendências.`,
          type: "text",
        };
      } catch (error) {
        return {
          sender: "assistant",
          content: "Desculpe, não consegui fazer a comparação no momento.",
        };
      }
    }

    // Tendências
    if (/(tendência|tendências|evolução|crescimento|progresso)/i.test(lowerQuestion)) {
      try {
        const sales = await getSalesAnalysis();
        const last3Months = sales.points.slice(-3);
        const first3Months = sales.points.slice(0, 3);
        
        const recentTotal = last3Months.reduce((sum, p) => sum + p.total, 0);
        const oldTotal = first3Months.length > 0 
          ? first3Months.reduce((sum, p) => sum + p.total, 0)
          : recentTotal;
        
        const growth = oldTotal > 0 
          ? ((recentTotal - oldTotal) / oldTotal * 100).toFixed(1)
          : "0";
        
        const trend = parseFloat(growth) > 0 ? "📈 Crescimento" : parseFloat(growth) < 0 ? "📉 Declínio" : "➡️ Estável";
        
        return {
          sender: "assistant",
          content: `Tendência de vendas:\n\n${trend}: ${Math.abs(parseFloat(growth))}%\n\nÚltimos 3 meses: ${recentTotal} vendas\nVendas anteriores: ${oldTotal}\n\nUse "análise de vendas" para ver gráficos detalhados.`,
          type: "text",
        };
      } catch (error) {
        return {
          sender: "assistant",
          content: "Desculpe, não consegui analisar as tendências no momento.",
        };
      }
    }

    // Ajuda / O que você pode fazer
    if (/^(ajuda|help|comandos|menu|o que você pode|o que posso|quais.*comandos|lista.*comandos)/i.test(lowerQuestion)) {
      return {
        sender: "assistant",
        type: "commands",
        content: "Aqui estão alguns comandos e perguntas que você pode fazer:",
        data: {},
      };
    }

    // O que é / Para que serve
    if (/(o que é|para que serve|o que faz|qual.*função)/i.test(lowerQuestion) && /(sistema|aplicativo|app|software)/i.test(lowerQuestion)) {
      return {
        sender: "assistant",
        content: `Este é o **Sistema de Gestão de Serviços de Telefonia** 🎯

**Para que serve:**
Este sistema foi desenvolvido para gerenciar de forma completa e eficiente todos os aspectos dos serviços de telefonia oferecidos pela sua empresa.

**Funcionalidades principais:**
• 📋 **Gestão de Clientes**: Cadastro completo, histórico, busca avançada
• 📄 **Contratos**: Criação, envio, assinatura digital e acompanhamento
• 📺 **TV**: Controle total de acessos Essencial e Premium
• ☁️ **Cloud**: Gestão de serviços cloud e Hub
• 📊 **Relatórios**: Análises detalhadas, gráficos, exportações
• 👥 **Usuários**: Gerenciamento de colaboradores e permissões
• 📈 **Dashboard**: Visão geral em tempo real

**Benefícios:**
✅ Organização completa de clientes e serviços
✅ Automação de processos (emails TV, senhas, etc.)
✅ Relatórios e análises para tomada de decisão
✅ Controle de vencimentos e renovações
✅ Interface intuitiva e fácil de usar

Quer saber como usar alguma funcionalidade específica? 😊`,
        type: "text",
      };
    }

    // Como usar o sistema
    if (/(como.*usar|tutorial|guia|manual|como começar|primeiros passos)/i.test(lowerQuestion)) {
      return {
        sender: "assistant",
        content: `**Guia rápido de uso do sistema:**

🚀 **Primeiros passos:**
1. Comece cadastrando seus clientes
2. Adicione serviços aos clientes
3. Gere contratos quando necessário
4. Acompanhe vencimentos e renovações

📋 **Fluxo básico:**
1. **Cadastrar Cliente** → "Como cadastrar um cliente?"
2. **Adicionar Serviços** → "Como adicionar serviços?"
3. **Criar Contrato** → "Como criar um contrato?"
4. **Acompanhar** → Use o dashboard e relatórios

💡 **Dicas:**
• Use a busca para encontrar clientes rapidamente
• Configure alertas de vencimento
• Exporte dados regularmente
• Use templates para agilizar contratos

**Páginas principais:**
• 🏠 Dashboard: Visão geral
• 👥 Clientes: Gestão de clientes
• 📄 Contratos: Documentos
• 📺 Usuários TV: Acessos ativos
• 📊 Relatórios: Análises

Quer ver o passo a passo de alguma funcionalidade específica?`,
        type: "text",
      };
    }

    // Problemas / Erros
    if (/(erro|problema|não funciona|não está funcionando|bug|dificuldade|não consigo)/i.test(lowerQuestion)) {
      return {
        sender: "assistant",
        content: `Entendo que você está com alguma dificuldade. Vamos resolver! 😊

**O que você pode fazer:**
1. **Descreva o problema**: Me diga o que você estava tentando fazer
2. **Verifique permissões**: Algumas ações requerem permissão de administrador
3. **Tente novamente**: Às vezes é um problema temporário

**Problemas comuns:**
• **Não consigo cadastrar**: Verifique se tem permissão de admin
• **Dados não salvam**: Verifique se preencheu campos obrigatórios
• **Página não carrega**: Tente atualizar a página (F5)
• **Busca não funciona**: Use pelo menos 2 caracteres

**Ainda com problemas?**
• Verifique sua conexão com a internet
• Limpe o cache do navegador
• Entre em contato com o administrador do sistema

Me diga qual é o problema específico que você está enfrentando e eu vou ajudar! 🛠️`,
        type: "text",
      };
    }

    // Informações sobre permissões
    if (/(permissão|admin|administrador|acesso negado|não tenho acesso|não posso)/i.test(lowerQuestion)) {
      return {
        sender: "assistant",
        content: `Sobre **permissões e acesso**:

🔐 **Níveis de acesso:**
• **Admin**: Acesso total ao sistema
• **Usuário/Vendedor**: Acesso limitado a algumas funcionalidades

**O que cada nível pode fazer:**

**Admin pode:**
✅ Cadastrar/editar/excluir clientes
✅ Gerenciar todos os serviços
✅ Criar e gerenciar contratos
✅ Cadastrar novos usuários
✅ Excluir acessos TV
✅ Ver todos os relatórios

**Usuário/Vendedor pode:**
✅ Ver e buscar clientes
✅ Cadastrar novos clientes
✅ Adicionar serviços (com aprovação em alguns casos)
✅ Ver relatórios básicos
❌ Não pode excluir acessos
❌ Não pode cadastrar usuários

**Se você não tem acesso:**
• Solicite ao administrador do sistema
• Use a opção "Solicitar" quando disponível
• O administrador receberá uma notificação

Quer saber mais sobre alguma funcionalidade específica?`,
        type: "text",
      };
    }

    // Navegação
    if (/^(ir para|abrir|mostrar|ver|navegar para)/i.test(lowerQuestion)) {
      const routes: Record<string, string> = {
        clientes: "/clientes",
        contratos: "/contratos",
        tv: "/usuarios",
        cloud: "/usuarios-cloud",
        hub: "/usuarios-hub",
        tele: "/usuarios-tele",
        relatórios: "/relatorios/servicos",
        serviços: "/servicos",
        templates: "/templates",
        guia: "/guia",
        dashboard: "/",
      };

      for (const [key, route] of Object.entries(routes)) {
        if (lowerQuestion.includes(key)) {
          setTimeout(() => router.push(route), 500);
          return {
            sender: "assistant",
            content: `Abrindo ${key}...`,
            type: "text",
            data: { route },
          };
        }
      }
    }

    // Cadastrar usuário/colaborador
    if (/(cadastrar|registrar|adicionar|novo).*(usuário|usuario|colaborador|funcionário|funcionario|admin|administrador)/i.test(lowerQuestion)) {
      return {
        sender: "assistant",
        content: `Para cadastrar um novo usuário/colaborador no sistema, siga estes passos:

1️⃣ Acesse o menu lateral e clique em "Admin" → "Usuários" (ou acesse diretamente /admin/usuarios)

2️⃣ Clique no botão "Novo usuário" ou "Adicionar usuário"

3️⃣ Preencha os dados:
   • Nome completo
   • E-mail (será usado para login)
   • Senha (ou deixe o sistema gerar)
   • Função/Papel (Admin, Vendedor, etc.)

4️⃣ Salve o cadastro

💡 Dica: Apenas administradores podem cadastrar novos usuários. Se você não tem acesso, solicite ao administrador do sistema.

Quer que eu abra a página de usuários para você?`,
        type: "text",
        data: { route: "/admin/usuarios" },
      };
    }

    // ========== PERGUNTAS ESPECÍFICAS POR TÓPICO ==========

    // Perguntas sobre clientes
    if (/cliente/i.test(lowerQuestion)) {
      if (/(onde|onde está|localizar|encontrar)/i.test(lowerQuestion)) {
        return {
          sender: "assistant",
          content: `Para acessar a página de clientes:

1️⃣ Clique em "Clientes" no menu lateral
2️⃣ Ou use o comando "ir para clientes"

Na página de clientes você pode:
• Ver todos os clientes cadastrados
• Buscar clientes por nome, email ou documento
• Cadastrar novos clientes
• Editar informações
• Adicionar serviços
• Exportar dados

Quer que eu abra a página de clientes?`,
          type: "text",
          data: { route: "/clientes" },
        };
      }
      return {
        sender: "assistant",
        content:
          "Para gerenciar clientes, abra a aba 'Clientes' no menu. Você pode cadastrar, editar, buscar e exportar dados. Use 'buscar cliente [nome]' para encontrar clientes específicos. Digite 'como cadastrar cliente' para ver o passo a passo completo.",
      };
    }

    // Perguntas sobre contratos
    if (/contrato/i.test(lowerQuestion)) {
      if (/(onde|onde está|localizar|encontrar)/i.test(lowerQuestion)) {
        return {
          sender: "assistant",
          content: `Para acessar contratos:

1️⃣ Clique em "Contratos" no menu lateral
2️⃣ Ou use o comando "ir para contratos"

Na página de contratos você pode:
• Ver todos os contratos
• Criar novos contratos
• Enviar para assinatura
• Acompanhar status
• Ver contratos pendentes

Digite "como criar contrato" para ver o passo a passo completo.

Quer que eu abra a página de contratos?`,
          type: "text",
          data: { route: "/contratos" },
        };
      }
      return {
        sender: "assistant",
        content:
          "Na aba 'Contratos', você pode gerar novos documentos, acompanhar status e exportar relatórios. Use 'contratos pendentes' para ver o que está aguardando. Digite 'como criar contrato' para ver o passo a passo.",
      };
    }

    // Perguntas sobre TV
    if (/tv|usuário.*tv/i.test(lowerQuestion)) {
      if (/(onde|onde está|localizar|encontrar)/i.test(lowerQuestion)) {
        return {
          sender: "assistant",
          content: `Para acessar usuários TV:

1️⃣ Clique em "Usuários TV" no menu lateral
2️⃣ Ou use o comando "ir para tv"

Na página você verá:
• Todos os acessos ativos atribuídos a clientes
• Informações de cada acesso (email, senha, plano, cliente)
• Opções para gerenciar acessos

Digite "como funciona tv" para entender melhor o sistema.

Quer que eu abra a página de usuários TV?`,
          type: "text",
          data: { route: "/usuarios" },
        };
      }
      return {
        sender: "assistant",
        content:
          "Acesse 'Usuários TV' para ver acessos ativos, planos e vencimentos. Os emails são criados automaticamente. Use 'tv disponível' para ver quantos slots estão livres. Digite 'como funciona tv' para entender melhor o sistema.",
      };
    }

    // Perguntas sobre serviços
    if (/serviço/i.test(lowerQuestion)) {
      if (/(onde|onde está|localizar|encontrar)/i.test(lowerQuestion)) {
        return {
          sender: "assistant",
          content: `Para acessar serviços:

1️⃣ Clique em "Serviços" no menu lateral
2️⃣ Ou use o comando "ir para serviços"

Na página de serviços você pode:
• Ver todos os serviços cadastrados
• Criar novos serviços
• Editar serviços existentes
• Definir preços padrão

Quer que eu abra a página de serviços?`,
          type: "text",
          data: { route: "/servicos" },
        };
      }
      return {
        sender: "assistant",
        content:
          "Os serviços são gerenciados na aba 'Serviços'. Você pode criar novos serviços, definir preços e personalizar valores por cliente. Digite 'como adicionar serviço' para ver o passo a passo.",
      };
    }

    // Perguntas sobre dashboard
    if (/(dashboard|painel|início|home|página inicial)/i.test(lowerQuestion)) {
      return {
        sender: "assistant",
        content: `O dashboard mostra:

📊 **Estatísticas gerais:**
• Total de CPFs e CNPJs
• Cadastros do último mês
• Distribuição por planos

📈 **Gráficos:**
• Vendas mensais por serviço
• Análise de tendências
• Comparação de planos

📋 **Resumo:**
• Serviços e clientes vinculados
• Meta de acessos de TV
• Progresso em tempo real

Para acessar, clique em "Dashboard" no menu ou use "ir para dashboard".

Quer que eu abra o dashboard?`,
        type: "text",
        data: { route: "/" },
      };
    }

    // Perguntas sobre exportação
    if (/(exportar|exportação|baixar|download|csv|excel)/i.test(lowerQuestion)) {
      return {
        sender: "assistant",
        content: `Para exportar dados:

**Na página de Clientes:**
1. Use "Exportar filtrados" para exportar os clientes visíveis
2. Ou use "Exportar documento" com um CPF/CNPJ específico

**Na página de Usuários TV:**
1. Use os filtros para selecionar os dados desejados
2. Clique em "Exportar filtrados"

**Formato:**
• Os dados são exportados em CSV
• Podem ser abertos no Excel ou Google Sheets

Quer que eu abra a página de clientes para exportar?`,
        type: "text",
        data: { route: "/clientes" },
      };
    }

    // Perguntas sobre vencimentos
    if (/(vencimento|vencer|expirar|renovar)/i.test(lowerQuestion) && !/(próximo|próximos)/i.test(lowerQuestion)) {
      return {
        sender: "assistant",
        content: `Sobre vencimentos:

**Como ver vencimentos próximos:**
• Digite "vencimentos" para ver serviços que vencem em até 30 dias
• Ou acesse "Usuários TV" e use os filtros

**Como renovar um acesso:**
1. Acesse "Usuários TV"
2. Clique no ícone de detalhes do acesso
3. Clique em "Renovar"
4. Informe a nova data de vencimento

**Avisos automáticos:**
• O sistema mostra alertas para serviços próximos do vencimento
• Cores indicam urgência (verde, amarelo, vermelho)

Quer ver os vencimentos próximos agora?`,
        type: "text",
      };
    }

    // Perguntas sobre preços
    if (/(preço|preços|valor|valores|quanto custa)/i.test(lowerQuestion)) {
      return {
        sender: "assistant",
        content: `Sobre preços no sistema:

**Preços padrão:**
• Cada serviço tem um preço padrão definido
• Você pode ver/editá-los em "Serviços"

**Preços personalizados:**
• Ao adicionar serviços a um cliente, você pode definir preços personalizados
• Para TV, há preços separados para Essencial e Premium
• Os preços personalizados sobrescrevem os padrão apenas para aquele cliente

**Onde definir:**
• Preços padrão: Página "Serviços"
• Preços personalizados: Ao adicionar serviços a um cliente

Quer que eu abra a página de serviços?`,
        type: "text",
        data: { route: "/servicos" },
      };
    }

    // Perguntas sobre planos TV
    if (/(plano.*tv|essencial.*premium|diferença.*planos|qual.*plano)/i.test(lowerQuestion)) {
      return {
        sender: "assistant",
        content: `Sobre os planos de TV:

📺 **TV Essencial:**
• Plano básico de TV
• Pode ter preço personalizado diferente do Premium

🎬 **TV Premium:**
• Plano premium de TV
• Pode ter preço personalizado diferente do Essencial

**Funcionamento:**
• Um cliente pode ter acessos Essencial E Premium ao mesmo tempo
• Cada tipo de acesso é contado separadamente
• Você define quantidades de cada tipo ao adicionar serviços

**Onde configurar:**
• Ao adicionar serviços TV a um cliente
• Defina quantidades separadas para Essencial e Premium

Quer saber mais sobre como adicionar serviços TV?`,
        type: "text",
      };
    }

    // ========== RESPOSTA PADRÃO INTELIGENTE ==========
    
    // Tentar identificar a intenção mesmo sem match exato
    if (/(quem|qual|quando|onde|por que|porque|por quê|como|o que)/i.test(lowerQuestion)) {
      return {
        sender: "assistant",
        content: `Desculpe, não entendi completamente sua pergunta. 😅

Posso ajudar com:
• 📋 Cadastro e gestão de clientes
• 📄 Criação de contratos
• 📺 Gerenciamento de acessos TV
• 📊 Relatórios e estatísticas
• 🔍 Busca de informações
• ❓ Dúvidas sobre o sistema

Tente reformular sua pergunta ou digite "ajuda" para ver todos os comandos disponíveis.

Exemplos de perguntas:
• "Como cadastrar um cliente?"
• "Como criar um contrato?"
• "Como adicionar serviços?"
• "Onde estão os relatórios?"`,
        type: "text",
      };
    }

    // Resposta genérica amigável
    return {
      sender: "assistant",
      content: `Olá! 😊 Não entendi completamente sua pergunta, mas estou aqui para ajudar!

Posso ajudar você com:
• 📋 **Clientes**: Cadastrar, editar, buscar
• 📄 **Contratos**: Criar, enviar, acompanhar
• 📺 **TV**: Gerenciar acessos, planos, vencimentos
• 📊 **Relatórios**: Estatísticas, análises, exportações
• 🔍 **Busca**: Encontrar clientes, verificar status
• ❓ **Dúvidas**: Explicar como usar o sistema

**Exemplos de perguntas:**
• "Como cadastrar um cliente?"
• "Como criar um contrato?"
• "Como adicionar serviços a um cliente?"
• "Onde estão os relatórios?"
• "Como funciona o sistema de TV?"

Digite "ajuda" para ver todos os comandos disponíveis ou faça uma pergunta específica! 😊`,
      type: "text",
    };
  };

  const handleSend = async () => {
    if (!input.trim() || isTyping) return;

    const question = input.trim();
    setMessages((prev) => [...prev, { sender: "user", content: question }]);
    setInput("");
    setIsTyping(true);

    // Simula delay de digitação
    await new Promise((resolve) => setTimeout(resolve, 300));

    try {
      const reply = await processMessage(question);
      setMessages((prev) => [...prev, reply]);
    } catch (error) {
      setMessages((prev) => [
        ...prev,
        {
          sender: "assistant",
          content: "Desculpe, ocorreu um erro ao processar sua solicitação. Tente novamente.",
        },
      ]);
    } finally {
      setIsTyping(false);
    }
  };

  const handleQuickCommand = (command: string) => {
    setInput(command);
    // Trigger send after input is set
    setTimeout(() => {
      handleSend();
    }, 0);
  };

  const formatDate = (dateStr: string) => {
    try {
      return new Date(dateStr).toLocaleDateString("pt-BR");
    } catch {
      return dateStr;
    }
  };

  return (
    <>
      {open && (
        <Box
          position="fixed"
          bottom={{ base: 24, md: 28 }}
          right={{ base: 4, md: 8 }}
          w={{ base: "90%", md: "420px" }}
          maxH="70vh"
          bg={panelBg}
          borderRadius="2xl"
          boxShadow="2xl"
          borderWidth={1}
          borderColor="rgba(99, 102, 241, 0.3)"
          p={4}
          zIndex={40}
          display="flex"
          flexDirection="column"
        >
          <Flex justify="space-between" align="center" mb={3}>
            <Text fontWeight="semibold" fontSize="lg">
              Assistente virtual
            </Text>
            <Flex gap={2}>
              <Tooltip label="Limpar histórico">
                <IconButton
                  aria-label="Limpar histórico"
                  icon={<FiTrash2 />}
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    if (window.confirm("Deseja realmente limpar o histórico de conversas?")) {
                      sessionStorage.removeItem(CHAT_HISTORY_KEY);
                      setMessages([initialMessage]);
                      toast({
                        title: "Histórico limpo",
                        description: "O histórico de conversas foi apagado.",
                        status: "success",
                        duration: 2000,
                      });
                    }
                  }}
                />
              </Tooltip>
              <IconButton aria-label="Fechar" icon={<FiX />} size="sm" variant="ghost" onClick={() => setOpen(false)} />
            </Flex>
          </Flex>

          <Stack spacing={3} flex={1} overflowY="auto" mb={3} pr={1} maxH="calc(70vh - 140px)">
            {messages.map((message, index) => (
              <Box key={index}>
                {message.type === "stats" && message.data?.stats ? (
                  <Box alignSelf="flex-start" bg={cardBg} p={4} borderRadius="lg" maxW="100%">
                    <Text fontWeight="semibold" mb={3}>
                      {message.content}
                    </Text>
                    <VStack align="stretch" spacing={2}>
                      <Flex justify="space-between" align="center">
                        <Text fontSize="sm">Clientes:</Text>
                        <Badge colorScheme="blue" fontSize="md">
                          {message.data.stats.clients}
                        </Badge>
                      </Flex>
                      <Flex justify="space-between" align="center">
                        <Text fontSize="sm">Contratos:</Text>
                        <Badge colorScheme="purple" fontSize="md">
                          {message.data.stats.contracts}
                        </Badge>
                      </Flex>
                      <Flex justify="space-between" align="center">
                        <Text fontSize="sm">TV Ativos:</Text>
                        <Badge colorScheme="green" fontSize="md">
                          {message.data.stats.tvActive}
                        </Badge>
                      </Flex>
                      <Flex justify="space-between" align="center">
                        <Text fontSize="sm">Serviços:</Text>
                        <Badge colorScheme="orange" fontSize="md">
                          {message.data.stats.services}
                        </Badge>
                      </Flex>
                    </VStack>
                  </Box>
                ) : message.type === "search" && message.data?.clients ? (
                  <Box alignSelf="flex-start" bg={cardBg} p={4} borderRadius="lg" maxW="100%">
                    <Text fontWeight="semibold" mb={2}>
                      {message.content}
                    </Text>
                    <VStack align="stretch" spacing={2}>
                      {message.data.clients.map((client) => (
                        <Box key={client.id} p={2} bg={assistantBubbleBg} borderRadius="md">
                          <Text fontWeight="medium" fontSize="sm">
                            {client.name}
                          </Text>
                          <Text fontSize="xs" color="gray.500">
                            {client.document} · {client.email}
                          </Text>
                          <Link
                            as={NextLink}
                            href={`/clientes?search=${encodeURIComponent(client.name)}`}
                            fontSize="xs"
                            color="brand.500"
                            display="flex"
                            alignItems="center"
                            gap={1}
                            mt={1}
                          >
                            Ver cliente <FiArrowRight />
                          </Link>
                        </Box>
                      ))}
                    </VStack>
                  </Box>
                ) : message.type === "contracts" && message.data?.contracts ? (
                  <Box alignSelf="flex-start" bg={cardBg} p={4} borderRadius="lg" maxW="100%">
                    <Text fontWeight="semibold" mb={2}>
                      {message.content}
                    </Text>
                    <VStack align="stretch" spacing={2}>
                      {message.data.contracts.map((contract) => (
                        <Box key={contract.id} p={2} bg={assistantBubbleBg} borderRadius="md">
                          <Text fontWeight="medium" fontSize="sm">
                            {contract.title}
                          </Text>
                          <Text fontSize="xs" color="gray.500">
                            {contract.clientName}
                          </Text>
                          <Badge size="sm" colorScheme={contract.status === "DRAFT" ? "gray" : "yellow"} mt={1}>
                            {contract.status === "DRAFT" ? "Rascunho" : "Enviado"}
                          </Badge>
                        </Box>
                      ))}
                    </VStack>
                    <Button
                      as={NextLink}
                      href="/contratos"
                      size="sm"
                      mt={2}
                      colorScheme="brand"
                      variant="outline"
                      leftIcon={<FiFileText />}
                    >
                      Ver todos os contratos
                    </Button>
                  </Box>
                ) : message.type === "expiring" && message.data?.expiring ? (
                  <Box alignSelf="flex-start" bg={cardBg} p={4} borderRadius="lg" maxW="100%">
                    <Text fontWeight="semibold" mb={2}>
                      {message.content}
                    </Text>
                    <VStack align="stretch" spacing={2}>
                      {message.data.expiring.map((item, idx) => (
                        <Box key={idx} p={2} bg={assistantBubbleBg} borderRadius="md">
                          <Flex justify="space-between" align="start">
                            <Box>
                              <Text fontWeight="medium" fontSize="sm">
                                {item.clientName}
                              </Text>
                              <Text fontSize="xs" color="gray.500">
                                {item.serviceName}
                              </Text>
                            </Box>
                            <Badge colorScheme="red" fontSize="xs">
                              {formatDate(item.expiresAt)}
                            </Badge>
                          </Flex>
                        </Box>
                      ))}
                    </VStack>
                  </Box>
                ) : message.type === "sales" && message.data?.sales ? (
                  <Box alignSelf="flex-start" bg={cardBg} p={4} borderRadius="lg" maxW="100%">
                    <Text fontWeight="semibold" mb={2}>
                      {message.content}
                    </Text>
                    <VStack align="stretch" spacing={3}>
                      <Box p={3} bg={assistantBubbleBg} borderRadius="md">
                        <Text fontSize="sm" fontWeight="medium" mb={1}>
                          Total de vendas: {message.data.sales.totalSales}
                        </Text>
                        <Text fontSize="xs" color="gray.500">
                          Período: {new Date(message.data.sales.range.start).toLocaleDateString("pt-BR")} até{" "}
                          {new Date(message.data.sales.range.end).toLocaleDateString("pt-BR")}
                        </Text>
                      </Box>
                      {message.data.sales.services.length > 0 && (
                        <Box>
                          <Text fontSize="sm" fontWeight="medium" mb={2}>
                            Serviços:
                          </Text>
                          <VStack align="stretch" spacing={1}>
                            {message.data.sales.services.slice(0, 5).map((service) => (
                              <Flex key={service.key} justify="space-between" align="center" fontSize="xs">
                                <Text>{service.name}</Text>
                                <Badge size="sm" colorScheme={service.group === "TV" ? "purple" : "blue"}>
                                  {service.group}
                                </Badge>
                              </Flex>
                            ))}
                          </VStack>
                        </Box>
                      )}
                      <Button
                        as={NextLink}
                        href="/relatorios/servicos"
                        size="sm"
                        mt={2}
                        colorScheme="brand"
                        variant="outline"
                        leftIcon={<FiFileText />}
                      >
                        Ver relatórios completos
                      </Button>
                    </VStack>
                  </Box>
                ) : message.type === "suggestions" && message.data?.suggestions ? (
                  <Box alignSelf="flex-start" bg={cardBg} p={4} borderRadius="lg" maxW="100%">
                    <Text fontWeight="semibold" mb={2}>
                      {message.content}
                    </Text>
                    <VStack align="stretch" spacing={2}>
                      {message.data.suggestions.map((suggestion, idx) => (
                        <Box
                          key={idx}
                          p={3}
                          bg={assistantBubbleBg}
                          borderRadius="md"
                          borderLeftWidth={3}
                          borderLeftColor={
                            suggestion.type === "warning"
                              ? "red.500"
                              : suggestion.type === "info"
                                ? "blue.500"
                                : suggestion.type === "success"
                                  ? "green.500"
                                  : "purple.500"
                          }
                        >
                          <Flex justify="space-between" align="start" mb={suggestion.action ? 2 : 0}>
                            <Box flex={1}>
                              <Text fontWeight="medium" fontSize="sm" mb={1}>
                                {suggestion.title}
                              </Text>
                              <Text fontSize="xs" color="gray.500">
                                {suggestion.description}
                              </Text>
                            </Box>
                            <Badge
                              size="sm"
                              colorScheme={
                                suggestion.type === "warning"
                                  ? "red"
                                  : suggestion.type === "info"
                                    ? "blue"
                                    : suggestion.type === "success"
                                      ? "green"
                                      : "purple"
                              }
                              ml={2}
                            >
                              {suggestion.type === "warning"
                                ? "Atenção"
                                : suggestion.type === "info"
                                  ? "Info"
                                  : suggestion.type === "success"
                                    ? "Sucesso"
                                    : "Ação"}
                            </Badge>
                          </Flex>
                          {suggestion.action && (
                            <Button
                              as={NextLink}
                              href={suggestion.action.route}
                              size="xs"
                              colorScheme="brand"
                              variant="outline"
                              leftIcon={<FiArrowRight />}
                              mt={2}
                            >
                              {suggestion.action.label}
                            </Button>
                          )}
                        </Box>
                      ))}
                    </VStack>
                  </Box>
                ) : message.type === "commands" ? (
                  <Box alignSelf="flex-start" bg={cardBg} p={4} borderRadius="lg" maxW="100%">
                    <Text fontWeight="semibold" mb={3}>
                      {message.content}
                    </Text>
                    <VStack align="stretch" spacing={2}>
                      {QUICK_COMMANDS.map((cmd, idx) => (
                        <Button
                          key={idx}
                          size="sm"
                          variant="ghost"
                          justifyContent="flex-start"
                          onClick={() => handleQuickCommand(cmd.command)}
                          leftIcon={<FiArrowRight />}
                        >
                          {cmd.label}
                        </Button>
                      ))}
                    </VStack>
                    <Divider my={3} />
                    <Text fontSize="xs" color="gray.500" mb={2}>
                      Você também pode fazer perguntas como:
                    </Text>
                    <VStack align="stretch" spacing={1}>
                      <Text fontSize="xs" fontWeight="semibold">📋 Sobre o sistema:</Text>
                      <Text fontSize="xs">• "Como cadastrar um cliente?"</Text>
                      <Text fontSize="xs">• "Como criar um contrato?"</Text>
                      <Text fontSize="xs">• "Como adicionar serviços?"</Text>
                      <Text fontSize="xs">• "Como funciona o sistema de TV?"</Text>
                      <Divider my={2} />
                      <Text fontSize="xs" fontWeight="semibold">📊 Consultas:</Text>
                      <Text fontSize="xs">• "estatísticas" - Mostrar estatísticas gerais</Text>
                      <Text fontSize="xs">• "buscar cliente João" - Buscar clientes</Text>
                      <Text fontSize="xs">• "contratos pendentes" - Ver contratos aguardando</Text>
                      <Text fontSize="xs">• "vencimentos" - Serviços próximos do vencimento</Text>
                      <Divider my={2} />
                      <Text fontSize="xs" fontWeight="semibold">🧭 Navegação:</Text>
                      <Text fontSize="xs">• "ir para clientes" - Navegar para páginas</Text>
                      <Text fontSize="xs">• "ir para dashboard" - Ir para o início</Text>
                    </VStack>
                  </Box>
                ) : (
                  <Box
                    alignSelf={message.sender === "user" ? "flex-end" : "flex-start"}
                    bg={message.sender === "user" ? "brand.500" : assistantBubbleBg}
                    color={message.sender === "user" ? "white" : undefined}
                    px={4}
                    py={2}
                    borderRadius="lg"
                    maxW="80%"
                  >
                    <Text fontSize="sm" whiteSpace="pre-wrap">
                      {message.content}
                    </Text>
                  </Box>
                )}
              </Box>
            ))}

            {isTyping && (
              <Box alignSelf="flex-start" bg={assistantBubbleBg} px={4} py={2} borderRadius="lg">
                <Spinner size="sm" color="brand.500" />
              </Box>
            )}

            <div ref={messagesEndRef} />
          </Stack>

          <Flex as="form" onSubmit={(e) => e.preventDefault()} gap={2}>
            <Input
              placeholder="Digite sua dúvida ou comando..."
              value={input}
              onChange={(event) => setInput(event.target.value)}
              onKeyPress={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
            />
            <IconButton
              aria-label="Enviar"
              icon={<FiSend />}
              colorScheme="brand"
              onClick={handleSend}
              isDisabled={!input.trim() || isTyping}
              isLoading={isTyping}
            />
          </Flex>
        </Box>
      )}

      <Tooltip label="Assistente virtual" placement="left" isDisabled={open}>
        <Flex
          position="fixed"
          bottom={{ base: 16, md: 8 }}
          right={{ base: 3, md: 8 }}
          align="center"
          justify="center"
          bg="transparent"
          borderRadius="full"
          boxShadow="2xl"
          borderWidth={open ? 1 : 0}
          borderColor={toggleBorder}
          p={open ? 2 : 1.5}
          zIndex={50}
          transition="transform 0.2s ease, box-shadow 0.2s ease"
          _hover={{ transform: "translateY(-2px)", boxShadow: "0 16px 32px rgba(15, 23, 42, 0.22)" }}
        >
          <IconButton
            aria-label={open ? "Fechar assistente virtual" : "Abrir assistente virtual"}
            onClick={() => setOpen((prev) => !prev)}
            bg="rgba(59, 130, 246, 0.55)"
            _hover={{ bg: "rgba(59, 130, 246, 0.72)" }}
            _active={{ bg: "rgba(37, 99, 235, 0.74)" }}
            borderRadius="full"
            size={open ? "md" : "lg"}
            icon={<Icon as={FiMessageCircle} boxSize={open ? 5 : 6} />}
            animation={!open ? "pulse 2s infinite" : undefined}
          />
        </Flex>
      </Tooltip>

      <style>
        {`
        @keyframes pulse {
          0% { transform: scale(1); box-shadow: 0 0 0 0 rgba(96, 165, 250, 0.7); }
          70% { transform: scale(1.05); box-shadow: 0 0 0 12px rgba(96, 165, 250, 0); }
          100% { transform: scale(1); box-shadow: 0 0 0 0 rgba(96, 165, 250, 0); }
        }
        `}
      </style>
    </>
  );
}





