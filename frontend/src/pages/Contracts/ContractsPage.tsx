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
  Select,
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
} from "@chakra-ui/react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { FiEye, FiFilter, FiPlus, FiSearch, FiDownload, FiFilePlus, FiUpload } from "react-icons/fi";
import { api } from "../../api/client";
import { Client, Contract, ContractTemplate, ContractStatus, PaginatedResponse } from "../../types";
import { formatDateTime } from "../../utils/format";
import {
  ContractCreateModal,
  ContractCreateValues,
} from "../../components/forms/ContractCreateModal";
import { ContractPreviewDrawer } from "../../components/forms/ContractPreviewDrawer";
import { exportToCsv, exportToPdf } from "../../utils/exporters";
import Papa from "papaparse";

const statusColor: Record<ContractStatus, string> = {
  DRAFT: "gray",
  SENT: "blue",
  SIGNED: "green",
  CANCELLED: "red",
};

export function ContractsPage() {
  const toast = useToast();
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedContract, setSelectedContract] = useState<Contract | undefined>();
  const createModal = useDisclosure();
  const previewDrawer = useDisclosure();
  const [isImporting, setIsImporting] = useState(false);
  const [page, setPage] = useState(1);
  const limit = 50;
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

  const {
    data: contractsResponse,
    isLoading,
    isFetching,
  } = useQuery<PaginatedResponse<Contract>>({
    queryKey: ["contracts", { page, status: statusFilter || null, search: searchTerm || null, limit }],
    queryFn: async () => {
      const params: Record<string, unknown> = {
        page,
        limit,
      };
      const searchValue = searchTerm.trim();
      if (statusFilter) {
        params.status = statusFilter;
      }
      if (searchValue.length) {
        params.search = searchValue;
      }
      const response = await api.get<PaginatedResponse<Contract>>("/contracts", { params });
      return response.data;
    },
    placeholderData: (previousData) => previousData,
    staleTime: 60 * 1000,
  });

  const { data: clients = [] } = useQuery<Client[]>({
    queryKey: ["clients", "contracts"],
    queryFn: async () => {
      const response = await api.get<PaginatedResponse<Client>>("/clients", {
        params: { page: 1, limit: 500 },
      });
      return response.data.data;
    },
    staleTime: 5 * 60 * 1000,
    placeholderData: [],
  });

  const { data: templates = [] } = useQuery<ContractTemplate[]>({
    queryKey: ["templates"],
    queryFn: async () => {
      const response = await api.get<ContractTemplate[]>("/templates");
      return response.data;
    },
    staleTime: 5 * 60 * 1000,
    placeholderData: [],
  });

  const contracts = useMemo<Contract[]>(() => contractsResponse?.data ?? [], [contractsResponse]);
  const totalContracts = contractsResponse?.total ?? 0;
  const totalPages = contractsResponse?.totalPages ?? 1;
  const statusCounts = useMemo(() => {
    const summary = (contractsResponse?.summary as { statusCounts?: Partial<Record<ContractStatus, number>> }) ?? {};
    const counts = summary.statusCounts ?? {};
    return {
      DRAFT: counts.DRAFT ?? 0,
      SENT: counts.SENT ?? 0,
      SIGNED: counts.SIGNED ?? 0,
      CANCELLED: counts.CANCELLED ?? 0,
    };
  }, [contractsResponse]);
  const trimmedSearch = searchTerm.trim();
  useEffect(() => {
    setPage(1);
  }, [statusFilter, trimmedSearch]);

  const fetchContractsForExport = async (): Promise<Contract[]> => {
    const currentTotal = contractsResponse?.total ?? contracts.length;
    if (!currentTotal) {
      return [];
    }
    if (contracts.length >= currentTotal) {
      return contracts;
    }
    const params: Record<string, unknown> = {
      page: 1,
      limit: Math.max(currentTotal, limit),
    };
    if (statusFilter) {
      params.status = statusFilter;
    }
    if (trimmedSearch.length) {
      params.search = trimmedSearch;
    }
    const response = await api.get<PaginatedResponse<Contract>>("/contracts", { params });
    return response.data.data;
  };

  const handleExportCsv = async () => {
    try {
      const exportData = await fetchContractsForExport();
      if (!exportData.length) {
        toast({ title: "Nenhum contrato para exportar", status: "info" });
        return;
      }

      exportToCsv(
        "contratos.csv",
        exportData.map((contract) => ({
          Titulo: contract.title,
          Cliente: contract.client.name,
          Status: contract.status,
          Atualizado: formatDateTime(contract.updatedAt),
        })),
      );
    } catch (error) {
      console.error(error);
      toast({
        title: "Falha ao exportar",
        status: "error",
        description: extractErrorMessage(error),
      });
    }
  };

  const handleExportPdf = async () => {
    try {
      const exportData = await fetchContractsForExport();
      if (!exportData.length) {
        toast({ title: "Nenhum contrato para exportar", status: "info" });
        return;
      }

      exportToPdf(
        "Relatorio_Contratos",
        ["Título", "Cliente", "Status", "Atualizado"],
        exportData.map((contract) => [
          contract.title,
          contract.client.name,
          contract.status,
          formatDateTime(contract.updatedAt),
        ]),
      );
    } catch (error) {
      console.error(error);
      toast({
        title: "Falha ao exportar",
        status: "error",
        description: extractErrorMessage(error),
      });
    }
  };

  const handleImportCsv = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsImporting(true);
    Papa.parse<Record<string, string>>(file, {
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
            if (!row.title || !row.clientId) continue;
            await api.post("/contracts", {
              title: row.title,
              clientId: row.clientId,
              templateId: row.templateId || undefined,
              contentOverride: row.contentOverride || undefined,
            });
          }
          toast({ title: "Contratos importados", status: "success" });
          queryClient.invalidateQueries({ queryKey: ["contracts"] });
        } catch (error) {
          toast({ title: "Erro ao importar", status: "error", description: extractErrorMessage(error) });
        } finally {
          setIsImporting(false);
          const input = document.getElementById("contracts-import-input") as HTMLInputElement | null;
          if (input) input.value = "";
        }
      },
    });
  };

  const createContract = useMutation({
    mutationFn: async (values: ContractCreateValues) => {
      await api.post("/contracts", values);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["contracts"] });
      queryClient.invalidateQueries({ queryKey: ["stats", "overview"] });
    },
  });

  const sendContract = useMutation({
    mutationFn: async (id: string) => {
      await api.post(`/contracts/${id}/send`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["contracts"] });
    },
  });

  const signContract = useMutation({
    mutationFn: async (id: string) => {
      await api.post(`/contracts/${id}/sign`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["contracts"] });
      queryClient.invalidateQueries({ queryKey: ["stats", "overview"] });
    },
  });

  const cancelContract = useMutation({
    mutationFn: async (id: string) => {
      await api.post(`/contracts/${id}/cancel`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["contracts"] });
    },
  });

  const handleCreate = async (values: ContractCreateValues) => {
    await createContract.mutateAsync(values);
  };

  const handleSend = async () => {
    if (!selectedContract) return;
    try {
      await sendContract.mutateAsync(selectedContract.id);
      toast({ title: "Contrato enviado", status: "success" });
    } catch (error) {
      console.error(error);
      toast({ title: "Falha ao enviar", status: "error", description: extractErrorMessage(error) });
    }
  };

  const handleSign = async () => {
    if (!selectedContract) return;
    try {
      await signContract.mutateAsync(selectedContract.id);
      toast({ title: "Contrato assinado", status: "success" });
    } catch (error) {
      console.error(error);
      toast({
        title: "Falha ao confirmar assinatura",
        status: "error",
        description: extractErrorMessage(error),
      });
    }
  };

  const handleCancel = async () => {
    if (!selectedContract) return;
    try {
      await cancelContract.mutateAsync(selectedContract.id);
      toast({ title: "Contrato cancelado", status: "info" });
    } catch (error) {
      console.error(error);
      toast({ title: "Falha ao cancelar", status: "error", description: extractErrorMessage(error) });
    }
  };

  const openPreview = (contract: Contract) => {
    setSelectedContract(contract);
    previewDrawer.onOpen();
  };

  const sectionBg = useColorModeValue("rgba(255,255,255,0.78)", "rgba(15, 23, 42, 0.7)");
  const sectionBorder = useColorModeValue("rgba(226,232,240,0.6)", "rgba(45,55,72,0.6)");
  const mutedText = useColorModeValue("gray.500", "gray.400");

  return (
    <VStack align="stretch" spacing={{ base: 6, md: 8 }}>
      <Flex
        direction={{ base: "column", md: "row" }}
        align={{ base: "flex-start", md: "center" }}
        justify="space-between"
        gap={{ base: 4, md: 6 }}
      >
        <Box>
          <Heading size="lg">Contratos</Heading>
          <Text color={mutedText}>
            Automatize o ciclo completo de criação, envio e assinatura.
          </Text>
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
            onClick={() => document.getElementById("contracts-import-input")?.click()}
            w={{ base: "full", lg: "auto" }}
          >
            Importar CSV
          </Button>
          <Button
            leftIcon={<FiPlus />}
            onClick={createModal.onOpen}
            alignSelf={{ base: "stretch", md: "center" }}
            size={{ base: "md", md: "lg" }}
            colorScheme="brand"
            w={{ base: "full", lg: "auto" }}
          >
            Novo contrato
          </Button>
        </Stack>
        <input
          id="contracts-import-input"
          type="file"
          accept=".csv"
          style={{ display: "none" }}
          onChange={handleImportCsv}
        />
      </Flex>

      <SimpleGrid columns={{ base: 1, md: 3 }} spacing={{ base: 4, md: 6 }}>
        <Box
          bg={sectionBg}
          borderRadius="2xl"
          p={6}
          boxShadow="lg"
          borderWidth={1}
          borderColor={sectionBorder}
          transition="background-color 0.3s ease, transform 0.3s ease"
        >
          <Text color={mutedText}>Em rascunho</Text>
          <Text fontSize="3xl" fontWeight="bold" color="brand.600">
            {statusCounts.DRAFT}
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
          <Text color={mutedText}>Enviados</Text>
          <Text fontSize="3xl" fontWeight="bold" color="brand.600">
            {statusCounts.SENT}
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
          <Text color={mutedText}>Assinados</Text>
          <Text fontSize="3xl" fontWeight="bold" color="brand.600">
            {statusCounts.SIGNED}
          </Text>
        </Box>
      </SimpleGrid>

      <Flex gap={4} wrap="wrap" align="center">
        <InputGroup maxW={{ base: "full", md: "320px" }}>
          <InputLeftElement pointerEvents="none">
            <FiSearch color="#999" />
          </InputLeftElement>
          <Input
            placeholder="Buscar por título ou cliente"
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
          />
        </InputGroup>
        <HStack spacing={3}>
          <FiFilter color="#999" />
          <Select
            placeholder="Status"
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value)}
            maxW="200px"
          >
            <option value="DRAFT">Rascunho</option>
            <option value="SENT">Enviado</option>
            <option value="SIGNED">Assinado</option>
            <option value="CANCELLED">Cancelado</option>
          </Select>
        </HStack>
      </Flex>

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
          <Table size={{ base: "sm", md: "md" }}>
            <Thead>
              <Tr>
                <Th>Contrato</Th>
                <Th>Cliente</Th>
                <Th>Status</Th>
                <Th>Atualizado</Th>
                <Th textAlign="right">Ações</Th>
              </Tr>
            </Thead>
            <Tbody>
              {isLoading && contracts.length === 0
                ? Array.from({ length: 4 }).map((_, index) => (
                    <Tr key={index}>
                      <Td colSpan={5}>
                        <Skeleton height="20px" borderRadius="md" />
                      </Td>
                    </Tr>
                  ))
                : null}
              {contracts.length === 0 && !isLoading && !isFetching ? (
                <Tr>
                  <Td colSpan={5}>
                    <Text color={mutedText}>Nenhum contrato encontrado.</Text>
                  </Td>
                </Tr>
              ) : null}
              {contracts.map((contract) => (
                <Tr key={contract.id}>
                  <Td>
                    <VStack align="start" spacing={0.5}>
                      <Text fontWeight="semibold">{contract.title}</Text>
                      {contract.template && (
                        <Badge colorScheme="purple">{contract.template.name}</Badge>
                      )}
                    </VStack>
                  </Td>
                  <Td>
                    <Text fontWeight="medium">{contract.client.name}</Text>
                    <Text fontSize="sm" color="gray.500">
                      {contract.client.document}
                    </Text>
                  </Td>
                  <Td>
                    <Badge colorScheme={statusColor[contract.status]} borderRadius="full" px={3} py={1}>
                      {contract.status}
                    </Badge>
                  </Td>
                  <Td>{formatDateTime(contract.updatedAt)}</Td>
                  <Td textAlign="right">
                    <IconButton
                      aria-label="Visualizar"
                      icon={<FiEye />}
                      variant="ghost"
                      onClick={() => openPreview(contract)}
                    />
                  </Td>
                </Tr>
              ))}
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
          Exibindo {contracts.length} {contracts.length === 1 ? "contrato" : "contratos"}
          {totalContracts ? ` de ${totalContracts}` : ""}
        </Text>
        <HStack spacing={2}>
          <Button
            variant="outline"
            onClick={() => setPage((current) => Math.max(1, current - 1))}
            isDisabled={page === 1 || isLoading || isFetching}
          >
            Anterior
          </Button>
          <Text color={mutedText}>
            Página {totalPages === 0 ? 0 : page} de {Math.max(totalPages, 1)}
          </Text>
          <Button
            variant="outline"
            onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
            isDisabled={page >= totalPages || totalPages === 0 || isLoading || isFetching}
          >
            Próxima
          </Button>
        </HStack>
      </Flex>

      <ContractCreateModal
        isOpen={createModal.isOpen}
        onClose={createModal.onClose}
        clients={clients}
        templates={templates}
        onCreate={handleCreate}
      />

      <ContractPreviewDrawer
        isOpen={previewDrawer.isOpen}
        onClose={previewDrawer.onClose}
        contract={selectedContract}
        onSend={handleSend}
        onSign={handleSign}
        onCancel={handleCancel}
      />
    </VStack>
  );
}

