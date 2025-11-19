import {
  Badge,
  Box,
  Button,
  Checkbox,
  Flex,
  FormControl,
  FormLabel,
  Heading,
  HStack,
  IconButton,
  Input,
  InputGroup,
  InputLeftElement,
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalFooter,
  ModalHeader,
  ModalOverlay,
  Select,
  SimpleGrid,
  Skeleton,
  Table,
  Tbody,
  Td,
  Text,
  Th,
  Thead,
  Tr,
  Textarea,
  useDisclosure,
  useToast,
  VStack,
  useColorModeValue,
  Stack,
} from "@chakra-ui/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { FiCalendar, FiEdit, FiSearch, FiTrash } from "react-icons/fi";
import { CloudAccess, PaginatedResponse } from "../../types";
import { deleteCloudAccess, fetchCloudUsers, updateCloudAccess } from "../../api/cloud";
import { useAuth } from "../../context/AuthContext";
import { exportToCsv } from "../../utils/exporters";

type CloudStatus = "ACTIVE" | "EXPIRING" | "EXPIRED" | "TEST";

const STATUS_LABEL: Record<CloudStatus, string> = {
  ACTIVE: "Ativo",
  EXPIRING: "Vencendo",
  EXPIRED: "Expirado",
  TEST: "Teste",
};

const STATUS_COLOR: Record<CloudStatus, string> = {
  ACTIVE: "green",
  EXPIRING: "orange",
  EXPIRED: "red",
  TEST: "purple",
};

function getStatus(access: CloudAccess): CloudStatus {
  if (access.isTest) {
    return "TEST";
  }
  const expires = new Date(access.expiresAt);
  const diff =
    Math.ceil((expires.getTime() - new Date().setHours(0, 0, 0, 0)) / (1000 * 60 * 60 * 24)) || 0;
  if (diff < 0) {
    return "EXPIRED";
  }
  if (diff <= 5) {
    return "EXPIRING";
  }
  return "ACTIVE";
}

interface CloudUsersPageProps {
  title?: string;
  serviceFilter?: string;
}

export function CloudUsersPage({ title = "Usuários Cloud", serviceFilter }: CloudUsersPageProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<"ALL" | CloudStatus>("ALL");
  const [documentFilter, setDocumentFilter] = useState("");
  const [exportDocument, setExportDocument] = useState("");
  const [page, setPage] = useState(1);
  const limit = 50;
  const toast = useToast();
  const queryClient = useQueryClient();
  const editModal = useDisclosure();
  const [editingAccess, setEditingAccess] = useState<CloudAccess | null>(null);
  const [editValues, setEditValues] = useState({
    expiresAt: "",
    isTest: false,
    notes: "",
  });
  const { isAdmin } = useAuth();
  const mutedText = useColorModeValue("gray.500", "gray.400");
  const cardBg = useColorModeValue("rgba(255,255,255,0.78)", "rgba(15, 23, 42, 0.7)");
  const borderColor = useColorModeValue("rgba(226,232,240,0.6)", "rgba(45,55,72,0.6)");

  const queryKey = useMemo(
    () => ["cloudUsers", { page, search: searchTerm, document: documentFilter, service: serviceFilter }] as const,
    [page, searchTerm, documentFilter, serviceFilter],
  );

  const { data, isLoading } = useQuery<PaginatedResponse<CloudAccess>>({
    queryKey,
    queryFn: async () =>
      fetchCloudUsers({
        page,
        limit,
        ...(searchTerm ? { search: searchTerm } : {}),
        ...(documentFilter ? { document: documentFilter.replace(/\D/g, "") } : {}),
        ...(serviceFilter ? { service: serviceFilter } : {}),
      }),
    placeholderData: (previousData) => previousData,
  });

  const records = useMemo<CloudAccess[]>(() => data?.data ?? [], [data]);
  const filteredRecords = useMemo(() => {
    const scoped =
      statusFilter === "ALL" ? records : records.filter((record) => getStatus(record) === statusFilter);
    const digits = documentFilter.replace(/\D/g, "");
    if (!digits) {
      return scoped;
    }
    return scoped.filter((record) => record.client?.document?.replace(/\D/g, "") === digits);
  }, [records, statusFilter, documentFilter]);

  const totalPages = data?.totalPages ?? 1;
  const total = data?.total ?? 0;

  const updateAccess = useMutation({
    mutationFn: async ({ id, expiresAt, isTest, notes }: { id: string } & typeof editValues) => {
      await updateCloudAccess(id, {
        expiresAt,
        isTest,
        notes,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cloudUsers"] });
      toast({ title: "Acesso atualizado", status: "success" });
    },
  });

  const removeAccess = useMutation({
    mutationFn: async (id: string) => {
      await deleteCloudAccess(id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cloudUsers"] });
      toast({ title: "Acesso removido", status: "success" });
    },
  });

  const openEditModal = (access: CloudAccess) => {
    setEditingAccess(access);
    setEditValues({
      expiresAt: access.expiresAt?.slice(0, 10) ?? "",
      isTest: access.isTest,
      notes: access.notes ?? "",
    });
    editModal.onOpen();
  };

  const handleSave = async () => {
    if (!editingAccess) return;
    if (!editValues.expiresAt) {
      toast({ title: "Informe a data de vencimento", status: "error" });
      return;
    }
    try {
      await updateAccess.mutateAsync({
        id: editingAccess.id,
        ...editValues,
      });
      editModal.onClose();
    } catch (error) {
      console.error(error);
      toast({ title: "Falha ao atualizar acesso", status: "error" });
    }
  };

  const handleDelete = async () => {
    if (!editingAccess) return;
    const confirmation = window.confirm("Tem certeza que deseja remover este acesso?");
    if (!confirmation) {
      return;
    }
    try {
      await removeAccess.mutateAsync(editingAccess.id);
      editModal.onClose();
    } catch (error) {
      console.error(error);
      toast({ title: "Falha ao remover acesso", status: "error" });
    }
  };

  const handlePreviousPage = () => {
    setPage((current) => Math.max(1, current - 1));
  };

  const handleNextPage = () => {
    setPage((current) => Math.min(totalPages, current + 1));
  };

  useEffect(() => {
    setPage(1);
  }, [searchTerm, statusFilter, documentFilter]);

  const buildExportRows = (dataset: CloudAccess[]) =>
    dataset.map((record) => ({
      Cliente: record.client?.name ?? "-",
      Documento: record.client?.document ?? "-",
      Email: record.client?.email ?? "-",
      Servico: record.service?.name ?? "Cloud",
      Identificador: record.service?.name ?? "Cloud",
      Tipo: record.isTest ? "Teste" : "Padrão",
      Vencimento: record.expiresAt,
      Comentario: record.notes ?? "",
    }));

  const handleExportFiltered = () => {
    if (!filteredRecords.length) {
      toast({ title: "Nenhum acesso para exportar", status: "info" });
      return;
    }
    const suffix = serviceFilter ? serviceFilter.toLowerCase().replace(/\s+/g, "_") : "cloud";
    exportToCsv(`usuarios_${suffix}_filtrados.csv`, buildExportRows(filteredRecords));
    toast({ title: "Exportação criada", status: "success" });
  };

  const handleExportDocument = () => {
    const digits = exportDocument.replace(/\D/g, "");
    if (!digits) {
      toast({ title: "Informe um CPF/CNPJ para exportar", status: "warning" });
      return;
    }

    const dataset = records.filter((record) => record.client?.document?.replace(/\D/g, "") === digits);

    if (!dataset.length) {
      toast({ title: "Documento não encontrado", status: "warning" });
      return;
    }

    const suffix = serviceFilter ? serviceFilter.toLowerCase().replace(/\s+/g, "_") : "cloud";
    exportToCsv(`usuarios_${suffix}_${digits}.csv`, buildExportRows(dataset));
    toast({ title: "Relatório do documento exportado", status: "success" });
  };

  return (
    <VStack align="stretch" spacing={{ base: 6, md: 8 }}>
      <Flex
        direction={{ base: "column", md: "row" }}
        align={{ base: "flex-start", md: "center" }}
        justify="space-between"
        gap={{ base: 4, md: 6 }}
        flexWrap="wrap"
      >
        <Box>
          <Heading size="lg">{title}</Heading>
          <Text color={mutedText}>
            {serviceFilter
              ? `Controle de clientes que contrataram ${serviceFilter} e acompanhe os vencimentos.`
              : "Controle de clientes com serviços Cloud e seus vencimentos."}
          </Text>
        </Box>
        <Stack direction={{ base: "column", md: "row" }} spacing={4} w="full">
          <InputGroup maxW={{ base: "full", md: "320px" }}>
            <InputLeftElement pointerEvents="none">
              <FiSearch color="#999" />
            </InputLeftElement>
            <Input
              placeholder="Buscar por nome, e-mail ou documento"
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
            />
          </InputGroup>
        <Input
          maxW={{ base: "full", md: "220px" }}
          placeholder="Filtrar por CPF/CNPJ"
          value={documentFilter}
          onChange={(event) => setDocumentFilter(event.target.value)}
        />
          <Select
            maxW={{ base: "full", md: "220px" }}
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value as typeof statusFilter)}
          >
            <option value="ALL">Todos os status</option>
            <option value="ACTIVE">Ativos</option>
            <option value="EXPIRING">Vencendo (≤5 dias)</option>
            <option value="EXPIRED">Expirados</option>
            <option value="TEST">Testes</option>
          </Select>
        </Stack>
      </Flex>

      <Stack direction={{ base: "column", md: "row" }} spacing={4} align={{ base: "stretch", md: "flex-end" }}>
        <FormControl maxW={{ base: "full", md: "260px" }}>
          <FormLabel fontSize="sm" color="gray.500">
            Documento para relatório
          </FormLabel>
          <Input
            placeholder="CPF ou CNPJ"
            value={exportDocument}
            onChange={(event) => setExportDocument(event.target.value)}
          />
        </FormControl>
        <HStack spacing={3}>
          <Button variant="outline" onClick={handleExportDocument}>
            Exportar documento
          </Button>
          <Button colorScheme="brand" onClick={handleExportFiltered}>
            Exportar filtrados
          </Button>
        </HStack>
      </Stack>

      <Box
        bg={cardBg}
        borderRadius="2xl"
        p={{ base: 4, md: 6 }}
        borderWidth={1}
        borderColor={borderColor}
        boxShadow="lg"
      >
        <Box overflowX="auto">
          <Table variant="simple" size={{ base: "sm", md: "md" }}>
            <Thead>
              <Tr>
                <Th>Cliente</Th>
                <Th>Documento</Th>
                <Th>E-mail</Th>
                <Th>Serviço</Th>
                <Th>Vencimento</Th>
                <Th>Status</Th>
                <Th textAlign="right">Ações</Th>
              </Tr>
            </Thead>
            <Tbody>
              {isLoading &&
                Array.from({ length: 5 }).map((_, index) => (
                  <Tr key={index}>
                    <Td colSpan={6}>
                      <Skeleton height="20px" borderRadius="md" />
                    </Td>
                  </Tr>
                ))}
              {!isLoading && filteredRecords.length === 0 && (
                <Tr>
                  <Td colSpan={6}>
                    <Text color={mutedText}>Nenhum acesso encontrado.</Text>
                  </Td>
                </Tr>
              )}
              {filteredRecords.map((record) => {
                const status = getStatus(record);
                return (
                  <Tr key={record.id}>
                    <Td>
                      <Text fontWeight="semibold">{record.client?.name ?? "—"}</Text>
                    </Td>
                    <Td>{record.client?.document ?? "—"}</Td>
                    <Td>{record.client?.email ?? "—"}</Td>
                    <Td>{record.service?.name ?? "Cloud"}</Td>
                    <Td>
                      <HStack spacing={2}>
                        <FiCalendar />
                        <Text>{record.expiresAt ? record.expiresAt.slice(0, 10) : "—"}</Text>
                      </HStack>
                    </Td>
                    <Td>
                      <Badge colorScheme={STATUS_COLOR[status]}>{STATUS_LABEL[status]}</Badge>
                    </Td>
                    <Td textAlign="right">
                      <IconButton
                        aria-label="Editar acesso"
                        icon={<FiEdit />}
                        variant="ghost"
                        onClick={() => openEditModal(record)}
                      />
                    </Td>
                  </Tr>
                );
              })}
            </Tbody>
          </Table>
        </Box>
        <Flex justify="space-between" align="center" mt={4} direction={{ base: "column", md: "row" }} gap={3}>
          <Text color={mutedText}>
            Página {page} de {totalPages} • {total} acessos
          </Text>
          <HStack>
            <Button onClick={handlePreviousPage} isDisabled={page === 1}>
              Anterior
            </Button>
            <Button onClick={handleNextPage} isDisabled={page === totalPages}>
              Próxima
            </Button>
          </HStack>
        </Flex>
      </Box>

      <Modal isOpen={editModal.isOpen} onClose={editModal.onClose} size="lg">
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>Editar acesso Cloud</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            <SimpleGrid columns={{ base: 1, md: 2 }} spacing={4}>
              <FormControl isRequired>
                <FormLabel>Vencimento</FormLabel>
                <Input
                  type="date"
                  value={editValues.expiresAt}
                  onChange={(event) =>
                    setEditValues((prev) => ({
                      ...prev,
                      expiresAt: event.target.value,
                    }))
                  }
                />
              </FormControl>
              <FormControl>
                <FormLabel>Tipo</FormLabel>
                <Checkbox
                  isChecked={editValues.isTest}
                  onChange={(event) =>
                    setEditValues((prev) => ({
                      ...prev,
                      isTest: event.target.checked,
                    }))
                  }
                >
                  Teste
                </Checkbox>
              </FormControl>
            </SimpleGrid>
            <FormControl mt={4}>
              <FormLabel>Comentário</FormLabel>
              <Textarea
                placeholder="Observações internas"
                value={editValues.notes}
                onChange={(event) =>
                  setEditValues((prev) => ({
                    ...prev,
                    notes: event.target.value,
                  }))
                }
              />
            </FormControl>
          </ModalBody>
          <ModalFooter justifyContent="space-between">
            {isAdmin && (
              <Button
                leftIcon={<FiTrash />}
                variant="outline"
                colorScheme="red"
                onClick={handleDelete}
                isLoading={removeAccess.isPending}
              >
                Remover acesso
              </Button>
            )}
            <HStack>
              <Button onClick={editModal.onClose}>Cancelar</Button>
              <Button colorScheme="brand" onClick={handleSave} isLoading={updateAccess.isPending}>
                Salvar
              </Button>
            </HStack>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </VStack>
  );
}


