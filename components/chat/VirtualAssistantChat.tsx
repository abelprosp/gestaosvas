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
import { FiMessageCircle, FiSend, FiX, FiUsers, FiFileText, FiMonitor, FiSettings, FiArrowRight } from "react-icons/fi";
import NextLink from "next/link";
import { useRouter, usePathname } from "next/navigation";
import {
  getAssistantStats,
  searchClients,
  getPendingContracts,
  getAvailableTVSlots,
  getExpiringServices,
  type ClientSearchResult,
  type PendingContract,
  type ExpiringService,
} from "@/lib/api/assistant";

interface Message {
  sender: "assistant" | "user";
  content: string;
  type?: "text" | "stats" | "search" | "commands" | "contracts" | "expiring";
  data?: {
    stats?: { clients: number; contracts: number; tvActive: number; services: number };
    clients?: ClientSearchResult[];
    contracts?: PendingContract[];
    expiring?: ExpiringService[];
    tvAvailable?: number;
    route?: string;
  };
}

const QUICK_COMMANDS = [
  { label: "Quantos clientes temos?", command: "quantos clientes" },
  { label: "Mostrar estatísticas", command: "estatísticas" },
  { label: "Contratos pendentes", command: "contratos pendentes" },
  { label: "Vencimentos próximos", command: "vencimentos" },
  { label: "Slots TV disponíveis", command: "tv disponível" },
  { label: "Ajuda", command: "ajuda" },
];

export function VirtualAssistantChat() {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Message[]>([
    {
      sender: "assistant",
      content: "Olá! Sou o assistente virtual. Como posso ajudar?",
      type: "commands",
      data: {},
    },
  ]);
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
            <IconButton aria-label="Fechar" icon={<FiX />} size="sm" variant="ghost" onClick={() => setOpen(false)} />
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
                      <Text fontSize="xs">• Buscar clientes: "buscar cliente João"</Text>
                      <Text fontSize="xs">• Ver estatísticas: "quantos clientes temos"</Text>
                      <Text fontSize="xs">• Navegar: "ir para clientes"</Text>
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





