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
    const stored = localStorage.getItem(CHAT_HISTORY_KEY);
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
    const limitedMessages = messages.slice(-MAX_HISTORY_MESSAGES);
    localStorage.setItem(CHAT_HISTORY_KEY, JSON.stringify(limitedMessages));
  } catch (error) {
    console.error("Erro ao salvar histórico do chat:", error);
  }
}

const initialMessage: Message = {
  sender: "assistant",
  content: "Olá! Sou o assistente virtual. Como posso ajudar?",
  type: "commands",
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
        localStorage.removeItem(CHAT_HISTORY_KEY);
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

    // Ajuda
    if (/^(ajuda|help|comandos|menu|o que você pode|o que posso)/i.test(lowerQuestion)) {
      return {
        sender: "assistant",
        type: "commands",
        content: "Aqui estão alguns comandos úteis:",
        data: {},
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

    // Respostas padrão baseadas em palavras-chave
    if (/cliente/i.test(lowerQuestion)) {
      return {
        sender: "assistant",
        content:
          "Para gerenciar clientes, abra a aba 'Clientes' no menu. Você pode cadastrar, editar, buscar e exportar dados. Use 'buscar cliente [nome]' para encontrar clientes específicos.",
      };
    }

    if (/contrato/i.test(lowerQuestion)) {
      return {
        sender: "assistant",
        content:
          "Na aba 'Contratos', você pode gerar novos documentos, acompanhar status e exportar relatórios. Use 'contratos pendentes' para ver o que está aguardando.",
      };
    }

    if (/tv|usuário.*tv/i.test(lowerQuestion)) {
      return {
        sender: "assistant",
        content:
          "Acesse 'Usuários TV' para ver acessos ativos, planos e vencimentos. Os emails são criados automaticamente. Use 'tv disponível' para ver quantos slots estão livres.",
      };
    }

    if (/serviço/i.test(lowerQuestion)) {
      return {
        sender: "assistant",
        content:
          "Os serviços são gerenciados na aba 'Serviços'. Você pode criar novos serviços, definir preços e personalizar valores por cliente.",
      };
    }

    // Resposta genérica
    return {
      sender: "assistant",
      content:
        "Posso ajudar com estatísticas, buscar clientes, verificar contratos pendentes, vencimentos e mais. Digite 'ajuda' para ver todos os comandos disponíveis.",
      type: "commands",
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
                      localStorage.removeItem(CHAT_HISTORY_KEY);
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
                      Você também pode:
                    </Text>
                    <VStack align="stretch" spacing={1}>
                      <Text fontSize="xs" fontWeight="semibold">📊 Estatísticas e análises:</Text>
                      <Text fontSize="xs">• "estatísticas" - Mostrar estatísticas gerais</Text>
                      <Text fontSize="xs">• "análise de vendas" - Gráfico de vendas</Text>
                      <Text fontSize="xs">• "tendências" - Análise de crescimento</Text>
                      <Text fontSize="xs">• "comparar planos" - Comparação TV Essencial vs Premium</Text>
                      <Divider my={2} />
                      <Text fontSize="xs" fontWeight="semibold">🔍 Buscas:</Text>
                      <Text fontSize="xs">• "buscar cliente João" - Buscar clientes</Text>
                      <Text fontSize="xs">• "contratos pendentes" - Ver contratos aguardando</Text>
                      <Text fontSize="xs">• "vencimentos" - Serviços próximos do vencimento</Text>
                      <Text fontSize="xs">• "tv disponível" - Slots TV livres</Text>
                      <Divider my={2} />
                      <Text fontSize="xs" fontWeight="semibold">➕ Ações rápidas:</Text>
                      <Text fontSize="xs">• "cadastrar cliente" - Novo cliente</Text>
                      <Text fontSize="xs">• "criar contrato" - Novo contrato</Text>
                      <Text fontSize="xs">• "relatório completo" - Abrir relatórios</Text>
                      <Divider my={2} />
                      <Text fontSize="xs" fontWeight="semibold">🧭 Navegação:</Text>
                      <Text fontSize="xs">• "ir para clientes" - Navegar para páginas</Text>
                      <Text fontSize="xs">• "ir para dashboard" - Ir para o início</Text>
                      <Divider my={2} />
                      <Text fontSize="xs" fontWeight="semibold">⚙️ Utilitários:</Text>
                      <Text fontSize="xs">• "sugestões" - Ver recomendações proativas</Text>
                      <Text fontSize="xs">• "limpar histórico" - Resetar conversa</Text>
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





