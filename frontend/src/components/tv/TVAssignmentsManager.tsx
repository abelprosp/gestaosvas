import {
  Box,
  Button,
  Flex,
  FormControl,
  FormLabel,
  Heading,
  Grid,
  HStack,
  IconButton,
  Input,
  Select,
  Spinner,
  Stack,
  Text,
  Textarea,
  Tooltip,
  useColorModeValue,
  useToast,
  Collapse,
  Badge,
  SimpleGrid,
  GridItem,
} from "@chakra-ui/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { FiClock, FiEdit, FiKey, FiPlus, FiTrash2, FiSend, FiUserPlus } from "react-icons/fi";
import {
  assignMultipleTVSlots,
  assignNextTVSlot,
  fetchClientTVAssignments,
  regenerateTVSlotPassword,
  releaseTVSlot,
  updateTVSlot,
} from "../../api/tv";
import { AssignTVSlotPayload, UpdateTVSlotPayload } from "../../api/tv";
import { ClientTVAssignment, TVPlanType, TVSlotStatus } from "../../types";
import { useAuth } from "../../context/AuthContext";
import { fetchVendors, Vendor } from "../../api/users";
import { createRequest } from "../../api/requests";
import { vendorDisplayName } from "../../utils/vendors";
import { Link as RouterLink } from "react-router-dom";

interface TVAssignmentsManagerProps {
  clientId?: string;
  isTvSelected: boolean;
  isOpen: boolean;
}

const STATUS_OPTIONS: { value: TVSlotStatus; label: string }[] = [
  { value: "ASSIGNED", label: "Ativo" },
  { value: "AVAILABLE", label: "Disponível" },
  { value: "SUSPENDED", label: "Suspenso" },
  { value: "INACTIVE", label: "Inativo" },
];

const PLAN_TYPE_OPTIONS: { value: TVPlanType; label: string }[] = [
  { value: "ESSENCIAL", label: "TV Essencial" },
  { value: "PREMIUM", label: "TV Premium" },
];

type AssignFormState = {
  quantity: string;
  planType: TVPlanType;
  soldBy: string;
  soldAt: string;
  startsAt: string;
  expiresAt: string;
  notes: string;
};

function extractErrorMessage(error: unknown) {
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
}

const DATE_TIME_OPTIONS: Intl.DateTimeFormatOptions = {
  hour: "2-digit",
  minute: "2-digit",
};

function todayISODate() {
  return new Date().toISOString().slice(0, 10);
}

function formatDateTimeLabel(value?: string | null) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return `${date.toLocaleDateString("pt-BR")} ${date.toLocaleTimeString("pt-BR", DATE_TIME_OPTIONS)}`;
}

export function TVAssignmentsManager({ clientId, isTvSelected, isOpen }: TVAssignmentsManagerProps) {
  const toast = useToast();
  const queryClient = useQueryClient();
  const [showHistoryIds, setShowHistoryIds] = useState<Set<string>>(new Set());
  const cardBg = useColorModeValue("rgba(255,255,255,0.78)", "rgba(15, 23, 42, 0.7)");
  const cardBorder = useColorModeValue("rgba(226,232,240,0.6)", "rgba(45,55,72,0.6)");
  const { isAdmin } = useAuth();
  const { data: vendors = [], isLoading: vendorsLoading } = useQuery<Vendor[]>({
    queryKey: ["vendors"],
    queryFn: fetchVendors,
    enabled: isOpen,
  });
  const [assignForm, setAssignForm] = useState<AssignFormState>({
    quantity: "1",
    planType: "ESSENCIAL",
    soldBy: "",
    soldAt: todayISODate(),
    startsAt: todayISODate(),
    expiresAt: "",
    notes: "",
  });
  const vendorOptions = useMemo(() => {
    return vendors
      .map((vendor) => vendorDisplayName(vendor))
      .filter((label): label is string => Boolean(label))
      .map((label) => ({ label }));
  }, [vendors]);
  const isReadOnly = !isAdmin;

  const handleAuthorizationRequest = async (action: string, payload: Record<string, unknown>) => {
    try {
      await createRequest(action, payload);
      toast({
        title: "Solicitação enviada",
        description: "O administrador foi notificado sobre sua solicitação.",
        status: "success",
      });
    } catch (error) {
      console.error(error);
      toast({
        title: "Falha ao enviar solicitação",
        status: "error",
      });
    }
  };

  const { data: assignments = [], isLoading, isFetching } = useQuery<ClientTVAssignment[]>({
    queryKey: ["tvAssignments", clientId],
    enabled: Boolean(clientId) && isTvSelected && isOpen,
    queryFn: () => fetchClientTVAssignments(clientId!),
  });

  const refetchAssignments = () => {
    queryClient.invalidateQueries({ queryKey: ["tvAssignments", clientId] });
    queryClient.invalidateQueries({ queryKey: ["clients"] });
  };

  const assignMutation = useMutation({
    mutationFn: (payload: AssignTVSlotPayload) => assignNextTVSlot(payload),
    onSuccess: () => {
      toast({ title: "Acesso gerado com sucesso", status: "success" });
      setAssignForm((prev) => ({
        ...prev,
        quantity: "1",
        soldAt: prev.soldAt || todayISODate(),
        startsAt: prev.startsAt || todayISODate(),
      }));
      refetchAssignments();
    },
    onError: (error: unknown) => {
      toast({
        title: "Erro ao gerar acesso",
        status: "error",
        description: extractErrorMessage(error),
      });
    },
  });

  const bulkAssignMutation = useMutation({
    mutationFn: (payload: AssignTVSlotPayload & { quantity: number }) => assignMultipleTVSlots(payload),
    onSuccess: (result: ClientTVAssignment[]) => {
      toast({ title: `${result.length} acessos gerados`, status: "success" });
      setAssignForm((prev) => ({
        ...prev,
        quantity: "1",
        soldAt: prev.soldAt || todayISODate(),
        startsAt: prev.startsAt || todayISODate(),
      }));
      refetchAssignments();
    },
    onError: (error: unknown) => {
      toast({
        title: "Erro ao gerar acessos",
        status: "error",
        description: extractErrorMessage(error),
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ slotId, payload }: { slotId: string; payload: UpdateTVSlotPayload }) => updateTVSlot(slotId, payload),
    onSuccess: () => {
      toast({ title: "Dados atualizados", status: "success" });
      refetchAssignments();
    },
    onError: (error: unknown) => {
      toast({
        title: "Erro ao atualizar",
        status: "error",
        description: extractErrorMessage(error),
      });
    },
  });

  const releaseMutation = useMutation({
    mutationFn: (slotId: string) => releaseTVSlot(slotId),
    onSuccess: () => {
      toast({ title: "Acesso liberado", status: "info" });
      refetchAssignments();
    },
    onError: (error: unknown) => {
      toast({
        title: "Erro ao liberar",
        status: "error",
        description: extractErrorMessage(error),
      });
    },
  });

  const regenerateMutation = useMutation({
    mutationFn: (slotId: string) => regenerateTVSlotPassword(slotId),
    onSuccess: () => {
      toast({ title: "Senha regenerada", status: "success" });
      refetchAssignments();
    },
    onError: (error: unknown) => {
      toast({
        title: "Erro ao gerar senha",
        status: "error",
        description: extractErrorMessage(error),
      });
    },
  });

  const handleManualPassword = (assignment: ClientTVAssignment) => {
    if (isReadOnly) {
      handleAuthorizationRequest("TV_PASSWORD_MANUAL_REQUEST", { slotId: assignment.slotId });
      return;
    }
    const current = assignment.password ?? "";
    const input = window.prompt("Informe a senha (4 dígitos):", current);
    if (input === null) {
      return;
    }
    const trimmed = input.trim();
    if (!/^\d{4}$/.test(trimmed)) {
      toast({
        title: "Senha inválida",
        description: "A senha precisa conter exatamente 4 dígitos.",
        status: "error",
      });
      return;
    }
    updateMutation.mutate({
      slotId: assignment.slotId,
      payload: { password: trimmed },
    });
  };

  useEffect(() => {
    if (isOpen) {
      setAssignForm({
        quantity: "1",
        soldBy: "",
        soldAt: todayISODate(),
        startsAt: todayISODate(),
        expiresAt: "",
        notes: "",
        planType: "ESSENCIAL",
      });
    }
  }, [isOpen, clientId]);

  const handleToggleHistory = (slotId: string) => {
    setShowHistoryIds((prev) => {
      const next = new Set(prev);
      if (next.has(slotId)) {
        next.delete(slotId);
      } else {
        next.add(slotId);
      }
      return next;
    });
  };

  const assignedCount = useMemo(
    () => assignments.filter((assignment) => assignment.status === "ASSIGNED").length,
    [assignments],
  );

  if (!isTvSelected) {
    return null;
  }

  if (!clientId) {
    return (
      <Box mt={6}>
        <Heading size="sm" mb={2}>
          Acessos de TV
        </Heading>
        <Text fontSize="sm" color="gray.500">
          Salve o cliente primeiro para gerar e administrar acessos de TV.
        </Text>
      </Box>
    );
  }

  return (
    <Stack spacing={6} mt={6}>
      <Box>
        <Heading size="sm" mb={3}>
          Gerenciar acessos de TV
        </Heading>
        <SimpleGrid
          columns={{ base: 1, md: 2, xl: 4 }}
          spacing={4}
          bg={cardBg}
          borderRadius="xl"
          p={4}
          borderWidth={1}
          borderColor={cardBorder}
        >
          <FormControl>
            <FormLabel>Plano</FormLabel>
            <Select
              value={assignForm.planType}
              onChange={(event) =>
                setAssignForm((prev) => ({ ...prev, planType: event.target.value as TVPlanType }))
              }
              isDisabled={isReadOnly}
            >
              {PLAN_TYPE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
          </FormControl>
          <FormControl>
            <FormLabel>Início</FormLabel>
            <Input
              type="date"
              value={assignForm.startsAt ?? ""}
              onChange={(event) => setAssignForm((prev) => ({ ...prev, startsAt: event.target.value }))}
              isDisabled={isReadOnly}
            />
          </FormControl>
          <FormControl>
            <FormLabel>Vencimento</FormLabel>
            <Input
              type="date"
              value={assignForm.expiresAt ?? ""}
              onChange={(event) => setAssignForm((prev) => ({ ...prev, expiresAt: event.target.value }))}
              isDisabled={isReadOnly}
            />
          </FormControl>
          <FormControl>
            <FormLabel>Observações</FormLabel>
            <Input
              placeholder="Notas adicionais"
              value={assignForm.notes ?? ""}
              onChange={(event) => setAssignForm((prev) => ({ ...prev, notes: event.target.value }))}
              isDisabled={isReadOnly}
            />
          </FormControl>
          <FormControl>
            <FormLabel>Quantidade de acessos</FormLabel>
            <Input
              type="number"
              min={1}
              max={50}
              value={assignForm.quantity}
              onChange={(event) => {
                const digits = event.target.value.replace(/\D/g, "");
                setAssignForm((prev) => ({
                  ...prev,
                  quantity: digits,
                }));
              }}
              isDisabled={isReadOnly}
            />
          </FormControl>
          <GridItem colSpan={{ base: 1, md: 2, xl: 1 }}>
            <FormControl isRequired>
              <FormLabel>Vendedor</FormLabel>
              <Input
                list="tv-assign-vendors"
                placeholder={vendorsLoading ? "Carregando vendedores..." : "Nome do vendedor"}
                value={assignForm.soldBy}
                onChange={(event) => setAssignForm((prev) => ({ ...prev, soldBy: event.target.value }))}
                isDisabled={isReadOnly}
                autoComplete="off"
              />
              <datalist id="tv-assign-vendors">
                {vendorOptions.map((option) => (
                  <option key={option.label} value={option.label} />
                ))}
              </datalist>
              <Stack direction={{ base: "column", md: "row" }} spacing={2} mt={2}>
                {isAdmin ? (
                  <Button
                    size="sm"
                    variant="outline"
                    leftIcon={<FiUserPlus />}
                    as={RouterLink}
                    to="/admin/usuarios"
                  >
                    Cadastrar vendedor
                  </Button>
                ) : (
                  <Button
                    size="sm"
                    variant="outline"
                    leftIcon={<FiSend />}
                    onClick={() => handleAuthorizationRequest("VENDOR_CREATE_REQUEST", { clientId })}
                  >
                    Solicitar novo vendedor
                  </Button>
                )}
              </Stack>
            </FormControl>
          </GridItem>
          <FormControl>
            <FormLabel>Data da venda</FormLabel>
            <Input
              type="date"
              value={assignForm.soldAt ?? ""}
              onChange={(event) => setAssignForm((prev) => ({ ...prev, soldAt: event.target.value }))}
              isDisabled={isReadOnly}
            />
          </FormControl>
        </SimpleGrid>
        <Flex
          mt={4}
          justify={{ base: "stretch", md: "flex-end" }}
          w="full"
        >
          <Button
            leftIcon={<FiPlus />}
            colorScheme="brand"
            isLoading={assignMutation.isPending || bulkAssignMutation.isPending}
            w={{ base: "full", md: "auto" }}
            minW={{ base: "100%", md: "200px" }}
            onClick={async () => {
              const trimmedSoldBy = assignForm.soldBy.trim();
              if (!trimmedSoldBy) {
                toast({
                  title: "Selecione o vendedor",
                  status: "error",
                });
                return;
              }

              if (!assignForm.expiresAt || assignForm.expiresAt.length !== 10) {
                toast({
                  title: "Informe a data de vencimento",
                  description: "Utilize o formato AAAA-MM-DD.",
                  status: "error",
                });
                return;
              }

              const parsedQuantity = assignForm.quantity ? parseInt(assignForm.quantity, 10) : NaN;
              const quantity =
                Number.isFinite(parsedQuantity) && parsedQuantity > 0 ? Math.min(50, parsedQuantity) : null;

              if (!quantity) {
                toast({
                  title: "Informe a quantidade de acessos",
                  status: "error",
                });
                return;
              }

              const payload: AssignTVSlotPayload = {
                clientId,
                soldBy: trimmedSoldBy,
                soldAt: assignForm.soldAt || undefined,
                startsAt: assignForm.startsAt || undefined,
                expiresAt: assignForm.expiresAt || undefined,
                notes: assignForm.notes || undefined,
                planType: assignForm.planType,
              };

              if (isReadOnly) {
                await handleAuthorizationRequest("TV_ACCESS_REQUEST", {
                  ...payload,
                  quantity,
                });
                return;
              }

              if (quantity > 1) {
                bulkAssignMutation.mutate({ ...payload, quantity });
              } else {
                assignMutation.mutate(payload);
              }
            }}
          >
            Gerar novos acessos
          </Button>
        </Flex>
        <Text fontSize="sm" color="gray.500" mt={2}>
          {assignedCount} acesso(s) ativos para este cliente.
        </Text>
      </Box>

      <Stack spacing={4}>
        {(isLoading || isFetching) && (
          <HStack spacing={2} color="gray.500">
            <Spinner size="sm" />
            <Text>Carregando acessos...</Text>
          </HStack>
        )}

        {!isLoading && assignments.length === 0 && (
          <Text fontSize="sm" color="gray.500">
            Nenhum acesso gerado ainda. Utilize o botão acima para criar o primeiro acesso.
          </Text>
        )}

        {assignments.map((assignment) => {
          const isRegeneratingCurrent =
            regenerateMutation.isPending && (regenerateMutation.variables as string | undefined) === assignment.slotId;
          const vendorOptionsForAssignment =
            assignment.soldBy && !vendorOptions.some((option) => option.label === assignment.soldBy)
              ? [...vendorOptions, { label: assignment.soldBy }]
              : vendorOptions;
          return (
            <Box
              key={assignment.slotId}
              borderRadius="xl"
              borderWidth={1}
              borderColor={cardBorder}
              bg={cardBg}
              p={{ base: 4, md: 5 }}
              boxShadow="md"
            >
              <Flex
                direction={{ base: "column", md: "row" }}
                justify="space-between"
                align={{ base: "stretch", md: "center" }}
                gap={4}
              >
                <Box>
                  <Heading size="sm">
                    {assignment.profileLabel ? `${assignment.profileLabel} · ${assignment.email}` : assignment.email}
                  </Heading>
                  <HStack mt={1} spacing={3} flexWrap="wrap">
                    {assignment.profileLabel && <Badge colorScheme="purple">{assignment.profileLabel}</Badge>}
                    <Badge colorScheme="blue">Usuário #{assignment.slotNumber}</Badge>
                    {assignment.planType && (
                      <Badge colorScheme={assignment.planType === "PREMIUM" ? "pink" : "green"}>
                        {assignment.planType === "PREMIUM" ? "Plano Premium" : "Plano Essencial"}
                      </Badge>
                    )}
                    <HStack spacing={2} align="center">
                      <Badge colorScheme="purple" fontFamily="mono">
                        {assignment.password}
                      </Badge>
                      <Tooltip label="Gerar nova senha">
                        <IconButton
                          aria-label="Gerar nova senha"
                          icon={<FiKey />}
                          size="xs"
                          variant="ghost"
                          onClick={() => {
                            if (isReadOnly) {
                              handleAuthorizationRequest("TV_PASSWORD_REGENERATE_REQUEST", { slotId: assignment.slotId });
                              return;
                            }
                            if (regenerateMutation.isPending) return;
                            const confirmed = window.confirm("Deseja gerar uma nova senha para este acesso?");
                            if (!confirmed) return;
                            regenerateMutation.mutate(assignment.slotId);
                          }}
                          isLoading={isRegeneratingCurrent}
                        />
                      </Tooltip>
                        <Tooltip label="Definir senha manualmente">
                          <IconButton
                            aria-label="Definir senha manualmente"
                            icon={<FiEdit />}
                            size="xs"
                            variant="ghost"
                            onClick={() => handleManualPassword(assignment)}
                            isLoading={updateMutation.isPending}
                          />
                        </Tooltip>
                    </HStack>
                    <Badge colorScheme="gray">{assignment.status}</Badge>
                  </HStack>
                    <Text fontSize="xs" color="gray.500">
                      Início: {assignment.startsAt ? new Date(assignment.startsAt).toLocaleDateString("pt-BR") : "—"}
                    </Text>
                </Box>
                <HStack spacing={2}>
                  <Tooltip label="Liberar acesso">
                    <IconButton
                      aria-label="Liberar acesso"
                      icon={<FiTrash2 />}
                      size="sm"
                      colorScheme="red"
                      onClick={() => {
                        if (isReadOnly) {
                          handleAuthorizationRequest("TV_ACCESS_RELEASE_REQUEST", { slotId: assignment.slotId });
                          return;
                        }
                        releaseMutation.mutate(assignment.slotId);
                      }}
                      isLoading={releaseMutation.isPending}
                    />
                  </Tooltip>
                  <Tooltip label="Histórico">
                    <IconButton
                      aria-label="Ver histórico"
                      icon={<FiClock />}
                      size="sm"
                      onClick={() => handleToggleHistory(assignment.slotId)}
                    />
                  </Tooltip>
                </HStack>
              </Flex>

              <Grid templateColumns={{ base: "1fr", md: "repeat(3, minmax(0, 1fr))" }} gap={4} mt={4}>
                <FormControl>
                  <FormLabel>Status</FormLabel>
                  <Select
                    value={assignment.status}
                    onChange={(event) =>
                      updateMutation.mutate({
                        slotId: assignment.slotId,
                        payload: { status: event.target.value as TVSlotStatus },
                      })
                    }
                    isDisabled={isReadOnly}
                  >
                    {STATUS_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </Select>
                </FormControl>
                <FormControl>
                  <FormLabel>Plano</FormLabel>
                  <Select
                    value={assignment.planType ?? ""}
                    onChange={(event) => {
                      const value = event.target.value;
                      updateMutation.mutate({
                        slotId: assignment.slotId,
                        payload: { planType: value ? (value as TVPlanType) : null },
                      });
                    }}
                    isDisabled={isReadOnly}
                  >
                    <option value="">Selecione</option>
                    {PLAN_TYPE_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </Select>
                </FormControl>
                <FormControl>
                  <FormLabel>Vendedor</FormLabel>
                  <Input
                    list={`tv-slot-vendors-${assignment.slotId}`}
                    placeholder={vendorsLoading ? "Carregando..." : "Nome do vendedor"}
                    defaultValue={assignment.soldBy ?? ""}
                    onBlur={(event) =>
                      updateMutation.mutate({
                        slotId: assignment.slotId,
                        payload: { soldBy: event.target.value || null },
                      })
                    }
                    isDisabled={isReadOnly}
                    autoComplete="off"
                  />
                  <datalist id={`tv-slot-vendors-${assignment.slotId}`}>
                    {vendorOptionsForAssignment.map((option) => (
                      <option key={option.label} value={option.label} />
                    ))}
                  </datalist>
                </FormControl>
                <FormControl>
                  <FormLabel>Data da venda</FormLabel>
                  <Input
                    type="date"
                    defaultValue={assignment.soldAt?.slice(0, 10) ?? ""}
                    onBlur={(event) =>
                      updateMutation.mutate({
                        slotId: assignment.slotId,
                        payload: { soldAt: event.target.value || null },
                      })
                    }
                    isDisabled={isReadOnly}
                  />
                </FormControl>
                <FormControl>
                  <FormLabel>Início</FormLabel>
                  <Input
                    type="date"
                    defaultValue={assignment.startsAt?.slice(0, 10) ?? ""}
                    onBlur={(event) =>
                      updateMutation.mutate({
                        slotId: assignment.slotId,
                        payload: { startsAt: event.target.value || null },
                      })
                    }
                    isDisabled={isReadOnly}
                  />
                </FormControl>
                <FormControl>
                  <FormLabel>
                    Vencimento
                    <Tooltip label="Neutro quando não definido">
                      <Box as="span" color="gray.400" cursor="help" ml={2}>
                        <FiClock />
                      </Box>
                    </Tooltip>
                  </FormLabel>
                  <Input
                    type="date"
                    defaultValue={assignment.expiresAt?.slice(0, 10) ?? ""}
                    onBlur={(event) =>
                      updateMutation.mutate({
                        slotId: assignment.slotId,
                        payload: { expiresAt: event.target.value || null },
                      })
                    }
                    isDisabled={isReadOnly}
                  />
                </FormControl>
                <FormControl gridColumn={{ base: "1 / -1", md: "1 / -1" }}>
                  <FormLabel>Observações</FormLabel>
                  <Textarea
                    defaultValue={assignment.notes ?? ""}
                    onBlur={(event) =>
                      updateMutation.mutate({
                        slotId: assignment.slotId,
                        payload: { notes: event.target.value || null },
                      })
                    }
                    placeholder="Histórico ou observações"
                    isDisabled={isReadOnly}
                  />
                </FormControl>
              </Grid>
              {isReadOnly && (
                <Button
                  size="sm"
                  variant="outline"
                  mt={3}
                  leftIcon={<FiSend />}
                  onClick={() => {
                    const description = window.prompt("Descreva a alteração desejada para este acesso:");
                    if (!description) return;
                    handleAuthorizationRequest("TV_SLOT_CHANGE_REQUEST", {
                      slotId: assignment.slotId,
                      description,
                    });
                  }}
                >
                  Solicitar alteração deste acesso
                </Button>
              )}

              <Collapse in={showHistoryIds.has(assignment.slotId)} animateOpacity>
                <Box mt={4} pl={4} borderLeftWidth={1} borderLeftColor={cardBorder}>
                  <Heading size="xs" mb={2}>
                    Histórico de alterações
                  </Heading>
                  <Stack spacing={2}>
                    {assignment.history.length === 0 && (
                      <Text fontSize="sm" color="gray.500">
                        Nenhum registro até o momento.
                      </Text>
                    )}
                    {assignment.history.map((history) => (
                      <HStack key={history.id} spacing={3} align="flex-start">
                        <Text fontSize="xs" color="gray.400" minW="150px">
                          {formatDateTimeLabel(history.createdAt)}
                        </Text>
                        <Text fontSize="sm" fontWeight="medium">
                          {history.action}
                        </Text>
                        <Text fontSize="sm" color="gray.500">
                          {history.metadata ? JSON.stringify(history.metadata) : ""}
                        </Text>
                      </HStack>
                    ))}
                  </Stack>
                </Box>
              </Collapse>
            </Box>
          );
        })}
      </Stack>
    </Stack>
  );
}

