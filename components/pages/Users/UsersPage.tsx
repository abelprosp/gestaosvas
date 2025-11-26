"use client";
import {
  Badge,
  Box,
  Button,
  Collapse,
  Flex,
  FormControl,
  FormLabel,
  Grid,
  Heading,
  HStack,
  Icon,
  IconButton,
  Input,
  Select,
  Spinner,
  Stack,
  Table,
  Tbody,
  Td,
  Text,
  Textarea,
  Th,
  Thead,
  Tooltip,
  Tr,
  useColorModeValue,
  useToast,
  Checkbox,
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalCloseButton,
  ModalBody,
  ModalFooter,
  useDisclosure,
} from "@chakra-ui/react";
import { Fragment, ReactElement, useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  FiAlertCircle,
  FiCheckCircle,
  FiChevronDown,
  FiChevronUp,
  FiClock,
  FiEdit,
  FiKey,
  FiSend,
  FiPhone,
  FiTrash2,
} from "react-icons/fi";
import { fetchTVOverview, regenerateTVSlotPassword, releaseTVSlot, updateTVSlot, updateTVAccountEmail, deleteTVAccount, getNextEmailInfo, listTVAccounts, TVAccountInfo, getTVAccountSlots, TVAccountSlot, fetchTVAccountUsage, deleteTVSlot } from "@/lib/api/tv";
import { PaginatedResponse, TVOverviewRecord, TVSlotStatus } from "@/types";
import { useAuth } from "@/context/AuthContext";
import { createRequest } from "@/lib/api/requests";
import { exportToCsv } from "@/lib/utils/exporters";

const EXPIRATION_COLORS = {
  SAFE: "green.400",
  WARNING: "yellow.400",
  DANGER: "red.400",
};

function diffInDays(value?: string | null) {
  if (!value) return Number.POSITIVE_INFINITY;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return Number.POSITIVE_INFINITY;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(parsed);
  target.setHours(0, 0, 0, 0);
  const diffMs = target.getTime() - today.getTime();
  return Math.floor(diffMs / (1000 * 60 * 60 * 24));
}

function expirationColor(value?: string | null) {
  const diff = diffInDays(value);
  if (diff === Number.POSITIVE_INFINITY) return EXPIRATION_COLORS.SAFE;
  if (diff < 0) return EXPIRATION_COLORS.DANGER;
  if (diff <= 1) return EXPIRATION_COLORS.DANGER;
  if (diff <= 5) return EXPIRATION_COLORS.WARNING;
  return EXPIRATION_COLORS.SAFE;
}

type ExpirationCategory = "EXPIRED" | "EXPIRING" | "SAFE" | "NO_DATE";

function getExpirationCategory(value?: string | null): ExpirationCategory {
  if (!value) return "NO_DATE";
  const diff = diffInDays(value);
  if (diff === Number.POSITIVE_INFINITY) return "NO_DATE";
  if (diff < 0) return "EXPIRED";
  if (diff <= 5) return "EXPIRING";
  return "SAFE";
}

function normalizeDateInput(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const parsed = new Date(trimmed);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }
  return parsed.toISOString().slice(0, 10);
}

function getRenewalSuggestion(current?: string | null): string {
  if (current) {
    const parsed = new Date(current);
    if (!Number.isNaN(parsed.getTime())) {
      parsed.setMonth(parsed.getMonth() + 1);
      return parsed.toISOString().slice(0, 10);
    }
  }
  const future = new Date();
  future.setDate(future.getDate() + 30);
  return future.toISOString().slice(0, 10);
}

function extractEmailStart(email: string): number {
  const match = /^([0-9]+)a/.exec(email);
  if (!match) return Number.MAX_SAFE_INTEGER;
  const value = Number(match[1]);
  return Number.isFinite(value) ? value : Number.MAX_SAFE_INTEGER;
}

function formatDate(value?: string | null) {
  if (!value) return "-";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "-";
  return parsed.toLocaleDateString("pt-BR");
}

function formatDocument(value?: string | null) {
  if (!value) return "-";
  const digits = value.replace(/\D/g, "");
  if (digits.length === 11) {
    return digits.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
  }
  if (digits.length === 14) {
    return digits.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5");
  }
  return value;
}

function normalizeDocumentDigits(value?: string | null) {
  return value ? value.replace(/\D/g, "") : "";
}

const STATUS_LABEL: Record<TVSlotStatus, string> = {
  AVAILABLE: "Disponível",
  ASSIGNED: "Ativo",
  INACTIVE: "Inativo",
  SUSPENDED: "Suspenso",
};

const STATUS_COLOR: Record<TVSlotStatus, string> = {
  AVAILABLE: "gray",
  ASSIGNED: "green",
  INACTIVE: "red",
  SUSPENDED: "orange",
};

export function UsersPage() {
  const { isAdmin } = useAuth();
  const isReadOnly = !isAdmin;
  const toast = useToast();
  const queryClient = useQueryClient();

  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<TVSlotStatus | "ALL">("ALL");
  const [availabilityFilter, setAvailabilityFilter] = useState<"ALL" | "AVAILABLE" | "ASSIGNED">("ALL");
  const [expirationFilter, setExpirationFilter] = useState<ExpirationCategory | "ALL">("ALL");
  const [telephonyFilter, setTelephonyFilter] = useState<boolean>(false);
  const [exportDocument, setExportDocument] = useState("");
  const [pendingSlotId, setPendingSlotId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: "asc" | "desc" } | null>(null);
  const [notesBySlot, setNotesBySlot] = useState<Record<string, string>>({});
  const [pendingNoteId, setPendingNoteId] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const editEmailModal = useDisclosure();
  const [editingAccountId, setEditingAccountId] = useState<string | null>(null);
  const [editingEmail, setEditingEmail] = useState("");
  const [originalEmail, setOriginalEmail] = useState("");
  const [isUpdatingEmail, setIsUpdatingEmail] = useState(false);
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);
  const [accountUsageInfo, setAccountUsageInfo] = useState<{ assignedSlots: number; totalSlots: number } | null>(null);
  const emailsModal = useDisclosure();
  const [accountsList, setAccountsList] = useState<TVAccountInfo[]>([]);
  const [isLoadingAccounts, setIsLoadingAccounts] = useState(false);
  const [expandedAccountId, setExpandedAccountId] = useState<string | null>(null);
  const [accountSlots, setAccountSlots] = useState<Record<string, any[]>>({});
  const [loadingSlots, setLoadingSlots] = useState<Record<string, boolean>>({});
  const limit = 50;
  const hasSearch = searchTerm.trim().length > 0;
  const effectivePage = hasSearch ? 1 : page;
  const effectiveLimit = hasSearch ? 500 : limit;

  const tableBg = useColorModeValue("rgba(255,255,255,0.78)", "rgba(15, 23, 42, 0.7)");
  const borderColor = useColorModeValue("rgba(226,232,240,0.6)", "rgba(45,55,72,0.6)");
  const headerColor = useColorModeValue("gray.600", "gray.300");

  const handleAuthorizationRequest = async (action: string, payload: Record<string, unknown>) => {
    try {
      await createRequest(action, payload);
      toast({
        title: "Solicitação enviada",
        description: "O administrador será notificado.",
        status: "success",
      });
    } catch (error) {
      console.error(error);
      toast({
        title: "Não foi possível registrar a solicitação",
        status: "error",
      });
    }
  };

  const apiSearch = hasSearch ? undefined : searchTerm;
  const { data: overview, isLoading, isFetching } = useQuery<PaginatedResponse<TVOverviewRecord>>({
    queryKey: ["tvOverview", { search: apiSearch ?? "", page: effectivePage, limit: effectiveLimit }],
    queryFn: () => fetchTVOverview({ search: apiSearch, page: effectivePage, limit: effectiveLimit }),
    staleTime: 60 * 1000,
  });

  const { data: nextEmailInfo } = useQuery({
    queryKey: ["tvNextEmail"],
    queryFn: getNextEmailInfo,
    staleTime: 30 * 1000,
    refetchInterval: 60 * 1000, // Atualizar a cada minuto
  });

  // Buscar lista de contas para popular o select de emails padrão
  const { data: accountsListForSelect } = useQuery({
    queryKey: ["tvAccounts"],
    queryFn: listTVAccounts,
    staleTime: 30 * 1000,
  });

  const records = useMemo<TVOverviewRecord[]>(() => overview?.data ?? [], [overview]);
  const totalPages = hasSearch ? 1 : overview?.totalPages ?? 1;
  const totalRecords = overview?.total ?? 0;

  useEffect(() => {
    setPage(1);
  }, [searchTerm]);

  useEffect(() => {
    setNotesBySlot(
      records.reduce<Record<string, string>>((acc: Record<string, string>, record: TVOverviewRecord) => {
        if (record.id) {
          acc[record.id] = record.notes ?? "";
        }
        return acc;
      }, {}),
    );
  }, [records]);
  const handlePreviousPage = () => {
    if (hasSearch) return;
    setPage((current) => Math.max(1, current - 1));
  };

  const handleNextPage = () => {
    if (hasSearch) return;
    setPage((current) => Math.min(totalPages, current + 1));
  };

  const sortedRecords = useMemo(() => {
    return [...records].sort((a, b) => {
      const startA = extractEmailStart(a.email);
      const startB = extractEmailStart(b.email);
      if (startA !== startB) {
        return startA - startB;
      }
      if (a.email !== b.email) {
        return a.email.localeCompare(b.email);
      }
      return a.slotNumber - b.slotNumber;
    });
  }, [records]);

  const mutateErrorMessage = (error: unknown) => {
    if (error && typeof error === "object" && "message" in error) {
      return String((error as { message?: string }).message);
    }
    return "Não foi possível concluir a operação.";
  };

  const regenerateMutation = useMutation({
    mutationFn: (slotId: string) => regenerateTVSlotPassword(slotId),
    onSuccess: () => {
      toast({ title: "Senha regenerada", status: "success" });
      queryClient.invalidateQueries({ queryKey: ["tvOverview"] });
      queryClient.invalidateQueries({ queryKey: ["tvAssignments"] });
    },
    onError: (error: unknown) => {
      toast({
        title: "Erro ao gerar nova senha",
        description: mutateErrorMessage(error),
        status: "error",
      });
    },
    onSettled: () => {
      setPendingSlotId(null);
    },
  });

  const releaseMutation = useMutation({
    mutationFn: (slotId: string) => releaseTVSlot(slotId),
    onSuccess: () => {
      toast({ title: "Acesso removido do cliente", status: "success" });
      queryClient.invalidateQueries({ queryKey: ["tvOverview"] });
      queryClient.invalidateQueries({ queryKey: ["tvAssignments"] });
    },
    onError: (error: unknown) => {
      toast({
        title: "Não foi possível remover o acesso",
        description: mutateErrorMessage(error),
        status: "error",
      });
    },
  });

  interface RenewVariables {
    slotId: string;
    expiresAt: string;
  }

  const renewMutation = useMutation({
    mutationFn: ({ slotId, expiresAt }: RenewVariables) => updateTVSlot(slotId, { expiresAt }),
    onSuccess: () => {
      toast({ title: "Vencimento atualizado", status: "success" });
      queryClient.invalidateQueries({ queryKey: ["tvOverview"] });
      queryClient.invalidateQueries({ queryKey: ["tvAssignments"] });
    },
    onError: (error: unknown) => {
      toast({
        title: "Erro ao renovar acesso",
        description: mutateErrorMessage(error),
        status: "error",
      });
    },
  });

  const passwordMutation = useMutation({
    mutationFn: ({ slotId, password }: { slotId: string; password: string }) =>
      updateTVSlot(slotId, { password }),
    onSuccess: () => {
      toast({ title: "Senha atualizada", status: "success" });
      queryClient.invalidateQueries({ queryKey: ["tvOverview"] });
      queryClient.invalidateQueries({ queryKey: ["tvAssignments"] });
    },
    onError: (error: unknown) => {
      toast({
        title: "Erro ao atualizar senha",
        description: mutateErrorMessage(error),
        status: "error",
      });
    },
  });

  const notesMutation = useMutation({
    mutationFn: ({ slotId, notes }: { slotId: string; notes: string }) => updateTVSlot(slotId, { notes }),
    onSuccess: () => {
      toast({ title: "Comentário salvo", status: "success" });
      queryClient.invalidateQueries({ queryKey: ["tvOverview"] });
      queryClient.invalidateQueries({ queryKey: ["tvAssignments"] });
    },
    onError: (error: unknown) => {
      toast({
        title: "Erro ao salvar comentário",
        description: mutateErrorMessage(error),
        status: "error",
      });
    },
    onSettled: () => {
      setPendingNoteId(null);
    },
  });

  const filteredRecords = useMemo(() => {
    const term = searchTerm.toLowerCase();
    const filtered = sortedRecords.filter((record) => {
      const matchesSearch =
        term.length === 0 ||
        [
          record.email,
          record.username,
          record.client?.name,
          record.soldBy,
          record.notes,
          record.profileLabel,
          record.planType ? (record.planType === "PREMIUM" ? "premium" : "essencial") : undefined,
          record.client?.document,
        ]
          .filter(Boolean)
          .some((value) => value?.toLowerCase().includes(term));

      const matchesStatus = statusFilter === "ALL" || record.status === statusFilter;

      const matchesAvailability =
        availabilityFilter === "ALL"
          ? true
          : availabilityFilter === "AVAILABLE"
          ? record.status === "AVAILABLE"
          : record.status === "ASSIGNED";

      const category = getExpirationCategory(record.expiresAt);

      const matchesExpiration =
        expirationFilter === "ALL"
          ? true
          : expirationFilter === "NO_DATE"
          ? category === "NO_DATE"
          : category === expirationFilter;

      const matchesTelephony = !telephonyFilter || (record as any).hasTelephony === true;

      return matchesSearch && matchesStatus && matchesAvailability && matchesExpiration && matchesTelephony;
    });
    if (!sortConfig) {
      return filtered;
    }
    const sorted = [...filtered].sort((a, b) => {
      const direction = sortConfig.direction === "asc" ? 1 : -1;
      switch (sortConfig.key) {
        case "email":
          return direction * a.email.localeCompare(b.email, "pt-BR", { sensitivity: "base" });
        case "slotNumber":
          return direction * (a.slotNumber - b.slotNumber);
        case "client":
          return direction * ((a.client?.name ?? "").localeCompare(b.client?.name ?? "", "pt-BR", { sensitivity: "base" }));
        case "status":
          return direction * a.status.localeCompare(b.status, "pt-BR", { sensitivity: "base" });
        case "planType":
          return direction * ((a.planType ?? "").localeCompare(b.planType ?? "", "pt-BR", { sensitivity: "base" }));
        case "startsAt": {
          const aDate = a.startsAt ? new Date(a.startsAt).getTime() : 0;
          const bDate = b.startsAt ? new Date(b.startsAt).getTime() : 0;
          return direction * (aDate - bDate);
        }
        case "expiresAt": {
          const aDate = a.expiresAt ? new Date(a.expiresAt).getTime() : 0;
          const bDate = b.expiresAt ? new Date(b.expiresAt).getTime() : 0;
          return direction * (aDate - bDate);
        }
        default:
          return 0;
      }
    });
    return sorted;
  }, [
    availabilityFilter,
    expirationFilter,
    telephonyFilter,
    searchTerm,
    sortConfig,
    sortedRecords,
    statusFilter,
  ]);

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

  const buildExportRows = (dataset: TVOverviewRecord[]) =>
    dataset.map((record) => ({
      Email: record.email,
      Usuario: record.username,
      Slot: record.slotNumber,
      Cliente: record.client?.name ?? "",
      Documento: formatDocument(record.client?.document ?? ""),
      Plano: record.planType ?? "-",
      Status: STATUS_LABEL[record.status],
      Vencimento: formatDate(record.expiresAt),
      Vendedor: record.soldBy ?? "",
      Comentario: record.notes ?? "",
    }));

  const handleExportFiltered = () => {
    if (!filteredRecords.length) {
      toast({ title: "Nenhum registro para exportar", status: "info" });
      return;
    }
    exportToCsv("usuarios_tv_filtrados.csv", buildExportRows(filteredRecords));
    toast({ title: "Exportação iniciada", description: "Arquivo CSV gerado com o filtro atual.", status: "success" });
  };

  const handleExportDocument = () => {
    const digits = exportDocument.replace(/\D/g, "");
    if (!digits) {
      toast({ title: "Informe um CPF ou CNPJ", status: "warning" });
      return;
    }

    const dataset = records.filter(
      (record) => normalizeDocumentDigits(record.client?.document) === digits,
    );

    if (!dataset.length) {
      toast({
        title: "Documento não encontrado",
        description: "Nenhum usuário TV associado ao documento informado.",
        status: "warning",
      });
      return;
    }

    exportToCsv(`usuarios_tv_${digits}.csv`, buildExportRows(dataset));
    toast({ title: "Exportação criada", status: "success" });
  };

  const handleEditEmail = async (accountId: string, currentEmail: string) => {
    if (!isAdmin) return;
    setEditingAccountId(accountId);
    setEditingEmail(currentEmail);
    setOriginalEmail(currentEmail);
    
    // Buscar informações sobre uso da conta
    try {
      const response = await fetch(`/api/tv/accounts`);
      if (response.ok) {
        const accounts = await response.json();
        const accountData = accounts.find((acc: any) => acc.account.id === accountId);
        if (accountData) {
          const slots = accountData.slots || [];
          const assignedSlots = slots.filter((s: any) => s.status === "ASSIGNED" && s.clientId).length;
          const totalSlots = slots.length;
          setAccountUsageInfo({ assignedSlots, totalSlots });
        } else {
          // Fallback: contar dos registros atuais
          const assignedSlots = records.filter(r => r.accountId === accountId && r.status === "ASSIGNED").length;
          setAccountUsageInfo({ assignedSlots, totalSlots: 8 });
        }
      }
    } catch (error) {
      console.error("Erro ao buscar informações da conta:", error);
      // Fallback: contar dos registros atuais
      const assignedSlots = records.filter(r => r.accountId === accountId && r.status === "ASSIGNED").length;
      setAccountUsageInfo({ assignedSlots, totalSlots: 8 });
    }
    
    editEmailModal.onOpen();
  };

  const handleUpdateEmail = async () => {
    if (!editingAccountId || !editingEmail.trim()) {
      toast({ title: "Informe um e-mail válido", status: "warning" });
      return;
    }

    if (editingEmail.trim() === originalEmail) {
      toast({ title: "O e-mail não foi alterado", status: "info" });
      editEmailModal.onClose();
      return;
    }

    setIsUpdatingEmail(true);
    try {
      await updateTVAccountEmail(editingAccountId, editingEmail.trim());
      toast({ title: "E-mail atualizado com sucesso", status: "success" });
      queryClient.invalidateQueries({ queryKey: ["tvOverview"] });
      queryClient.invalidateQueries({ queryKey: ["tvNextEmail"] });
      queryClient.invalidateQueries({ queryKey: ["tvAccounts"] });
      editEmailModal.onClose();
      setEditingAccountId(null);
      setEditingEmail("");
      setOriginalEmail("");
      setAccountUsageInfo(null);
    } catch (error) {
      // Extrair mensagem de erro mais detalhada
      let errorMessage = "Erro ao atualizar e-mail";
      if (error && typeof error === "object") {
        if ("response" in error) {
          const axiosError = error as { response?: { data?: { message?: string } } };
          if (axiosError.response?.data?.message) {
            errorMessage = axiosError.response.data.message;
          }
        } else if ("message" in error && typeof (error as { message?: string }).message === "string") {
          errorMessage = (error as { message: string }).message;
        }
      }
      toast({ 
        title: "Erro ao atualizar e-mail", 
        description: errorMessage, 
        status: "error", 
        duration: 6000,
        isClosable: true
      });
    } finally {
      setIsUpdatingEmail(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (!editingAccountId) return;

    const assignedSlotsCount = accountUsageInfo?.assignedSlots ?? 0;
    const hasAssignedSlots = assignedSlotsCount > 0;
    
    const warningMessage = hasAssignedSlots
      ? `⚠️ ATENÇÃO: Esta conta possui ${assignedSlotsCount} slot(s) atribuído(s) a cliente(s).\n\nAo remover esta conta, todos os ${assignedSlotsCount} slot(s) atribuído(s) serão removidos e os clientes perderão acesso.\n\n`
      : "";

    const confirmed = window.confirm(
      `${warningMessage}Tem certeza que deseja remover a conta de TV "${originalEmail}"?\n\n` +
      "Esta ação não pode ser desfeita. Todos os slots desta conta serão removidos automaticamente."
    );

    if (!confirmed) return;

    setIsDeletingAccount(true);
    try {
      const result = await deleteTVAccount(editingAccountId);
      toast({ 
        title: "Conta removida com sucesso", 
        description: result.slotsRemoved || "A conta e todos os seus slots foram removidos.",
        status: "success",
        duration: 5000,
        isClosable: true
      });
      queryClient.invalidateQueries({ queryKey: ["tvOverview"] });
      queryClient.invalidateQueries({ queryKey: ["tvNextEmail"] });
      queryClient.invalidateQueries({ queryKey: ["tvAccounts"] });
      editEmailModal.onClose();
      setEditingAccountId(null);
      setEditingEmail("");
      setOriginalEmail("");
      setAccountUsageInfo(null);
    } catch (error) {
      // Extrair mensagem de erro mais detalhada
      let errorMessage = "Erro ao remover conta";
      if (error && typeof error === "object") {
        if ("response" in error) {
          const axiosError = error as { response?: { data?: { message?: string } } };
          if (axiosError.response?.data?.message) {
            errorMessage = axiosError.response.data.message;
          }
        } else if ("message" in error && typeof (error as { message?: string }).message === "string") {
          errorMessage = (error as { message: string }).message;
        }
      }
      toast({ 
        title: "Erro ao remover conta", 
        description: errorMessage, 
        status: "error", 
        duration: 6000,
        isClosable: true
      });
    } finally {
      setIsDeletingAccount(false);
    }
  };

  return (
    <Stack spacing={{ base: 6, md: 8 }}>
      <Flex direction={{ base: "column", md: "row" }} justify="space-between" gap={4} align={{ base: "flex-start", md: "center" }}>
        <Box>
          <Heading size="lg">Usuários de TV</Heading>
          <Text color="gray.500">
            Visualize a distribuição de e-mails, usuários e vencimentos dos acessos de TV. Os indicadores sinalizam a proximidade do vencimento.
          </Text>
        </Box>
      </Flex>

      {isAdmin && nextEmailInfo && (
        <HStack spacing={3} flexWrap="wrap">
          <Box p={3} bg={tableBg} borderRadius="md" borderWidth={1} borderColor={borderColor} minW="250px">
            <HStack justify="space-between" mb={2}>
              <Text fontSize="sm" color="gray.500">Próximo email:</Text>
            </HStack>
            <Text fontWeight="semibold" color="brand.500">{nextEmailInfo.nextEmail}</Text>
            <Text fontSize="xs" color="gray.500" mt={1}>
              {nextEmailInfo.availableSlots} acesso(s) livre(s)
            </Text>
          </Box>
          <Box p={3} bg={tableBg} borderRadius="md" borderWidth={1} borderColor={borderColor} minW="280px">
            <HStack justify="space-between" mb={2}>
              <Text fontSize="sm" color="gray.500">Editar email padrão:</Text>
              <Button
                size="xs"
                variant="ghost"
                leftIcon={<FiEdit />}
                onClick={async () => {
                  try {
                    const selectedEmail = (document.getElementById("email-select") as HTMLSelectElement)?.value;
                    if (!selectedEmail) {
                      toast({
                        title: "Selecione um email",
                        description: "Por favor, selecione um email padrão para editar",
                        status: "warning",
                        duration: 3000,
                      });
                      return;
                    }

                    // Buscar o ID da conta do email selecionado
                    let accounts = await listTVAccounts();
                    let selectedAccount = accounts.find(a => a.email === selectedEmail);
                    
                    // Se a conta não existir, criar ela automaticamente
                    if (!selectedAccount) {
                      try {
                        const response = await fetch("/api/tv/accounts", {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ email: selectedEmail }),
                        });
                        
                        if (!response.ok) {
                          const error = await response.json();
                          throw new Error(error.message || "Erro ao criar conta");
                        }
                        
                        const data = await response.json();
                        // Recarregar lista de contas
                        accounts = await listTVAccounts();
                        selectedAccount = accounts.find(a => a.email === selectedEmail);
                        
                        if (!selectedAccount) {
                          throw new Error("Conta criada mas não encontrada na lista");
                        }
                      } catch (createError: any) {
                        toast({
                          title: "Erro ao criar conta",
                          description: createError.message || "Não foi possível criar a conta para editar",
                          status: "error",
                          duration: 5000,
                        });
                        return;
                      }
                    }
                    
                    if (selectedAccount) {
                      setEditingAccountId(selectedAccount.id);
                      setEditingEmail(selectedAccount.email);
                      setOriginalEmail(selectedAccount.email);
                      // Buscar informações de uso
                      try {
                        const usage = await fetchTVAccountUsage(selectedAccount.id);
                        setAccountUsageInfo(usage);
                      } catch (error) {
                        console.error("Erro ao buscar uso da conta:", error);
                        setAccountUsageInfo({ totalSlots: 0, assignedSlots: 0 });
                      }
                      editEmailModal.onOpen();
                    }
                  } catch (error: any) {
                    toast({
                      title: "Erro",
                      description: error.message || "Não foi possível abrir o editor",
                      status: "error",
                      duration: 5000,
                    });
                  }
                }}
              >
                Editar
              </Button>
            </HStack>
            <Select
              id="email-select"
              size="sm"
              defaultValue={nextEmailInfo.nextEmail}
              placeholder="Selecione um email padrão"
            >
              {(() => {
                // Gerar lista de emails padrão (1a8, 9a16, 17a24, etc.)
                const emails: Array<{ email: string; exists: boolean; availableSlots: number }> = [];
                
                // Determinar até onde gerar emails (até o próximo disponível + alguns extras)
                let maxIndex = 10; // Mínimo de 10 emails
                if (nextEmailInfo) {
                  const match = nextEmailInfo.nextEmail.match(/^(\d+)a\d+@nexusrs\.com\.br$/);
                  if (match) {
                    const nextStart = parseInt(match[1]);
                    maxIndex = Math.max(maxIndex, Math.ceil(nextStart / 8) + 3); // Adicionar 3 extras além do próximo
                  }
                }
                
                // Gerar emails padrão
                for (let i = 0; i < maxIndex; i++) {
                  const start = i * 8 + 1;
                  const end = start + 7;
                  const email = `${start}a${end}@nexusrs.com.br`;
                  
                  // Verificar se a conta existe e quantos slots tem disponíveis
                  const account = accountsListForSelect?.find(acc => acc.email === email);
                  emails.push({
                    email,
                    exists: !!account,
                    availableSlots: account?.availableSlots ?? 0,
                  });
                }
                
                return emails.map(({ email, exists, availableSlots }) => (
                  <option key={email} value={email}>
                    {email} {exists ? `(${availableSlots} livres)` : "(não existe)"}
                  </option>
                ));
              })()}
            </Select>
          </Box>
        </HStack>
      )}

      <Stack direction={{ base: "column", md: "row" }} spacing={4}>
        <Button
          colorScheme="blue"
          variant="outline"
          size="sm"
          onClick={async () => {
            emailsModal.onOpen();
            setIsLoadingAccounts(true);
            try {
              const accounts = await listTVAccounts();
              setAccountsList(accounts);
            } catch (error) {
              toast({
                title: "Erro ao carregar emails",
                status: "error",
                duration: 3000,
              });
            } finally {
              setIsLoadingAccounts(false);
            }
          }}
        >
          Ver emails de acesso
        </Button>
        <Input
          placeholder="Buscar por cliente, e-mail, CPF/CNPJ ou anotação"
          value={searchTerm}
          onChange={(event) => setSearchTerm(event.target.value)}
          maxW={{ md: "320px" }}
        />
        <Select
          maxW={{ md: "200px" }}
          value={statusFilter}
          onChange={(event) => setStatusFilter(event.target.value as TVSlotStatus | "ALL")}
        >
          <option value="ALL">Todos os status</option>
          {Object.entries(STATUS_LABEL).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </Select>
        <Select
          maxW={{ md: "200px" }}
          value={availabilityFilter}
          onChange={(event) => setAvailabilityFilter(event.target.value as typeof availabilityFilter)}
        >
          <option value="ALL">Todos</option>
          <option value="AVAILABLE">Somente disponíveis</option>
          <option value="ASSIGNED">Somente atribuídos</option>
        </Select>
        <Select
          maxW={{ md: "220px" }}
          value={expirationFilter}
          onChange={(event) => setExpirationFilter(event.target.value as ExpirationCategory | "ALL")}
        >
          <option value="ALL">Todos os vencimentos</option>
          <option value="EXPIRING">Vencem em até 5 dias</option>
          <option value="EXPIRED">Vencidos</option>
          <option value="SAFE">Mais de 5 dias</option>
          <option value="NO_DATE">Sem data definida</option>
        </Select>
        <Checkbox
          isChecked={telephonyFilter}
          onChange={(event) => setTelephonyFilter(event.target.checked)}
          colorScheme="brand"
          size="md"
        >
          <HStack spacing={2}>
            <Box as={FiPhone} />
            <Text>Apenas com telefonia</Text>
          </HStack>
        </Checkbox>
      </Stack>

      <Stack direction={{ base: "column", md: "row" }} spacing={4} align={{ base: "stretch", md: "flex-end" }}>
        <FormControl maxW={{ md: "260px" }}>
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

      {(isLoading || isFetching) && (
        <HStack spacing={3} color="gray.500">
          <Spinner size="sm" />
          <Text>Atualizando dados...</Text>
        </HStack>
      )}

      <Box
        bg={tableBg}
        borderRadius="2xl"
        p={{ base: 4, md: 6 }}
        borderWidth={1}
        borderColor={borderColor}
        boxShadow="lg"
      >
        <Box overflowX="auto">
          <Table
            size={{ base: "sm", md: "md" }}
            sx={{
              "th, td": {
                px: { base: 3, md: 4 },
                py: { base: 2, md: 3 },
              },
              th: {
                fontWeight: "semibold",
                color: headerColor,
              },
              td: {
                verticalAlign: "top",
              },
            }}
          >
            <Thead>
              <Tr>
                <Th>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleSort("email")}
                    rightIcon={getSortIcon("email")}
                  >
                    Email
                  </Button>
                </Th>
                <Th display={{ base: "none", md: "table-cell" }}>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleSort("slotNumber")}
                    rightIcon={getSortIcon("slotNumber")}
                  >
                    Usuário
                  </Button>
                </Th>
                <Th display={{ base: "none", md: "table-cell" }}>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleSort("planType")}
                    rightIcon={getSortIcon("planType")}
                  >
                    Plano
                  </Button>
                </Th>
                <Th display={{ base: "none", lg: "table-cell" }}>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleSort("client")}
                    rightIcon={getSortIcon("client")}
                  >
                    Cliente
                  </Button>
                </Th>
                <Th>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleSort("status")}
                    rightIcon={getSortIcon("status")}
                  >
                    Status
                  </Button>
                </Th>
                <Th>Senha</Th>
                <Th textAlign="right">Detalhes</Th>
              </Tr>
            </Thead>
            <Tbody>
              {filteredRecords.map((record) => {
                const expirationCategory = getExpirationCategory(record.expiresAt);
                const isExpiringSoon = expirationCategory === "EXPIRING";
                const isExpired = expirationCategory === "EXPIRED";
                const showActions = isExpiringSoon || isExpired;
                const releasing =
                  releaseMutation.isPending && (releaseMutation.variables as string | undefined) === record.id;
                const renewing =
                  renewMutation.isPending &&
                  (renewMutation.variables as RenewVariables | undefined)?.slotId === record.id;
                const isExpanded = expandedId === record.id;
                
                // Verificar condições para exibir botão excluir
                const shouldShowDelete = isAdmin && record.status === "ASSIGNED" && (record.clientId || record.client);

                const handleContact = () => {
                  if (record.client?.email) {
                    const subject = encodeURIComponent("Renovação do acesso de TV");
                    const body = encodeURIComponent(
                      `Olá ${record.client.name},\n\nNotamos que o seu acesso de TV vence em breve. Gostaria de confirmar a renovação?`,
                    );
                    window.open(`mailto:${record.client.email}?subject=${subject}&body=${body}`, "_blank");
                    return;
                  }

                  if (record.client?.phone) {
                    toast({
                      title: "Contato por telefone",
                      description: `Nenhum e-mail cadastrado. Ligue para ${record.client.phone}.`,
                      status: "info",
                    });
                    return;
                  }

                  toast({
                    title: "Contato indisponível",
                    description: "Cliente sem dados de contato cadastrados.",
                    status: "warning",
                  });
                };

                const handleManualPassword = () => {
                  if (!isAdmin) {
                    handleAuthorizationRequest("TV_PASSWORD_MANUAL_REQUEST", { slotId: record.id });
                    return;
                  }
                  if (passwordMutation.isPending) return;
                  const input = window.prompt("Informe a senha (4 dígitos):", record.password ?? "");
                  if (input === null) return;
                  const trimmed = input.trim();
                  if (!/^\d{4}$/.test(trimmed)) {
                    toast({
                      title: "Senha inválida",
                      description: "Digite exatamente 4 dígitos.",
                      status: "error",
                    });
                    return;
                  }
                  passwordMutation.mutate({ slotId: record.id, password: trimmed });
                };

                const handleRenew = () => {
                  if (!isAdmin) {
                    handleAuthorizationRequest("TV_ACCESS_RENEW_REQUEST", {
                      slotId: record.id,
                      currentExpiration: record.expiresAt,
                    });
                    return;
                  }
                  if (renewMutation.isPending) return;
                  const suggested = getRenewalSuggestion(record.expiresAt);
                  const input = window.prompt("Informe a nova data de vencimento (AAAA-MM-DD)", record.expiresAt ?? suggested);
                  if (!input) return;
                  const normalized = normalizeDateInput(input);
                  if (!normalized) {
                    toast({
                      title: "Data inválida",
                      description: "Informe a data no formato AAAA-MM-DD.",
                      status: "warning",
                    });
                    return;
                  }
                  renewMutation.mutate({ slotId: record.id, expiresAt: normalized });
                };

                const handleRemove = () => {
                  if (!isAdmin) {
                    handleAuthorizationRequest("TV_ACCESS_RELEASE_REQUEST", { slotId: record.id });
                    return;
                  }
                  if (releaseMutation.isPending) return;
                  const confirmed = window.confirm("Tem certeza que deseja remover este acesso de TV?");
                  if (!confirmed) return;
                  releaseMutation.mutate(record.id);
                };

                const toggleExpanded = () => {
                  setExpandedId((current) => (current === record.id ? null : record.id));
                };

                return (
                  <Fragment key={record.id}>
                    <Tr>
                      <Td>
                        <HStack spacing={2}>
                        <Text fontWeight="semibold">{record.email}</Text>
                        {isAdmin && record.accountId && (
                          <Tooltip label="Editar e-mail">
                            <IconButton
                              aria-label="Editar e-mail"
                              icon={<FiEdit />}
                              size="xs"
                              variant="ghost"
                              onClick={() => handleEditEmail(record.accountId!, record.email)}
                            />
                          </Tooltip>
                        )}
                        {(record as any).hasTelephony && (
                          <Tooltip label="Cliente com telefonia">
                            <Box as={FiPhone} color="brand.500" />
                          </Tooltip>
                        )}
                      </HStack>
                      </Td>
                      <Td display={{ base: "none", md: "table-cell" }}>
                        <Badge colorScheme="blue">#{record.slotNumber}</Badge>
                      </Td>
                      <Td display={{ base: "none", md: "table-cell" }}>
                        {record.planType ? (
                          <Badge colorScheme={record.planType === "PREMIUM" ? "pink" : "green"}>
                            {record.planType === "PREMIUM" ? "Premium" : "Essencial"}
                          </Badge>
                        ) : (
                          <Badge colorScheme="gray">Não definido</Badge>
                        )}
                      </Td>
                      <Td display={{ base: "none", lg: "table-cell" }}>
                        {record.client ? (
                          <Stack spacing={1}>
                            <Text>{record.client.name}</Text>
                            <Text fontSize="xs" color="gray.500">
                              {record.profileLabel
                                ? `(${record.client.name.split(" ")[0]} ${record.profileLabel.replace("Perfil", "").trim()})`
                                : `(${record.client.name.split(" ")[0]}1)`}
                            </Text>
                            {record.client.email && (
                              <Text fontSize="sm" color="gray.500">
                                {record.client.email}
                              </Text>
                            )}
                            {record.client.phone && (
                              <Text fontSize="sm" color="gray.500">
                                {record.client.phone}
                              </Text>
                            )}
                          </Stack>
                        ) : (
                          <Badge colorScheme="gray">Disponível</Badge>
                        )}
                      </Td>
                      <Td>
                        <Badge colorScheme={STATUS_COLOR[record.status]}>{STATUS_LABEL[record.status]}</Badge>
                      </Td>
                      <Td>
                        <HStack spacing={2} align="center">
                          <Text fontFamily="mono">{record.password}</Text>
                          <Tooltip label="Gerar nova senha">
                            <IconButton
                              aria-label="Gerar nova senha"
                              icon={<FiKey />}
                              size="xs"
                              variant="ghost"
                              isLoading={pendingSlotId === record.id && regenerateMutation.isPending}
                              onClick={() => {
                                if (!isAdmin) {
                                  handleAuthorizationRequest("TV_PASSWORD_REGENERATE_REQUEST", { slotId: record.id });
                                  return;
                                }
                                if (regenerateMutation.isPending) return;
                                const confirmed = window.confirm("Tem certeza que deseja gerar uma nova senha para este acesso?");
                                if (!confirmed) return;
                                setPendingSlotId(record.id);
                                regenerateMutation.mutate(record.id);
                              }}
                              isDisabled={!isAdmin}
                            />
                          </Tooltip>
                          <Tooltip label="Definir manualmente">
                            <IconButton
                              aria-label="Definir senha manualmente"
                              icon={<FiEdit />}
                              size="xs"
                              variant="ghost"
                              onClick={handleManualPassword}
                              isLoading={passwordMutation.isPending}
                              isDisabled={!isAdmin}
                            />
                          </Tooltip>
                          {shouldShowDelete && (
                            <Tooltip label="Excluir acesso">
                              <IconButton
                                aria-label="Excluir acesso"
                                icon={<FiTrash2 />}
                                size="xs"
                                variant="ghost"
                                colorScheme="red"
                                onClick={() => {
                                  if (releaseMutation.isPending) return;
                                  const clientName = record.client?.name || "desconhecido";
                                  const confirmed = window.confirm(
                                    `Tem certeza que deseja excluir este acesso?\n\nIsso removerá o acesso do cliente ${clientName} e liberará o slot.`
                                  );
                                  if (!confirmed) return;
                                  releaseMutation.mutate(record.id);
                                }}
                                isLoading={releasing && (releaseMutation.variables as string | undefined) === record.id}
                              />
                            </Tooltip>
                          )}
                        </HStack>
                      </Td>
                      <Td textAlign="right">
                        <IconButton
                          aria-label={isExpanded ? "Ocultar detalhes" : "Exibir detalhes"}
                          icon={isExpanded ? <FiChevronUp /> : <FiChevronDown />}
                          size="sm"
                          variant="ghost"
                          onClick={toggleExpanded}
                        />
                      </Td>
                    </Tr>
                    <Tr>
                      <Td colSpan={8} p={0} border="none">
                        <Collapse in={isExpanded} animateOpacity>
                          <Box
                            mt={-1}
                            mb={4}
                            mx={{ base: 2, md: 4 }}
                            p={{ base: 4, md: 6 }}
                            borderWidth={1}
                            borderColor={borderColor}
                            borderRadius="lg"
                            bg={tableBg}
                          >
                            <Stack spacing={4}>
                              <Grid templateColumns={{ base: "1fr", md: "repeat(2, minmax(0, 1fr))" }} gap={4}>
                                <Box>
                                  <Text fontWeight="semibold">Cliente</Text>
                                  {record.client ? (
                                    <Stack spacing={1} mt={1}>
                                      <Text>{record.client.name}</Text>
                              {record.profileLabel && (
                                <Text fontSize="xs" color="gray.500">
                                  ({record.client.name.split(" ")[0]} {record.profileLabel.replace("Perfil", "").trim()})
                                </Text>
                              )}
                                      {record.client.email && (
                                        <Text fontSize="sm" color="gray.500">
                                          {record.client.email}
                                        </Text>
                                      )}
                                      {record.client.phone && (
                                        <Text fontSize="sm" color="gray.500">
                                          {record.client.phone}
                                        </Text>
                                      )}
                                    </Stack>
                                  ) : (
                                    <Badge colorScheme="gray" mt={1}>
                                      Disponível
                                    </Badge>
                                  )}
                                </Box>
                                <Box>
                                  <Text fontWeight="semibold">Senha</Text>
                                  <HStack spacing={2} mt={1} align="center">
                                    <Text fontFamily="mono">{record.password}</Text>
                                    <Tooltip label="Gerar nova senha">
                                      <IconButton
                                        aria-label="Gerar nova senha"
                                        icon={<FiKey />}
                                        size="xs"
                                        variant="ghost"
                                        isLoading={pendingSlotId === record.id && regenerateMutation.isPending}
                                        onClick={() => {
                                          if (!isAdmin) {
                                            handleAuthorizationRequest("TV_PASSWORD_REGENERATE_REQUEST", { slotId: record.id });
                                            return;
                                          }
                                          if (regenerateMutation.isPending) return;
                                          const confirmed = window.confirm(
                                            "Tem certeza que deseja gerar uma nova senha para este acesso?",
                                          );
                                          if (!confirmed) return;
                                          setPendingSlotId(record.id);
                                          regenerateMutation.mutate(record.id);
                                        }}
                                        isDisabled={!isAdmin}
                                      />
                                    </Tooltip>
                                  </HStack>
                                </Box>
                              </Grid>

                              <Grid templateColumns={{ base: "1fr", md: "repeat(4, minmax(0, 1fr))" }} gap={4}>
                                <Box>
                                  <Text fontWeight="semibold">Plano</Text>
                                  <Badge
                                    mt={1}
                                    colorScheme={
                                      record.planType === "PREMIUM" ? "pink" : record.planType ? "green" : "gray"
                                    }
                                  >
                                    {record.planType
                                      ? record.planType === "PREMIUM"
                                        ? "Premium"
                                        : "Essencial"
                                      : "Não definido"}
                                  </Badge>
                                </Box>
                                <Box>
                                  <Text fontWeight="semibold">Status</Text>
                                  <Badge mt={1} colorScheme={STATUS_COLOR[record.status]}>
                                    {STATUS_LABEL[record.status]}
                                  </Badge>
                                </Box>
                                <Box>
                                  <Text fontWeight="semibold">Vencimento</Text>
                                  <HStack spacing={2} mt={1}>
                                    <Box boxSize={3} borderRadius="full" bg={expirationColor(record.expiresAt)} />
                                    <Text>{formatDate(record.expiresAt)}</Text>
                                  </HStack>
                                </Box>
                                <Box>
                                  <Text fontWeight="semibold">Vendedor</Text>
                                  <Text mt={1}>{record.soldBy ?? "-"}</Text>
                                </Box>
                              <Box>
                                <Text fontWeight="semibold">Documento</Text>
                                <Text mt={1}>{formatDocument(record.client?.document)}</Text>
                              </Box>
                              </Grid>

                              <Grid templateColumns={{ base: "1fr", md: "repeat(2, minmax(0, 1fr))" }} gap={4}>
                                <Box>
                                  <Text fontWeight="semibold">Início</Text>
                                  <Text mt={1}>{formatDate(record.startsAt)}</Text>
                                </Box>
                                <Box>
                                  <Text fontWeight="semibold">Data da venda</Text>
                                  <Text mt={1}>{formatDate(record.soldAt)}</Text>
                                </Box>
                              </Grid>

                              <Box>
                                <Text fontWeight="semibold">Comentário</Text>
                                <Text mt={1} whiteSpace="pre-wrap">
                                  {notesBySlot[record.id]?.trim()
                                    ? notesBySlot[record.id]
                                    : "Nenhum comentário"}
                                </Text>
                              </Box>

                              <FormControl>
                                <FormLabel>Adicionar ou editar comentário</FormLabel>
                                <Textarea
                                  value={notesBySlot[record.id] ?? ""}
                                  onChange={(event) =>
                                    setNotesBySlot((prev) => ({
                                      ...prev,
                                      [record.id]: event.target.value,
                                    }))
                                  }
                                  placeholder="Escreva aqui o comentário para este acesso"
                                  rows={3}
                                />
                              </FormControl>
                              <Button
                                size="sm"
                                colorScheme="brand"
                                alignSelf="flex-start"
                                onClick={() => {
                                  if (notesMutation.isPending) {
                                    return;
                                  }
                                  setPendingNoteId(record.id);
                                  notesMutation.mutate({
                                    slotId: record.id,
                                    notes: notesBySlot[record.id] ?? "",
                                  });
                                }}
                                isLoading={pendingNoteId === record.id && notesMutation.isPending}
                              >
                                Salvar comentário
                              </Button>

                              {showActions && (
                                <Stack direction={{ base: "column", md: "row" }} spacing={3}>
                                  <Button size="sm" variant="outline" onClick={handleContact}>
                                    Contatar cliente
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    colorScheme="green"
                                    onClick={handleRenew}
                                    isLoading={renewing}
                                    leftIcon={!isAdmin ? <FiSend /> : undefined}
                                  >
                                    {isAdmin ? "Renovar" : "Solicitar renovação"}
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    colorScheme="red"
                                    onClick={handleRemove}
                                    isLoading={releasing}
                                    leftIcon={!isAdmin ? <FiSend /> : undefined}
                                  >
                                    {isAdmin ? "Remover do plano" : "Solicitar remoção"}
                                  </Button>
                                </Stack>
                              )}

                              {isReadOnly && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  leftIcon={<FiSend />}
                                  onClick={() => {
                                    const description = window.prompt("Descreva a alteração desejada para este acesso:");
                                    if (!description) return;
                                    handleAuthorizationRequest("TV_SLOT_CHANGE_REQUEST", {
                                      slotId: record.id,
                                      description,
                                    });
                                  }}
                                >
                                  Solicitar alteração deste acesso
                                </Button>
                              )}
                            </Stack>
                          </Box>
                        </Collapse>
                      </Td>
                    </Tr>
                  </Fragment>
                );
              })}
              {!filteredRecords.length && (
                <Tr>
                  <Td colSpan={8}>
                    <Text textAlign="center" color="gray.500">
                      Nenhum registro encontrado com os filtros atuais.
                    </Text>
                  </Td>
                </Tr>
              )}
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
        <Text color="gray.500">
          Exibindo {filteredRecords.length} {filteredRecords.length === 1 ? "acesso" : "acessos"}
          {hasSearch ? "" : ` de ${totalRecords}`}
        </Text>
        <HStack spacing={2}>
          <Button
            variant="outline"
            onClick={handlePreviousPage}
            isDisabled={hasSearch || page === 1 || isLoading || isFetching}
          >
            Anterior
          </Button>
          <Text color="gray.500">
            Página {hasSearch ? 1 : totalPages === 0 ? 0 : page} de {hasSearch ? 1 : totalPages}
          </Text>
          <Button
            variant="outline"
            onClick={handleNextPage}
            isDisabled={hasSearch || page >= totalPages || totalPages === 0 || isLoading || isFetching}
          >
            Próxima
          </Button>
        </HStack>
      </Flex>

      <Stack direction={{ base: "column", md: "row" }} spacing={6} color="gray.500" align="center">
        <HStack spacing={2}>
          <Icon as={FiCheckCircle} color="green.400" />
          <Text>Vencimento com mais de 5 dias</Text>
        </HStack>
        <HStack spacing={2}>
          <Icon as={FiAlertCircle} color="yellow.400" />
          <Text>Vence em até 5 dias</Text>
        </HStack>
        <HStack spacing={2}>
          <Icon as={FiClock} color="red.400" />
          <Text>Vencido ou vence em 24 horas</Text>
        </HStack>
      </Stack>

      {/* Modal para editar e-mail da conta TV */}
      <Modal isOpen={editEmailModal.isOpen} onClose={editEmailModal.onClose}>
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>Editar e-mail de acesso</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            <FormControl>
              <FormLabel>E-mail</FormLabel>
              <Input
                type="email"
                value={editingEmail}
                onChange={(e) => setEditingEmail(e.target.value)}
                placeholder="exemplo@nexusrs.com.br"
                onKeyPress={(e) => {
                  if (e.key === "Enter" && !isUpdatingEmail) {
                    handleUpdateEmail();
                  }
                }}
              />
              <Text fontSize="sm" color="gray.500" mt={2}>
                Este e-mail será atualizado para todos os slots desta conta
              </Text>
              {accountUsageInfo && (
                <Box mt={4} p={3} bg="gray.50" borderRadius="md" _dark={{ bg: "gray.700" }}>
                  <Text fontSize="sm" fontWeight="semibold" mb={2}>Informações de uso:</Text>
                  <Text fontSize="sm" color={accountUsageInfo.assignedSlots > 0 ? "orange.500" : "green.500"}>
                    {accountUsageInfo.assignedSlots > 0 
                      ? `⚠️ ${accountUsageInfo.assignedSlots} slot(s) atribuído(s) a cliente(s)`
                      : "✓ Nenhum slot atribuído"}
                  </Text>
                  <Text fontSize="xs" color="gray.500" mt={1}>
                    Total de slots na conta: {accountUsageInfo.totalSlots}
                  </Text>
                </Box>
              )}
            </FormControl>
          </ModalBody>
          <ModalFooter>
            <Button 
              colorScheme="red" 
              variant="outline"
              mr="auto"
              onClick={handleDeleteAccount} 
              isLoading={isDeletingAccount}
              isDisabled={isUpdatingEmail || isDeletingAccount}
              leftIcon={<FiTrash2 />}
            >
              Remover conta
            </Button>
            <Button variant="ghost" mr={3} onClick={editEmailModal.onClose} isDisabled={isUpdatingEmail || isDeletingAccount}>
              Cancelar
            </Button>
            <Button 
              colorScheme="blue" 
              onClick={handleUpdateEmail} 
              isLoading={isUpdatingEmail}
              isDisabled={isDeletingAccount}
            >
              Salvar e confirmar
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* Modal de Lista de Emails */}
      <Modal isOpen={emailsModal.isOpen} onClose={emailsModal.onClose} size="4xl" scrollBehavior="inside">
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>Emails de Acesso de TV</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            {isLoadingAccounts ? (
              <Flex justify="center" align="center" py={8}>
                <Spinner size="lg" />
              </Flex>
            ) : accountsList.length === 0 ? (
              <Text color="gray.500" textAlign="center" py={8}>
                Nenhum email cadastrado
              </Text>
            ) : (
              <Stack spacing={4}>
                <Text fontSize="sm" color="gray.500">
                  Total: {accountsList.length} email(s) cadastrado(s)
                </Text>
                <Box overflowX="auto">
                  <Table variant="simple" size="sm" minW="100%">
                  <Thead>
                    <Tr>
                      <Th>Email</Th>
                      <Th isNumeric>Total Slots</Th>
                      <Th isNumeric>Disponíveis</Th>
                      <Th isNumeric>Em Uso</Th>
                      <Th>Status</Th>
                    </Tr>
                  </Thead>
                  <Tbody>
                    {accountsList.map((account) => {
                      const isStandard = /^\d+a\d+@nexusrs\.com\.br$/.test(account.email);
                      const isNextEmail = account.email === nextEmailInfo?.nextEmail;
                      const isFull = account.availableSlots === 0 && account.assignedSlots > 0;
                      const isExpanded = expandedAccountId === account.id;
                      const slots = accountSlots[account.id] ?? [];
                      const isLoading = loadingSlots[account.id] ?? false;
                      
                      return (
                        <Fragment key={account.id}>
                          <Tr 
                            cursor="pointer" 
                            onClick={async () => {
                              if (isExpanded) {
                                setExpandedAccountId(null);
                              } else {
                                setExpandedAccountId(account.id);
                                if (!accountSlots[account.id]) {
                                  setLoadingSlots(prev => ({ ...prev, [account.id]: true }));
                                  try {
                                    const slotsData = await getTVAccountSlots(account.id);
                                    setAccountSlots(prev => ({ ...prev, [account.id]: slotsData }));
                                  } catch (error) {
                                    toast({
                                      title: "Erro ao carregar slots",
                                      status: "error",
                                      duration: 3000,
                                    });
                                  } finally {
                                    setLoadingSlots(prev => ({ ...prev, [account.id]: false }));
                                  }
                                }
                              }
                            }}
                            _hover={{ bg: "gray.50", _dark: { bg: "gray.700" } }}
                          >
                            <Td>
                              <HStack spacing={2}>
                                {isExpanded ? (
                                  <Icon as={FiChevronUp} />
                                ) : (
                                  <Icon as={FiChevronDown} />
                                )}
                                <Text fontWeight={isNextEmail ? "bold" : "normal"} color={isNextEmail ? "brand.500" : undefined}>
                                  {account.email}
                                </Text>
                                {isNextEmail && (
                                  <Badge colorScheme="green" size="sm">Próximo</Badge>
                                )}
                                {!isStandard && (
                                  <Badge colorScheme="purple" size="sm">Personalizado</Badge>
                                )}
                              </HStack>
                            </Td>
                            <Td isNumeric>{account.totalSlots}</Td>
                            <Td isNumeric>
                              <Text color={account.availableSlots > 0 ? "green.500" : "gray.500"}>
                                {account.availableSlots}
                              </Text>
                            </Td>
                            <Td isNumeric>
                              <Text color={account.assignedSlots > 0 ? "orange.500" : "gray.500"}>
                                {account.assignedSlots}
                              </Text>
                            </Td>
                            <Td>
                              {isFull ? (
                                <Badge colorScheme="red">Completo</Badge>
                              ) : account.availableSlots > 0 ? (
                                <Badge colorScheme="green">Disponível</Badge>
                              ) : (
                                <Badge colorScheme="gray">Vazio</Badge>
                              )}
                            </Td>
                          </Tr>
                          {isExpanded && (
                            <Tr>
                              <Td colSpan={5} p={0} bg="gray.50" _dark={{ bg: "gray.800" }}>
                                <Collapse in={isExpanded} animateOpacity>
                                  <Box p={4}>
                                    {isLoading ? (
                                      <Flex justify="center" py={4}>
                                        <Spinner size="sm" />
                                      </Flex>
                                    ) : slots.length === 0 ? (
                                      <Text color="gray.500" textAlign="center" py={4}>
                                        Nenhum slot encontrado
                                      </Text>
                                    ) : (
                                      <Stack spacing={3}>
                                        <Text fontSize="sm" fontWeight="semibold">
                                          Slots desta conta:
                                        </Text>
                                        <Box overflowX="auto">
                                          <Table variant="simple" size="sm" minW="100%">
                                            <Thead>
                                              <Tr>
                                                <Th>Slot</Th>
                                                <Th>Status</Th>
                                                <Th>Cliente</Th>
                                                <Th>Plano</Th>
                                                <Th>Ações</Th>
                                              </Tr>
                                            </Thead>
                                            <Tbody>
                                              {slots.map((slot) => (
                                                <Tr key={slot.id}>
                                                  <Td>#{slot.slotNumber} ({slot.username})</Td>
                                                  <Td>
                                                    <Badge colorScheme={slot.status === "ASSIGNED" ? "green" : "gray"}>
                                                      {slot.status === "ASSIGNED" ? "Em Uso" : "Disponível"}
                                                    </Badge>
                                                  </Td>
                                                  <Td>
                                                    {slot.client ? (
                                                      <Text fontSize="sm">{slot.client.name}</Text>
                                                    ) : (
                                                      <Text fontSize="sm" color="gray.500">-</Text>
                                                    )}
                                                  </Td>
                                                  <Td>
                                                    {slot.planType ? (
                                                      <Badge colorScheme={slot.planType === "PREMIUM" ? "purple" : "blue"}>
                                                        {slot.planType}
                                                      </Badge>
                                                    ) : (
                                                      <Text fontSize="sm" color="gray.500">-</Text>
                                                    )}
                                                  </Td>
                                                  <Td>
                                                    <HStack spacing={2}>
                                                      {slot.status === "ASSIGNED" && slot.clientId ? (
                                                        <Button
                                                          size="xs"
                                                          colorScheme="orange"
                                                          variant="outline"
                                                          onClick={async (e) => {
                                                            e.stopPropagation();
                                                            const confirmed = window.confirm(
                                                              `Liberar slot #${slot.slotNumber} do cliente ${slot.client?.name || "desconhecido"}?`
                                                            );
                                                            if (!confirmed) return;
                                                            
                                                            try {
                                                              await releaseTVSlot(slot.id);
                                                              toast({
                                                                title: "Slot liberado com sucesso",
                                                                status: "success",
                                                                duration: 3000,
                                                              });
                                                              // Recarregar slots
                                                              const slotsData = await getTVAccountSlots(account.id);
                                                              setAccountSlots(prev => ({ ...prev, [account.id]: slotsData }));
                                                              // Atualizar lista de contas
                                                              const accounts = await listTVAccounts();
                                                              setAccountsList(accounts);
                                                              queryClient.invalidateQueries({ queryKey: ["tvOverview"] });
                                                              queryClient.invalidateQueries({ queryKey: ["tvNextEmail"] });
                                                              queryClient.invalidateQueries({ queryKey: ["tvAccounts"] });
                                                            } catch (error: any) {
                                                              toast({
                                                                title: "Erro ao liberar slot",
                                                                description: error?.response?.data?.message || error?.message || "Erro desconhecido",
                                                                status: "error",
                                                                duration: 5000,
                                                              });
                                                            }
                                                          }}
                                                        >
                                                          Liberar
                                                        </Button>
                                                      ) : slot.status === "AVAILABLE" ? (
                                                        <Button
                                                          size="xs"
                                                          colorScheme="red"
                                                          variant="outline"
                                                          onClick={async (e) => {
                                                            e.stopPropagation();
                                                            const confirmed = window.confirm(
                                                              `Tem certeza que deseja remover permanentemente o slot #${slot.slotNumber}?\n\nEsta ação não pode ser desfeita.`
                                                            );
                                                            if (!confirmed) return;
                                                            
                                                            try {
                                                              await deleteTVSlot(slot.id);
                                                              toast({
                                                                title: "Slot removido com sucesso",
                                                                status: "success",
                                                                duration: 3000,
                                                              });
                                                              // Recarregar slots
                                                              const slotsData = await getTVAccountSlots(account.id);
                                                              setAccountSlots(prev => ({ ...prev, [account.id]: slotsData }));
                                                              // Atualizar lista de contas
                                                              const accounts = await listTVAccounts();
                                                              setAccountsList(accounts);
                                                              queryClient.invalidateQueries({ queryKey: ["tvOverview"] });
                                                              queryClient.invalidateQueries({ queryKey: ["tvNextEmail"] });
                                                              queryClient.invalidateQueries({ queryKey: ["tvAccounts"] });
                                                            } catch (error: any) {
                                                              toast({
                                                                title: "Erro ao remover slot",
                                                                description: error?.response?.data?.message || error?.message || "Erro desconhecido",
                                                                status: "error",
                                                                duration: 5000,
                                                              });
                                                            }
                                                          }}
                                                        >
                                                          Remover
                                                        </Button>
                                                      ) : (
                                                        <Text fontSize="xs" color="gray.500">-</Text>
                                                      )}
                                                    </HStack>
                                                  </Td>
                                                </Tr>
                                              ))}
                                            </Tbody>
                                          </Table>
                                        </Box>
                                      </Stack>
                                    )}
                                  </Box>
                                </Collapse>
                              </Td>
                            </Tr>
                          )}
                        </Fragment>
                      );
                    })}
                  </Tbody>
                </Table>
                </Box>
              </Stack>
            )}
          </ModalBody>
          <ModalFooter>
            <Button variant="ghost" onClick={emailsModal.onClose}>
              Fechar
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </Stack>
  );
}

