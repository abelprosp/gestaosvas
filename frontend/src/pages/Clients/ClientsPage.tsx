import {
  Badge,
  Box,
  Button,
  Flex,
  Heading,
  HStack,
  IconButton,
  Input,
  InputGroup,
  InputLeftElement,
  SimpleGrid,
  Skeleton,
  Table,
  Tbody,
  Td,
  Th,
  Thead,
  Tr,
  Text,
  useDisclosure,
  useToast,
  VStack,
  useColorModeValue,
  Stack,
  Collapse,
  Grid,
  Select,
} from "@chakra-ui/react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Fragment, ReactElement, useEffect, useMemo, useState } from "react";
import {
  FiChevronDown,
  FiChevronUp,
  FiDownload,
  FiEdit,
  FiFilePlus,
  FiPlus,
  FiSearch,
  FiTrash,
  FiUpload,
} from "react-icons/fi";
import { api } from "../../api/client";
import { Client, ClientTVAssignment, PaginatedResponse, Service, StatsOverview } from "../../types";
import { ClientFormModal, ClientFormValues } from "../../components/forms/ClientFormModal";
import { formatDate } from "../../utils/format";
import { exportToCsv, exportToPdf } from "../../utils/exporters";
import Papa from "papaparse";
import { useAuth } from "../../context/AuthContext";
import { createRequest } from "../../api/requests";

const currencyFormatter = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

export function ClientsPage() {
  const toast = useToast();
  const queryClient = useQueryClient();
  const { isAdmin } = useAuth();
  const extractErrorMessage = (error: unknown) => {
    if (error && typeof error === "object") {
      if ("message" in error && typeof (error as { message?: unknown }).message === "string") {
        return (error as { message: string }).message;
      }
      const withResponse = error as { response?: { data?: { message?: unknown } } };
      if (
        withResponse.response &&
        withResponse.response.data &&
        typeof withResponse.response.data.message === "string"
      ) {
        return withResponse.response.data.message;
      }
    }
    return "Não foi possível concluir a operação.";
  };
  const handleAuthorizationRequest = async (action: string, payload: Record<string, unknown>) => {
    try {
      await createRequest(action, payload);
      toast({
        title: "Solicitação enviada",
        description: "O administrador foi notificado.",
        status: "success",
      });
    } catch (error) {
      console.error(error);
      toast({
        title: "Falha ao enviar solicitação",
        description: extractErrorMessage(error),
        status: "error",
      });
    }
  };
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedClient, setSelectedClient] = useState<Client | undefined>();
  const [isImporting, setIsImporting] = useState(false);
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: "asc" | "desc" } | null>(null);
  const [expandedAssignments, setExpandedAssignments] = useState<Record<string, boolean>>({});
  const [expandedClientId, setExpandedClientId] = useState<string | null>(null);
  const formModal = useDisclosure();
  const handleExportCsv = () => {
    if (!filteredClients.length) {
      toast({ title: "Nenhum cliente para exportar", status: "info" });
      return;
    }

    exportToCsv(
      "clientes.csv",
      filteredClients.map((client: Client) => ({
        Nome: client.name,
        Email: client.email,
        Documento: client.document,
        Telefone: client.phone ?? "",
        Empresa: client.companyName ?? "",
        Cidade: client.city ?? "",
        Estado: client.state ?? "",
        CentroDeCusto: client.costCenter,
        Servicos: (client.services ?? []).map((service: Service) => service.name).join(", "),
        ValoresPersonalizados: (client.services ?? [])
          .filter((service: Service) => service.customPrice !== null && service.customPrice !== undefined)
          .map((service: Service) => `${service.name}: ${currencyFormatter.format(service.customPrice ?? 0)}`)
          .join(", "),
        CriadoEm: formatDate(client.createdAt),
      })),
    );
  };

  const toggleAssignmentsVisibility = (clientId: string) => {
    setExpandedAssignments((prev) => ({
      ...prev,
      [clientId]: !prev[clientId],
    }));
  };

  const toggleClientDetails = (clientId: string) => {
    setExpandedClientId((current) => (current === clientId ? null : clientId));
  };

  const handleExportPdf = () => {
    if (!filteredClients.length) {
      toast({ title: "Nenhum cliente para exportar", status: "info" });
      return;
    }

    exportToPdf(
      "Relatorio_Clientes",
      ["Nome", "Email", "Documento", "Telefone", "Empresa", "Centro de custo", "Serviços", "Valores personalizados"],
      filteredClients.map((client: Client) => {
        const servicesList = (client.services ?? []).map((service: Service) => service.name).join(", ");
        const negotiatedList = (client.services ?? [])
          .filter((service: Service) => service.customPrice !== null && service.customPrice !== undefined)
          .map((service: Service) => `${service.name}: ${currencyFormatter.format(service.customPrice ?? 0)}`)
          .join(", ");
        return [
          client.name,
          client.email,
          client.document,
          client.phone ?? "",
          client.companyName ?? "",
          client.costCenter,
          servicesList,
          negotiatedList,
        ];
      }),
    );
  };

  const handleImportCsv = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsImporting(true);
    Papa.parse<ClientFormValues>(file, {
      header: true,
      skipEmptyLines: true,
      complete: async (results) => {
        const { data, errors } = results;
        if (errors.length) {
          toast({ title: "CSV inválido", description: errors[0].message, status: "error" });
          setIsImporting(false);
          return;
        }

        try {
          for (const row of data) {
            if (!row.name || !row.email || !row.document) continue;
            const normalizedDocument = row.document.replace(/\D/g, "");
            const payload: ClientFormValues = {
              ...row,
              document: normalizedDocument,
              costCenter: (row as { costCenter?: string }).costCenter === "NEXUS" ? "NEXUS" : "LUXUS",
            };
            await api.post("/clients", payload);
          }
          toast({ title: "Importação concluída", status: "success" });
          queryClient.invalidateQueries({ queryKey: ["clients"] });
        } catch (error) {
          toast({
            title: "Erro ao importar",
            status: "error",
            description: extractErrorMessage(error),
          });
        } finally {
          setIsImporting(false);
          const input = document.getElementById("clients-import-input") as HTMLInputElement | null;
          if (input) input.value = "";
        }
      },
    });
  };


  const { data: services = [] } = useQuery<Service[]>({
    queryKey: ["services"],
    queryFn: async () => {
      const response = await api.get<Service[]>("/services");
      return response.data;
    },
    staleTime: 5 * 60 * 1000,
    placeholderData: [],
  });

  const { data: statsOverview } = useQuery<StatsOverview>({
    queryKey: ["statsOverview"],
    queryFn: async () => {
      const response = await api.get<StatsOverview>("/stats/overview");
      return response.data;
    },
    staleTime: 5 * 60 * 1000,
  });

  const [page, setPage] = useState(1);
  const [documentTypeFilter, setDocumentTypeFilter] = useState<"ALL" | "CPF" | "CNPJ">("ALL");
  const limit = 50;

  const {
    data: clientsResponse,
    isLoading,
    isFetching,
  } = useQuery<PaginatedResponse<Client>>({
    queryKey: ["clients", { page, search: searchTerm, documentType: documentTypeFilter }],
    queryFn: async () => {
      const response = await api.get<PaginatedResponse<Client>>("/clients", {
        params: {
          page,
          limit,
          ...(searchTerm ? { search: searchTerm } : {}),
          ...(documentTypeFilter !== "ALL" ? { documentType: documentTypeFilter } : {}),
        },
      });
      return response.data;
    },
    staleTime: 5 * 60 * 1000,
  });

  useEffect(() => {
    setPage(1);
  }, [searchTerm, documentTypeFilter]);

  const clients = useMemo<Client[]>(() => clientsResponse?.data ?? [], [clientsResponse]);
  const totalClients = clientsResponse?.total ?? 0;
  const totalPages = clientsResponse?.totalPages ?? 1;

  const clientMetrics = statsOverview?.metrics?.all ?? {
    cpf: 0,
    cnpj: 0,
    total: 0,
    lastMonth: 0,
  };

  const filteredClients = useMemo<Client[]>(() => {
    const term = searchTerm.toLowerCase();
    const scopedClients: Client[] = clients;
    const filtered = term
      ? scopedClients.filter((client: Client) => {
          const baseMatch = [client.name, client.email, client.document, client.companyName, client.costCenter]
            .filter(Boolean)
            .some((value) => value?.toLowerCase().includes(term));

          const servicesMatch = (client.services ?? []).some((service: Service) =>
            service.name.toLowerCase().includes(term),
          );

          const assignmentsMatch = (client.tvAssignments ?? []).some((assignment: ClientTVAssignment) =>
            [assignment.email, assignment.username, assignment.soldBy ?? undefined, assignment.profileLabel ?? undefined]
              .filter(Boolean)
              .some((value) => value?.toLowerCase().includes(term)),
          );

          return baseMatch || servicesMatch || assignmentsMatch;
        })
      : scopedClients;

    if (!sortConfig) {
      return filtered;
    }

    const sorted = [...filtered].sort((a, b) => {
      const direction = sortConfig.direction === "asc" ? 1 : -1;
      switch (sortConfig.key) {
        case "name":
          return direction * a.name.localeCompare(b.name, "pt-BR", { sensitivity: "base" });
        case "document":
          return direction * (a.document ?? "").localeCompare(b.document ?? "", "pt-BR", { sensitivity: "base" });
        case "email":
          return direction * (a.email ?? "").localeCompare(b.email ?? "", "pt-BR", { sensitivity: "base" });
        case "costCenter":
          return direction * a.costCenter.localeCompare(b.costCenter, "pt-BR", { sensitivity: "base" });
        case "services": {
          const aServices = (a.services ?? []).map((service: Service) => service.name).join(", ");
          const bServices = (b.services ?? []).map((service: Service) => service.name).join(", ");
          return direction * aServices.localeCompare(bServices, "pt-BR", { sensitivity: "base" });
        }
        case "createdAt": {
          const aDate = new Date(a.createdAt).getTime();
          const bDate = new Date(b.createdAt).getTime();
          return direction * (aDate - bDate);
        }
        default:
          return 0;
      }
    });

    return sorted;
  }, [clients, searchTerm, sortConfig]);

  const handleSort = (key: string) => {
    setSortConfig((prev) => {
      if (!prev || prev.key !== key) {
        return { key, direction: "asc" };
      }
      if (prev.direction === "asc") {
        return { key, direction: "desc" };
      }
      return null;
    });
  };

const getSortIcon = (key: string): ReactElement | undefined => {
    if (!sortConfig || sortConfig.key !== key) return undefined;
    return sortConfig.direction === "asc" ? <FiChevronUp /> : <FiChevronDown />;
  };

  const handlePreviousPage = () => {
    setPage((current) => Math.max(1, current - 1));
  };

  const handleNextPage = () => {
    setPage((current) => Math.min(totalPages, current + 1));
  };

  const createClient = useMutation({
    mutationFn: async (values: ClientFormValues) => {
      await api.post("/clients", values);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["clients"] });
    },
  });

  const updateClient = useMutation({
    mutationFn: async ({ id, values }: { id: string; values: ClientFormValues }) => {
      await api.put(`/clients/${id}`, values);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["clients"] });
    },
  });

  const deleteClient = useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/clients/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["clients"] });
    },
  });

  const handleCreate = async (values: ClientFormValues) => {
    await createClient.mutateAsync(values);
  };

  const handleUpdate = async (values: ClientFormValues) => {
    if (!selectedClient) return;
    if (!isAdmin) {
      await handleAuthorizationRequest("CLIENT_UPDATE_REQUEST", { clientId: selectedClient.id, values });
      formModal.onClose();
      return;
    }
    await updateClient.mutateAsync({ id: selectedClient.id, values });
  };

  const handleDelete = async (client: Client) => {
    if (!isAdmin) {
      await handleAuthorizationRequest("CLIENT_DELETE_REQUEST", { clientId: client.id });
      return;
    }
    try {
      await deleteClient.mutateAsync(client.id);
      toast({ title: "Cliente removido", status: "success" });
    } catch (error) {
      console.error(error);
      toast({ title: "Erro ao remover cliente", status: "error", description: extractErrorMessage(error) });
    }
  };

  const openCreateModal = () => {
    setSelectedClient(undefined);
    formModal.onOpen();
  };

  const openEditModal = (client: Client) => {
    setSelectedClient(client);
    formModal.onOpen();
  };

  const sectionBg = useColorModeValue("rgba(255,255,255,0.78)", "rgba(15, 23, 42, 0.7)");
  const sectionBorder = useColorModeValue("rgba(226,232,240,0.6)", "rgba(45, 55, 72, 0.6)");
  const mutedText = useColorModeValue("gray.500", "gray.400");
  const assignmentDetailBg = useColorModeValue("rgba(255,255,255,0.95)", "rgba(17, 24, 39, 0.85)");

  return (
    <VStack align="stretch" spacing={{ base: 6, md: 8 }}>
      <Flex
        direction={{ base: "column", md: "row" }}
        align={{ base: "flex-start", md: "center" }}
        justify="space-between"
        gap={{ base: 4, md: 6 }}
      >
        <Box>
          <Heading size="lg">Clientes</Heading>
          <Text color={mutedText}>Gerencie cadastros, contratos associados e linhas.</Text>
        </Box>
        <Stack
          spacing={3}
          direction={{ base: "column", lg: "row" }}
          align={{ base: "stretch", lg: "center" }}
          justifyContent="flex-end"
          w="full"
        >
          <Button leftIcon={<FiDownload />} variant="outline" onClick={handleExportCsv} w={{ base: "full", lg: "auto" }}>
            Exportar CSV
          </Button>
          <Button leftIcon={<FiFilePlus />} variant="outline" onClick={handleExportPdf} w={{ base: "full", lg: "auto" }}>
            Exportar PDF
          </Button>
          <Button
            leftIcon={<FiUpload />}
            variant="outline"
            isLoading={isImporting}
            onClick={() => document.getElementById("clients-import-input")?.click()}
            w={{ base: "full", lg: "auto" }}
          >
            Importar CSV
          </Button>
          <Button
            leftIcon={<FiPlus />}
            onClick={openCreateModal}
            alignSelf={{ base: "stretch", md: "center" }}
            size={{ base: "md", md: "lg" }}
            colorScheme="brand"
            w={{ base: "full", lg: "auto" }}
          >
            Novo cliente
          </Button>
        </Stack>
        <input
          id="clients-import-input"
          type="file"
          accept=".csv"
          style={{ display: "none" }}
          onChange={handleImportCsv}
        />
      </Flex>

      <Flex gap={4} direction={{ base: "column", md: "row" }}>
        <InputGroup maxW={{ base: "full", md: "360px" }}>
          <InputLeftElement pointerEvents="none">
            <FiSearch color="#999" />
          </InputLeftElement>
          <Input
            placeholder="Pesquisar cliente por nome, e-mail ou documento"
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
          />
        </InputGroup>
        <Select
          maxW={{ base: "full", md: "220px" }}
          value={documentTypeFilter}
          onChange={(event) => setDocumentTypeFilter(event.target.value as "ALL" | "CPF" | "CNPJ")}
        >
          <option value="ALL">Todos (CPF e CNPJ)</option>
          <option value="CPF">Apenas CPF</option>
          <option value="CNPJ">Apenas CNPJ</option>
        </Select>
      </Flex>

      <SimpleGrid columns={{ base: 1, md: 2, lg: 4 }} spacing={{ base: 4, md: 6 }}>
        <Box
          bg={sectionBg}
          borderRadius="2xl"
          p={6}
          boxShadow="lg"
          borderWidth={1}
          borderColor={sectionBorder}
          transition="background-color 0.3s ease, transform 0.3s ease"
        >
          <Text color={mutedText}>Total de CPFs</Text>
          <Text fontSize="3xl" fontWeight="bold" color="brand.600">
            {clientMetrics.cpf}
          </Text>
        </Box>
        <Box
          bg={sectionBg}
          borderRadius="2xl"
          p={6}
          boxShadow="lg"
          borderWidth={1}
          borderColor={sectionBorder}
          transition="background-color 0.3s ease, transform 0.3s ease"
        >
          <Text color={mutedText}>Total de CNPJs</Text>
          <Text fontSize="3xl" fontWeight="bold" color="brand.600">
            {clientMetrics.cnpj}
          </Text>
        </Box>
        <Box
          bg={sectionBg}
          borderRadius="2xl"
          p={6}
          boxShadow="lg"
          borderWidth={1}
          borderColor={sectionBorder}
          transition="background-color 0.3s ease, transform 0.3s ease"
        >
          <Text color={mutedText}>Total geral</Text>
          <Text fontSize="3xl" fontWeight="bold" color="brand.600">
            {clientMetrics.total}
          </Text>
        </Box>
        <Box
          bg={sectionBg}
          borderRadius="2xl"
          p={6}
          boxShadow="lg"
          borderWidth={1}
          borderColor={sectionBorder}
          transition="background-color 0.3s ease, transform 0.3s ease"
        >
          <Text color={mutedText}>Cadastros no último mês</Text>
          <Text fontSize="3xl" fontWeight="bold" color="brand.600">
            {clientMetrics.lastMonth}
          </Text>
        </Box>
      </SimpleGrid>

      <Box
        bg={sectionBg}
        borderRadius="2xl"
        p={{ base: 4, md: 6 }}
        boxShadow="lg"
        borderWidth={1}
        borderColor={sectionBorder}
        transition="background-color 0.3s ease, transform 0.3s ease"
      >
        <Box overflowX="auto">
          <Table variant="simple" size={{ base: "sm", md: "md" }}>
            <Thead>
              <Tr>
                <Th>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleSort("name")}
                    rightIcon={getSortIcon("name")}
                  >
                    Cliente
                  </Button>
                </Th>
                <Th>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleSort("document")}
                    rightIcon={getSortIcon("document")}
                  >
                    Documento
                  </Button>
                </Th>
                <Th>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleSort("services")}
                    rightIcon={getSortIcon("services")}
                  >
                    Serviços
                  </Button>
                </Th>
                <Th textAlign="right">Ações</Th>
              </Tr>
            </Thead>
            <Tbody>
              {isLoading && clients.length === 0 &&
                Array.from({ length: 4 }).map((_, index) => (
                  <Tr key={index}>
                    <Td colSpan={4}>
                      <Skeleton height="20px" borderRadius="md" />
                    </Td>
                  </Tr>
                ))}
              {filteredClients.length === 0 && !isLoading && (
                <Tr>
                  <Td colSpan={4}>
                    <Text color={mutedText}>Nenhum cliente encontrado.</Text>
                  </Td>
                </Tr>
              )}
              {filteredClients.map((client) => {
                const assignments = client.tvAssignments ?? [];
                const isTvExpanded = expandedAssignments[client.id] ?? false;
                const visibleAssignments = isTvExpanded ? assignments : assignments.slice(0, 1);
                const hiddenCount = assignments.length - visibleAssignments.length;
                const isExpanded = expandedClientId === client.id;

                return (
                  <Fragment key={client.id}>
                    <Tr>
                      <Td>
                        <Text fontWeight="semibold">{client.name}</Text>
                      </Td>
                      <Td>{client.document}</Td>
                      <Td>
                        <HStack spacing={2} flexWrap="wrap" align="start">
                          {(client.services ?? []).length === 0 ? (
                            <Badge colorScheme="gray">Sem serviços</Badge>
                          ) : (
                            client.services?.map((service) => (
                              <Badge key={service.id} colorScheme="blue">
                                {service.name}
                                {service.customPrice !== null && service.customPrice !== undefined
                                  ? ` · ${currencyFormatter.format(service.customPrice ?? 0)}`
                                  : service.allowCustomPrice
                                    ? " · negociável"
                                    : ""}
                              </Badge>
                            ))
                          )}
                          {assignments.length > 0 && (
                            <>
                              {visibleAssignments.map((assignment) => (
                                <Badge
                                  key={assignment.slotId}
                                  colorScheme={assignment.planType === "PREMIUM" ? "pink" : "teal"}
                                >
                                  {assignment.profileLabel ?? "TV"}
                                </Badge>
                              ))}
                              {assignments.length > 1 && (
                                <Button
                                  size="xs"
                                  variant="ghost"
                                  onClick={() => toggleAssignmentsVisibility(client.id)}
                                >
                                  {hiddenCount > 0 ? `Ver mais (+${hiddenCount})` : "Ver menos"}
                                </Button>
                              )}
                            </>
                          )}
                        </HStack>
                      </Td>
                      <Td textAlign="right">
                        <HStack justify="flex-end" spacing={2}>
                          <IconButton
                            aria-label="Editar"
                            icon={<FiEdit />}
                            variant="ghost"
                            onClick={() => openEditModal(client)}
                          />
                          <IconButton
                            aria-label="Excluir"
                            icon={<FiTrash />}
                            variant="ghost"
                            onClick={() => handleDelete(client)}
                          />
                          <IconButton
                            aria-label={isExpanded ? "Ocultar detalhes" : "Ver detalhes"}
                            icon={isExpanded ? <FiChevronUp /> : <FiChevronDown />}
                            variant="ghost"
                            onClick={() => toggleClientDetails(client.id)}
                          />
                        </HStack>
                      </Td>
                    </Tr>
                    <Tr>
                      <Td colSpan={4} p={0} border="none">
                        <Collapse in={isExpanded} animateOpacity>
                          <Box
                            mt={-1}
                            mb={4}
                            mx={{ base: 2, md: 4 }}
                            p={{ base: 4, md: 6 }}
                            borderWidth={1}
                            borderColor={sectionBorder}
                            borderRadius="lg"
                            bg={sectionBg}
                          >
                            <Stack spacing={4}>
                              <Grid templateColumns={{ base: "repeat(1, minmax(0, 1fr))", md: "repeat(2, minmax(0, 1fr))" }} gap={4}>
                                <Box>
                                  <Text fontWeight="semibold">E-mail</Text>
                                  <Text mt={1}>{client.email || "-"}</Text>
                                </Box>
                                <Box>
                                  <Text fontWeight="semibold">Telefone</Text>
                                  <Text mt={1}>{client.phone || "-"}</Text>
                                </Box>
                                <Box>
                                  <Text fontWeight="semibold">Centro de custo</Text>
                                  {client.costCenter ? (
                                    <Badge mt={1} colorScheme={client.costCenter === "NEXUS" ? "purple" : "green"}>
                                      {client.costCenter === "NEXUS" ? "Nexus" : client.costCenter === "LUXUS" ? "Luxus" : client.costCenter}
                                    </Badge>
                                  ) : (
                                    <Text mt={1}>-</Text>
                                  )}
                                </Box>
                                <Box>
                                  <Text fontWeight="semibold">Empresa</Text>
                                  <Text mt={1}>{client.companyName || "-"}</Text>
                                </Box>
                              </Grid>
                              <Grid templateColumns={{ base: "repeat(1, minmax(0, 1fr))", md: "repeat(2, minmax(0, 1fr))" }} gap={4}>
                                <Box>
                                  <Text fontWeight="semibold">Cidade</Text>
                                  <Text mt={1}>{client.city || "-"}</Text>
                                </Box>
                                <Box>
                                  <Text fontWeight="semibold">Estado</Text>
                                  <Text mt={1}>{client.state || "-"}</Text>
                                </Box>
                              </Grid>
                              <Box>
                                <Text fontWeight="semibold">Observações</Text>
                                <Text mt={1}>{client.notes || "Sem observações"}</Text>
                              </Box>
                              <Box>
                                <Text fontWeight="semibold">Cadastro</Text>
                                <Text mt={1}>{formatDate(client.createdAt)}</Text>
                              </Box>
                              <Box>
                                <Text fontWeight="semibold">Serviços contratados</Text>
                                <Stack mt={2} spacing={2}>
                                  {client.services && client.services.length > 0 ? (
                                    client.services.map((service) => (
                                      <HStack
                                        key={service.id}
                                        spacing={3}
                                        align="center"
                                        borderWidth={1}
                                        borderColor={sectionBorder}
                                        borderRadius="md"
                                        px={3}
                                        py={2}
                                        bg={assignmentDetailBg}
                                      >
                                        <Badge colorScheme="blue">{service.name}</Badge>
                                        {service.customPrice !== null && service.customPrice !== undefined ? (
                                          <Text fontSize="sm" color={mutedText}>
                                            {currencyFormatter.format(service.customPrice ?? 0)}
                                          </Text>
                                        ) : service.allowCustomPrice ? (
                                          <Text fontSize="sm" color={mutedText}>
                                            Negociável
                                          </Text>
                                        ) : null}
                                      </HStack>
                                    ))
                                  ) : (
                                    <Badge colorScheme="gray" alignSelf="flex-start">
                                      Nenhum serviço vinculado
                                    </Badge>
                                  )}
                                  {assignments.length > 0 && (
                                <Stack spacing={2} mt={1}>
                                  <Text fontSize="sm" fontWeight="semibold">
                                    Acessos de TV
                                  </Text>
                                  {assignments.map((assignment) => (
                                        <HStack
                                          key={assignment.slotId}
                                          spacing={3}
                                          align="center"
                                          borderWidth={1}
                                          borderColor={sectionBorder}
                                          borderRadius="md"
                                          px={3}
                                          py={2}
                                          bg={assignmentDetailBg}
                                        >
                                          <Badge colorScheme={assignment.planType === "PREMIUM" ? "pink" : "teal"}>
                                            {assignment.profileLabel ??
                                              (assignment.planType === "PREMIUM" ? "TV Premium" : "TV Essencial")}
                                          </Badge>
                                          <Stack spacing={0}>
                                            <Text fontSize="sm" color={mutedText}>
                                              {assignment.email} • #{assignment.slotNumber}
                                            </Text>
                                            <Text fontSize="xs" color={mutedText}>
                                              ({client.name.split(" ")[0]}{" "}
                                              {assignment.profileLabel?.replace("Perfil", "").trim() ?? "1"})
                                            </Text>
                                            {assignment.soldAt && (
                                              <Text fontSize="xs" color={mutedText}>
                                                Vendido em {new Date(assignment.soldAt).toLocaleDateString("pt-BR")}
                                              </Text>
                                            )}
                                          </Stack>
                                        </HStack>
                                      ))}
                                    </Stack>
                                  )}
                                </Stack>
                              </Box>
                            </Stack>
                          </Box>
                        </Collapse>
                      </Td>
                    </Tr>
                  </Fragment>
                );
              })}
            </Tbody>
          </Table>
        </Box>
      </Box>

      <Flex
        mt={4}
        align={{ base: "stretch", md: "center" }}
        justify="space-between"
        direction={{ base: "column", md: "row" }}
        gap={4}
      >
        <Text color={mutedText}>
          Exibindo {filteredClients.length} de {totalClients} clientes
        </Text>
        <HStack spacing={2}>
          <Button
            variant="outline"
            onClick={handlePreviousPage}
            isDisabled={page === 1 || isLoading || isFetching}
          >
            Anterior
          </Button>
          <Text color={mutedText}>
            Página {totalPages === 0 ? 0 : page} de {totalPages}
          </Text>
          <Button
            variant="outline"
            onClick={handleNextPage}
            isDisabled={page >= totalPages || totalPages === 0 || isLoading || isFetching}
          >
            Próxima
          </Button>
        </HStack>
      </Flex>

      <ClientFormModal
        isOpen={formModal.isOpen}
        onClose={formModal.onClose}
        onSubmit={selectedClient ? handleUpdate : handleCreate}
        defaultValues={selectedClient}
        serviceOptions={services}
      />
    </VStack>
  );
}

