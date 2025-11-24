"use client";
import {
  Box,
  Button,
  Checkbox,
  CheckboxGroup,
  FormControl,
  FormHelperText,
  FormLabel,
  Grid,
  GridItem,
  Input,
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalFooter,
  ModalHeader,
  ModalOverlay,
  Select,
  SimpleGrid,
  Stack,
  Text,
  Textarea,
  useColorModeValue,
  useToast,
} from "@chakra-ui/react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { Client, Service, TVPlanType } from "@/types";
import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/context/AuthContext";
import { fetchVendors, Vendor } from "@/lib/api/users";
import { createRequest } from "@/lib/api/requests";
import { vendorDisplayName } from "@/lib/utils/vendors";
import Link from "next/link";
import { FiUserPlus, FiSend } from "react-icons/fi";
import { TVAssignmentsManager } from "@/components/tv/TVAssignmentsManager";
import { lookupCompanyByCnpj } from "@/lib/api/client";

const CLOUD_SERVICE_KEYWORDS = ["cloud", "hub", "hubplay", "telemedicina"];

export interface ClientFormValues {
  name: string;
  email: string;
  phone?: string;
  document: string;
  costCenter: "LUXUS" | "NEXUS";
  companyName?: string;
  notes?: string;
  address?: string;
  city?: string;
  zipCode?: string; // CEP
  state?: string;
  serviceIds?: string[];
  openedBy?: string; // Vendedor que abriu o cliente
  serviceSelections?: Array<{
    serviceId: string;
    customPrice?: number | null;
    soldBy?: string; // Vendedor específico para este serviço
  }>;
  tvSetup?: {
    quantity?: number;
    planType?: TVPlanType;
    soldBy?: string;
    soldAt?: string;
    startsAt?: string;
    expiresAt?: string;
    notes?: string;
    hasTelephony?: boolean;
  };
  cloudSetups?: Array<{
    serviceId: string;
    expiresAt: string;
    isTest?: boolean;
    notes?: string;
    soldBy?: string; // Vendedor específico para este serviço Cloud
  }>;
}

interface ClientFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (values: ClientFormValues) => Promise<void>;
  defaultValues?: Client;
  serviceOptions: Service[];
  mode?: "basic" | "full"; // "basic" = apenas informações, "full" = com serviços
}

const currencyFormatter = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

function parsePriceInput(value: string | undefined): number | null | undefined {
  if (value === undefined) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  const normalized = trimmed.replace(/\s/g, "").replace(/\./g, "").replace(",", ".");
  const parsed = Number(normalized);
  if (Number.isNaN(parsed)) {
    return undefined;
  }
  return parsed;
}

function todayISODate() {
  return new Date().toISOString().slice(0, 10);
}

type TvSetupState = {
  quantity: string;
  planType: TVPlanType;
  soldBy: string;
  soldAt: string;
  startsAt: string;
  expiresAt: string;
  notes: string;
  hasTelephony: boolean;
};

function buildInitialTvSetup(): TvSetupState {
  return {
    quantity: "1",
    planType: "ESSENCIAL" as TVPlanType,
    soldBy: "",
    soldAt: todayISODate(),
    startsAt: todayISODate(),
    expiresAt: "",
    notes: "",
    hasTelephony: false,
  };
}

type CloudSetupState = {
  expiresAt: string;
  isTest: boolean;
  notes: string;
};

function buildInitialCloudSetup(): CloudSetupState {
  return {
    expiresAt: "",
    isTest: false,
    notes: "",
  };
}

function normalizeDocumentInput(value: string | undefined): string {
  return (value ?? "").replace(/\D/g, "");
}

function formatPhoneInput(value: string): string {
  const digits = value.replace(/\D/g, "");
  if (digits.length <= 10) {
    // Telefone fixo: (11) 3456-7890
    if (digits.length <= 2) return digits;
    if (digits.length <= 6) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  } else {
    // Celular: (11) 98765-4321
    if (digits.length <= 2) return digits;
    if (digits.length <= 7) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7, 11)}`;
  }
}

function detectDocumentType(value: string | undefined): "CPF" | "CNPJ" | "UNKNOWN" {
  const digits = normalizeDocumentInput(value);
  if (digits.length === 11) return "CPF";
  if (digits.length === 14) return "CNPJ";
  return "UNKNOWN";
}

export function ClientFormModal({
  isOpen,
  onClose,
  onSubmit,
  defaultValues,
  serviceOptions,
  mode = "full",
}: ClientFormModalProps) {
  const toast = useToast();
  const { isAdmin } = useAuth();
  const { data: vendors = [], isLoading: vendorsLoading } = useQuery<Vendor[]>({
    queryKey: ["vendors"],
    queryFn: fetchVendors,
    enabled: isOpen,
  });
  const cardBg = useColorModeValue("rgba(255,255,255,0.78)", "rgba(15, 23, 42, 0.7)");
  const cardBorder = useColorModeValue("rgba(226,232,240,0.6)", "rgba(45,55,72,0.6)");
  const cloudItemBg = useColorModeValue("whiteAlpha.700", "blackAlpha.300");
  const formDefaults: ClientFormValues = useMemo(
    () => ({
      name: defaultValues?.name ?? "",
      email: defaultValues?.email ?? "",
      phone: defaultValues?.phone ?? "",
      document: defaultValues?.document ?? "",
      costCenter: defaultValues?.costCenter ?? "LUXUS",
      companyName: defaultValues?.companyName ?? "",
      address: defaultValues?.address ?? "",
      city: defaultValues?.city ?? "",
      zipCode: defaultValues?.zipCode ?? "",
      state: defaultValues?.state ?? "",
      notes: defaultValues?.notes ?? "",
      openedBy: defaultValues?.openedBy ?? "",
      serviceIds: defaultValues?.services?.map((service) => service.id) ?? [],
    }),
    [
      defaultValues?.address,
      defaultValues?.city,
      defaultValues?.companyName,
      defaultValues?.costCenter,
      defaultValues?.document,
      defaultValues?.email,
      defaultValues?.name,
      defaultValues?.notes,
      defaultValues?.phone,
      defaultValues?.services,
      defaultValues?.state,
    ],
  );

  const initialCustomPrices = useMemo(() => {
    const map: Record<string, string> = {};
    defaultValues?.services?.forEach((service) => {
      if (service.customPrice !== undefined && service.customPrice !== null) {
        map[service.id] = service.customPrice.toFixed(2).replace(".", ",");
      }
    });
    return map;
  }, [defaultValues]);

  const {
    register,
    handleSubmit,
    reset,
    control,
    setValue,
    getValues,
    formState: { isSubmitting },
  } = useForm<ClientFormValues>({
    defaultValues: formDefaults,
  });

  const [customPrices, setCustomPrices] = useState<Record<string, string>>(initialCustomPrices);
  
  // Estado para vendedores por serviço
  const initialServiceVendors = useMemo(() => {
    const map: Record<string, string> = {};
    defaultValues?.services?.forEach((service) => {
      // TODO: Quando implementar vendedor por serviço no backend, pegar de serviceSelections
      map[service.id] = "";
    });
    return map;
  }, [defaultValues]);
  const [serviceVendors, setServiceVendors] = useState<Record<string, string>>(initialServiceVendors);

  const selectedServiceIds = useWatch({
    control,
    name: "serviceIds",
  });

  const [tvSetup, setTvSetup] = useState<TvSetupState>(buildInitialTvSetup());
  const [cloudSetups, setCloudSetups] = useState<Record<string, CloudSetupState>>({});
  const [isFetchingCnpj, setIsFetchingCnpj] = useState(false);

  const vendorOptions = useMemo(() => {
    return vendors
      .map((vendor) => vendorDisplayName(vendor))
      .filter((label): label is string => Boolean(label))
      .map((label) => ({ label }));
  }, [vendors]);

  const existingClientId = defaultValues?.id;

  const documentValue = useWatch({
    control,
    name: "document",
  });
  const documentType = useMemo(() => detectDocumentType(documentValue), [documentValue]);
  const handleCnpjLookup = async () => {
    const rawDocument = getValues("document");
    const normalizedDocument = normalizeDocumentInput(rawDocument);
    if (normalizedDocument.length !== 14) {
      toast({
        title: "Informe um CNPJ válido",
        description: "Use 14 dígitos para consultar automaticamente os dados.",
        status: "warning",
      });
      return;
    }

    setIsFetchingCnpj(true);
    try {
      const data = await lookupCompanyByCnpj(normalizedDocument);
      setValue("document", normalizedDocument, { shouldDirty: true });

      const fillIfEmpty = <K extends keyof ClientFormValues>(field: K, value?: string | null) => {
        const sanitized = value?.trim();
        if (!sanitized) {
          return;
        }
        const currentValue = getValues(field);
        if (typeof currentValue === "string") {
          if (currentValue.trim().length > 0) {
            return;
          }
        } else if (currentValue !== undefined && currentValue !== null) {
          return;
        }
        setValue(field as keyof ClientFormValues, sanitized as ClientFormValues[K], { shouldDirty: true });
      };

      fillIfEmpty("name", data.name ?? data.tradeName ?? data.companyName ?? null);
      fillIfEmpty("companyName", data.companyName ?? data.tradeName ?? null);
      fillIfEmpty("address", data.address ?? null);
      fillIfEmpty("city", data.city ?? null);
      // Mapeia postalCode para zipCode
      fillIfEmpty("zipCode", data.postalCode ?? null);
      fillIfEmpty("state", data.state ?? null);
      fillIfEmpty("phone", data.phone ?? null);
      fillIfEmpty("email", data.email ?? null);

      toast({
        title: "Dados encontrados",
        description: "Revise as informações preenchidas automaticamente.",
        status: "success",
      });
    } catch (error) {
      const message =
        (error as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        (error as Error)?.message ??
        "Não foi possível consultar o CNPJ no momento.";
      toast({
        title: "Consulta não realizada",
        description: message,
        status: "error",
      });
    } finally {
      setIsFetchingCnpj(false);
    }
  };

  useEffect(() => {
    if (!Array.isArray(selectedServiceIds)) {
      setCustomPrices({});
      return;
    }

    setCustomPrices((prev) => {
      const next: Record<string, string> = {};
      selectedServiceIds.forEach((serviceId) => {
        const service = serviceOptions.find((option) => option.id === serviceId);
        if (!service?.allowCustomPrice) {
          return;
        }

        if (prev[serviceId] !== undefined) {
          next[serviceId] = prev[serviceId];
        } else if (initialCustomPrices[serviceId] !== undefined) {
          next[serviceId] = initialCustomPrices[serviceId];
        } else {
          next[serviceId] = "";
        }
      });

      const sameKeys =
        Object.keys(next).length === Object.keys(prev).length &&
        Object.keys(next).every((key) => prev[key] === next[key]);

      return sameKeys ? prev : next;
    });
  }, [selectedServiceIds, serviceOptions, initialCustomPrices]);

  const tvServices = useMemo(
    () =>
      serviceOptions.filter((service) => {
        const name = service.name.toLowerCase();
        return name.includes("tv");
      }),
    [serviceOptions],
  );

  const isTvSelected = tvServices.length
    ? Array.isArray(selectedServiceIds) &&
      selectedServiceIds.some((serviceId) => tvServices.some((service) => service.id === serviceId))
    : false;

  const cloudServices = useMemo(
    () =>
      serviceOptions.filter((service) =>
        CLOUD_SERVICE_KEYWORDS.some((keyword) => service.name.toLowerCase().includes(keyword)),
      ),
    [serviceOptions],
  );

  const selectedCloudServiceIds = useMemo(() => {
    if (!Array.isArray(selectedServiceIds)) {
      return [];
    }
    return selectedServiceIds.filter((serviceId) => cloudServices.some((service) => service.id === serviceId));
  }, [selectedServiceIds, cloudServices]);
  const isCloudSelected = selectedCloudServiceIds.length > 0;

  useEffect(() => {
    reset(formDefaults);
  }, [formDefaults, reset]);

  useEffect(() => {
    setCustomPrices(initialCustomPrices);
  }, [initialCustomPrices, isOpen]);

  useEffect(() => {
    if (isOpen && !defaultValues) {
      setTvSetup(buildInitialTvSetup());
    }
  }, [isOpen, defaultValues]);

useEffect(() => {
  if (!isOpen) {
    return;
  }
  const map: Record<string, CloudSetupState> = {};
  defaultValues?.cloudAccesses?.forEach((access) => {
    if (!access.serviceId) {
      return;
    }
    map[access.serviceId] = {
      expiresAt: access.expiresAt ? access.expiresAt.slice(0, 10) : "",
      isTest: access.isTest ?? false,
      notes: access.notes ?? "",
    };
  });
  setCloudSetups(map);
}, [defaultValues?.cloudAccesses, isOpen]);

useEffect(() => {
  setCloudSetups((prev) => {
    const next: Record<string, CloudSetupState> = { ...prev };
    selectedCloudServiceIds.forEach((serviceId) => {
      if (!next[serviceId]) {
        next[serviceId] = buildInitialCloudSetup();
      }
    });
    Object.keys(next).forEach((serviceId) => {
      if (!selectedCloudServiceIds.includes(serviceId)) {
        delete next[serviceId];
      }
    });
    return next;
  });
}, [selectedCloudServiceIds]);

  const handleClose = () => {
    reset(formDefaults);
    setTvSetup(buildInitialTvSetup());
    setCloudSetups({});
    onClose();
  };

  const onSubmitInternal = async (values: ClientFormValues) => {
    try {
      const normalizedDocument = normalizeDocumentInput(values.document);
      if (normalizedDocument.length !== 11 && normalizedDocument.length !== 14) {
        toast({
          title: "Documento inválido",
          description: "Informe um CPF (11 dígitos) ou CNPJ (14 dígitos).",
          status: "error",
        });
        return;
      }
      values.document = normalizedDocument;

      // No modo básico ao editar, não envia serviços (mantém os existentes)
      // No modo básico ao criar, não envia serviços (cria sem serviços)
      const isBasicMode = mode === "basic";
      const isEditing = !!defaultValues;
      
      // Se estiver editando no modo básico, não envia serviceIds para manter os existentes
      const serviceIds = isBasicMode && isEditing ? undefined : (values.serviceIds ?? []);
      // Serviços são opcionais - o cliente pode ser cadastrado sem serviços selecionados

      let invalidServiceName: string | null = null;
      const serviceSelections = (isBasicMode && isEditing) 
        ? undefined 
        : (isBasicMode 
          ? [] 
          : (serviceIds ?? []).map((serviceId) => {
              const service = serviceOptions.find((option) => option.id === serviceId);
              const soldBy = serviceVendors[serviceId]?.trim() || undefined;
              
              if (!service) {
                return { serviceId, customPrice: null, soldBy };
              }

              if (!service.allowCustomPrice) {
                return { serviceId, customPrice: null, soldBy };
              }

              const parseResult = parsePriceInput(customPrices[serviceId]);
              if (parseResult === undefined) {
                invalidServiceName = service.name;
                return { serviceId, customPrice: null, soldBy };
              }

              return {
                serviceId,
                customPrice: parseResult,
                soldBy,
              };
            }));

      if (invalidServiceName) {
        toast({
          title: "Valor inválido",
          description: `Informe um valor numérico válido para ${invalidServiceName}. Utilize vírgula para centavos.`,
          status: "error",
        });
        return;
      }

      let tvSetupPayload: ClientFormValues["tvSetup"] | undefined;
      
      // No modo básico, não envia configurações de TV/Cloud
      if (mode === "basic") {
        tvSetupPayload = undefined;
      } else {
        const parsedQuantity = tvSetup.quantity ? parseInt(tvSetup.quantity, 10) : NaN;
        const quantity =
          Number.isFinite(parsedQuantity) && parsedQuantity > 0 ? Math.min(50, parsedQuantity) : 1;
        
        // TV Setup é opcional - só inclui se todos os campos obrigatórios estiverem preenchidos
        if (!defaultValues && isTvSelected) {
        const hasSoldBy = tvSetup.soldBy && tvSetup.soldBy.trim();
        
        // Validar data de vencimento - aceita DD/MM/YYYY ou YYYY-MM-DD
        const expiresAtTrimmed = tvSetup.expiresAt ? tvSetup.expiresAt.trim() : "";
        let hasExpiresAt = false;
        let expiresAtFormatted = expiresAtTrimmed;
        
        if (expiresAtTrimmed) {
          // Aceitar DD/MM/YYYY (10 caracteres)
          if (expiresAtTrimmed.length === 10 && expiresAtTrimmed.includes("/")) {
            const parts = expiresAtTrimmed.split("/");
            if (parts.length === 3 && parts[0].length === 2 && parts[1].length === 2 && parts[2].length === 4) {
              hasExpiresAt = true;
              expiresAtFormatted = expiresAtTrimmed; // Será convertido no backend
            }
          }
          // Aceitar YYYY-MM-DD (10 caracteres)
          else if (expiresAtTrimmed.length === 10 && expiresAtTrimmed.includes("-")) {
            const parts = expiresAtTrimmed.split("-");
            if (parts.length === 3 && parts[0].length === 4 && parts[1].length === 2 && parts[2].length === 2) {
              hasExpiresAt = true;
              expiresAtFormatted = expiresAtTrimmed;
            }
          }
        }
        
        // Log para debug
        console.log("[ClientFormModal] Validação TV Setup:", {
          hasSoldBy,
          expiresAtOriginal: expiresAtTrimmed,
          expiresAtFormatted,
          hasExpiresAt,
          willSend: hasSoldBy && hasExpiresAt,
        });
        
        // Se o usuário selecionou TV mas não preencheu os campos, simplesmente não inclui o tvSetup
        // O cliente será criado sem acessos de TV configurados, mas pode adicionar depois
        if (hasSoldBy && hasExpiresAt) {
          tvSetupPayload = {
            quantity,
            planType: tvSetup.planType,
            soldBy: tvSetup.soldBy.trim(),
            soldAt: tvSetup.soldAt || undefined,
            startsAt: tvSetup.startsAt || undefined,
            expiresAt: expiresAtFormatted,
            notes: tvSetup.notes?.trim() || undefined,
            hasTelephony: tvSetup.hasTelephony || undefined,
          };
          console.log("[ClientFormModal] ✅ tvSetup será enviado:", tvSetupPayload);
        } else {
          console.warn("[ClientFormModal] ⚠️ tvSetup não será enviado - campos não preenchidos:", {
            hasSoldBy,
            hasExpiresAt,
            expiresAtOriginal: expiresAtTrimmed,
          });
        }
        // Se não tiver todos os campos, não inclui o tvSetup (não bloqueia a criação do cliente)
      }
      }

      let cloudSetupsPayload: ClientFormValues["cloudSetups"];
      if (mode === "basic") {
        cloudSetupsPayload = undefined;
      } else if (selectedCloudServiceIds.length) {
        const setups: NonNullable<ClientFormValues["cloudSetups"]> = [];
        // Apenas inclui serviços Cloud que tiverem vencimento preenchido
        // Serviços selecionados sem vencimento não serão adicionados, mas não bloqueiam a criação
        for (const serviceId of selectedCloudServiceIds) {
          const config = cloudSetups[serviceId];
          if (config && config.expiresAt && config.expiresAt.trim().length === 10) {
            setups.push({
              serviceId,
              expiresAt: config.expiresAt,
              isTest: config.isTest,
              notes: config.notes?.trim() || undefined,
            });
          }
          // Se não tiver vencimento, simplesmente não inclui este serviço (não bloqueia a criação)
        }
        cloudSetupsPayload = setups.length > 0 ? setups : undefined;
      }

      // No modo básico ao editar, não envia serviços (mantém os existentes)
      // No modo básico ao criar, cria sem serviços
      if (isBasicMode && isEditing) {
        // Ao editar no modo básico, não envia serviceIds para manter os existentes
        // Criar objeto sem serviceIds, serviceSelections, tvSetup, cloudSetups
        const { serviceIds: _, serviceSelections: __, tvSetup: ___, cloudSetups: ____, ...basicData } = values;
        await onSubmit({
          ...basicData,
          openedBy: values.openedBy?.trim() || undefined,
          // Não envia serviceIds, serviceSelections, tvSetup, cloudSetups
          // O backend manterá os existentes quando esses campos não forem fornecidos
        });
      } else if (isBasicMode) {
        // Ao criar no modo básico, cria sem serviços
        await onSubmit({
          ...values,
          openedBy: values.openedBy?.trim() || undefined,
          serviceIds: [],
          serviceSelections: [],
          tvSetup: undefined,
          cloudSetups: undefined,
        });
      } else {
        // MANTER serviços mesmo se campos obrigatórios não estiverem preenchidos
      // O serviço será salvo, apenas sem acessos/configurações especiais
      // Isso permite que o cliente tenha o serviço cadastrado e possa configurar depois
      const finalServiceIds = [...serviceIds];
      // NÃO remove TV dos serviços - se selecionou, deve ser salvo
      // Apenas não cria acessos se campos não estiverem preenchidos
      
      // NÃO remove Cloud dos serviços - se selecionou, deve ser salvo
      // Apenas não cria acessos se campos não estiverem preenchidos
      
        // Ajusta serviceSelections para corresponder aos serviceIds (mantém todos)
        const finalServiceSelections = serviceSelections.filter((selection) =>
          finalServiceIds.includes(selection.serviceId)
        );

        await onSubmit({
          ...values,
          openedBy: values.openedBy?.trim() || undefined,
          serviceIds: finalServiceIds,
          serviceSelections: finalServiceSelections,
          tvSetup: tvSetupPayload,
          cloudSetups: cloudSetupsPayload,
        });
      }
      toast({
        title: defaultValues ? "Cliente atualizado" : "Cliente cadastrado",
        status: "success",
        duration: 3000,
        isClosable: true,
      });
      handleClose();
    } catch (error) {
      console.error("Erro ao salvar cliente:", error);
      
      // Extrair mensagem de erro mais detalhada
      let errorMessage = "Erro ao salvar cliente";
      if (error && typeof error === "object") {
        if ("response" in error) {
          const axiosError = error as { response?: { data?: { message?: string; details?: unknown } } };
          if (axiosError.response?.data?.message) {
            errorMessage = axiosError.response.data.message;
          } else if (axiosError.response?.data?.details) {
            errorMessage = typeof axiosError.response.data.details === "string"
              ? axiosError.response.data.details
              : JSON.stringify(axiosError.response.data.details);
          }
        } else if ("message" in error && typeof (error as { message?: string }).message === "string") {
          errorMessage = (error as { message: string }).message;
        }
      }
      
      toast({
        title: "Erro ao salvar cliente",
        description: errorMessage,
        status: "error",
        duration: 10000,
        isClosable: true,
      });
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} size="3xl">
      <ModalOverlay />
      <ModalContent>
        <ModalHeader>
          {defaultValues ? "Editar cliente" : "Cadastrar novo cliente"}
        </ModalHeader>
        <ModalCloseButton />
        <form onSubmit={handleSubmit(onSubmitInternal)}>
          <ModalBody>
            <Grid templateColumns={{ base: "1fr", md: "1fr 1fr" }} gap={4}>
              <GridItem>
                <FormControl isRequired>
                  <FormLabel>Nome completo</FormLabel>
                  <Input placeholder="Ex: Ana Souza" {...register("name", { required: true })} />
                </FormControl>
              </GridItem>
              <GridItem>
                <FormControl isRequired>
                  <FormLabel>E-mail</FormLabel>
                  <Input
                    type="email"
                    placeholder="ana@empresa.com"
                    {...register("email", { required: true })}
                  />
                </FormControl>
              </GridItem>
              <GridItem>
                <FormControl>
                  <FormLabel>Telefone</FormLabel>
                  <Input
                    placeholder="(11) 98888-7777"
                    {...register("phone")}
                    onChange={(e) => {
                      const formatted = formatPhoneInput(e.target.value);
                      setValue("phone", formatted, { shouldDirty: true });
                    }}
                  />
                </FormControl>
              </GridItem>
              <GridItem>
                <FormControl isRequired>
                  <FormLabel>Documento (CPF/CNPJ)</FormLabel>
                  <Stack direction={{ base: "column", sm: "row" }} spacing={2}>
                    <Input placeholder="000.000.000-00" {...register("document", { required: true })} />
                    <Button
                      variant="outline"
                      onClick={handleCnpjLookup}
                      isDisabled={documentType !== "CNPJ"}
                      isLoading={isFetchingCnpj}
                      whiteSpace="nowrap"
                      flexShrink={0}
                    >
                      Buscar CNPJ
                    </Button>
                  </Stack>
                  <FormHelperText color={documentType === "UNKNOWN" ? "orange.400" : "gray.500"}>
                    {documentType === "UNKNOWN"
                      ? "Informe um CPF (11 dígitos) ou CNPJ (14 dígitos)."
                      : `Documento detectado como ${documentType}.`}
                  </FormHelperText>
                </FormControl>
              </GridItem>
              <GridItem>
                <FormControl isRequired>
                  <FormLabel>Centro de custo</FormLabel>
                  <Select {...register("costCenter", { required: true })}>
                    <option value="LUXUS">LUXUS</option>
                    <option value="NEXUS">NEXUS</option>
                  </Select>
                </FormControl>
              </GridItem>
              <GridItem>
                <FormControl>
                  <FormLabel>Vendedor que abriu o cliente</FormLabel>
                  <Input
                    list="client-form-opened-by-vendors"
                    placeholder={vendorsLoading ? "Carregando vendedores..." : "Nome do vendedor"}
                    {...register("openedBy")}
                    autoComplete="off"
                  />
                  <datalist id="client-form-opened-by-vendors">
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
                        as={Link}
                        href="/admin/usuarios"
                      >
                        Cadastrar vendedor
                      </Button>
                    ) : (
                      <Button
                        size="sm"
                        variant="outline"
                        leftIcon={<FiSend />}
                        onClick={async () => {
                          const description = window.prompt(
                            "Descreva o vendedor que deseja cadastrar (nome, e-mail, observações).",
                          );
                          if (!description) {
                            return;
                          }
                          try {
                            await createRequest("VENDOR_CREATE_REQUEST", {
                              description,
                              clientId: existingClientId ?? null,
                            });
                            toast({
                              title: "Solicitação enviada",
                              description: "O administrador foi notificado sobre sua solicitação.",
                              status: "success",
                            });
                          } catch (error) {
                            console.error(error);
                            toast({
                              title: "Falha ao solicitar cadastro",
                              status: "error",
                            });
                          }
                        }}
                      >
                        Solicitar novo vendedor
                      </Button>
                    )}
                  </Stack>
                  <FormHelperText fontSize="xs" color="gray.500">
                    Vendedor responsável por abrir/obter este cliente
                  </FormHelperText>
                </FormControl>
              </GridItem>
              <GridItem>
                <FormControl>
                  <FormLabel>Empresa</FormLabel>
                  <Input placeholder="Razão social" {...register("companyName")} />
                </FormControl>
              </GridItem>
              <GridItem>
                <FormControl>
                  <FormLabel>Endereço</FormLabel>
                  <Input placeholder="Rua, número" {...register("address")} />
                </FormControl>
              </GridItem>
              <GridItem>
                <FormControl>
                  <FormLabel>Cidade</FormLabel>
                  <Input placeholder="São Paulo" {...register("city")} />
                </FormControl>
              </GridItem>
              <GridItem>
                <FormControl>
                  <FormLabel>CEP</FormLabel>
                  <Input
                    placeholder="00000-000"
                    maxLength={9}
                    {...register("zipCode", {
                      onChange: (e) => {
                        const value = e.target.value.replace(/\D/g, "");
                        if (value.length <= 8) {
                          const formatted = value.replace(/(\d{5})(\d{3})/, "$1-$2");
                          e.target.value = formatted;
                        }
                      },
                    })}
                  />
                </FormControl>
              </GridItem>
              <GridItem>
                <FormControl>
                  <FormLabel>Estado</FormLabel>
                  <Input placeholder="SP" maxLength={2} {...register("state")} />
                </FormControl>
              </GridItem>
              <GridItem colSpan={{ base: 1, md: 2 }}>
                <FormControl>
                  <FormLabel>Observações</FormLabel>
                  <Textarea placeholder="Notas adicionais" rows={3} {...register("notes")} />
                </FormControl>
              </GridItem>
              {mode === "full" && (
              <GridItem colSpan={{ base: 1, md: 2 }}>
                <FormControl>
                  <FormLabel>Serviços contratados</FormLabel>
                  {serviceOptions.length === 0 ? (
                    <Text fontSize="sm" color="gray.500">
                      Nenhum serviço cadastrado ainda. Utilize a aba Serviços para adicionar opções.
                    </Text>
                  ) : (
                    <Controller
                      name="serviceIds"
                      control={control}
                      render={({ field }) => (
                        <CheckboxGroup
                          value={field.value ?? []}
                          onChange={(value) => {
                            field.onChange(value);
                          }}
                        >
                          <Stack spacing={2}>
                            {serviceOptions.map((service) => {
                              const isSelected =
                                Array.isArray(field.value) && field.value.includes(service.id);
                              const customPriceValue = customPrices[service.id] ?? "";

                              return (
                                <Box key={service.id}>
                                  <Checkbox value={service.id}>
                                    <Text fontWeight="semibold">{service.name}</Text>
                                  </Checkbox>
                                  <Box pl={6} mt={1}>
                                    <Text fontSize="sm" color="gray.500">
                                      {currencyFormatter.format(service.price ?? 0)}
                                      {service.allowCustomPrice ? " · Valor negociável" : ""}
                                      {service.description ? ` · ${service.description}` : ""}
                                    </Text>
                                    {service.allowCustomPrice && (
                                      <Stack spacing={1} mt={2}>
                                        <FormHelperText m={0} color="gray.500" fontSize="xs">
                                          Informe o valor negociado (opcional)
                                        </FormHelperText>
                                        <Input
                                          size="sm"
                                          value={customPriceValue}
                                          placeholder="0,00"
                                          onMouseDown={(event) => event.stopPropagation()}
                                          onClick={(event) => event.stopPropagation()}
                                          onFocus={(event) => event.stopPropagation()}
                                          onChange={(event) =>
                                            setCustomPrices((prev) => ({
                                              ...prev,
                                              [service.id]: event.target.value,
                                            }))
                                          }
                                          isDisabled={!isSelected}
                                        />
                                      </Stack>
                                    )}
                                    {isSelected && (
                                      <Stack spacing={1} mt={2}>
                                        <FormHelperText m={0} color="gray.500" fontSize="xs">
                                          Vendedor específico para este serviço (opcional)
                                        </FormHelperText>
                                        <Input
                                          size="sm"
                                          list={`client-form-service-vendor-${service.id}`}
                                          placeholder={vendorsLoading ? "Carregando..." : "Nome do vendedor"}
                                          value={serviceVendors[service.id] ?? ""}
                                          onMouseDown={(event) => event.stopPropagation()}
                                          onClick={(event) => event.stopPropagation()}
                                          onFocus={(event) => event.stopPropagation()}
                                          onChange={(event) =>
                                            setServiceVendors((prev) => ({
                                              ...prev,
                                              [service.id]: event.target.value,
                                            }))
                                          }
                                          autoComplete="off"
                                        />
                                        <datalist id={`client-form-service-vendor-${service.id}`}>
                                          {vendorOptions.map((option) => (
                                            <option key={option.label} value={option.label} />
                                          ))}
                                        </datalist>
                                      </Stack>
                                    )}
                                  </Box>
                                </Box>
                              );
                            })}
                          </Stack>
                        </CheckboxGroup>
                      )}
                    />
                  )}
                </FormControl>
              </GridItem>
              )}
            </Grid>
            {mode === "full" && isTvSelected && !defaultValues && (
              <Box
                mt={6}
                p={4}
                borderWidth={1}
                borderRadius="xl"
                borderColor={cardBorder}
                bg={cardBg}
              >
                <Text fontWeight="semibold" mb={3} color="brand.500">
                  ⚡ Configuração Inicial de TV (Acesso será gerado automaticamente)
                </Text>
                <SimpleGrid columns={{ base: 1, md: 2, xl: 3 }} spacing={4}>
                  <FormControl>
                    <FormLabel>Plano</FormLabel>
                    <Select
                      value={tvSetup.planType}
                      onChange={(event) =>
                        setTvSetup((prev) => ({
                          ...prev,
                          planType: event.target.value as TVPlanType,
                        }))
                      }
                    >
                      <option value="ESSENCIAL">TV Essencial</option>
                      <option value="PREMIUM">TV Premium</option>
                    </Select>
                  </FormControl>
                  <FormControl>
                    <FormLabel>Telefonia</FormLabel>
                    <Checkbox
                      isChecked={tvSetup.hasTelephony}
                      onChange={(event) =>
                        setTvSetup((prev) => ({
                          ...prev,
                          hasTelephony: event.target.checked,
                        }))
                      }
                      colorScheme="brand"
                    >
                      Cliente tem telefonia
                    </Checkbox>
                  </FormControl>
                  <FormControl>
                    <FormLabel>Quantidade de acessos</FormLabel>
                    <Input
                      type="number"
                      min={1}
                      max={50}
                      value={tvSetup.quantity}
                      onChange={(event) => {
                        const digits = event.target.value.replace(/\D/g, "");
                        setTvSetup((prev) => ({
                          ...prev,
                          quantity: digits,
                        }));
                      }}
                    />
                  </FormControl>
                  <GridItem colSpan={{ base: 1, md: 2, xl: 1 }}>
                    <FormControl isRequired>
                      <FormLabel>Vendedor</FormLabel>
                      <Input
                        list="client-form-vendors"
                        placeholder={vendorsLoading ? "Carregando vendedores..." : "Nome do vendedor"}
                        value={tvSetup.soldBy}
                        onChange={(event) =>
                          setTvSetup((prev) => ({
                            ...prev,
                            soldBy: event.target.value,
                          }))
                        }
                        autoComplete="off"
                      />
                      <datalist id="client-form-vendors">
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
                            as={Link}
                            href="/admin/usuarios"
                          >
                            Cadastrar vendedor
                          </Button>
                        ) : (
                          <Button
                            size="sm"
                            variant="outline"
                            leftIcon={<FiSend />}
                            onClick={async () => {
                              const description = window.prompt(
                                "Descreva o vendedor que deseja cadastrar (nome, e-mail, observações).",
                              );
                              if (!description) {
                                return;
                              }
                              try {
                                await createRequest("VENDOR_CREATE_REQUEST", {
                                  description,
                                  clientId: existingClientId ?? null,
                                });
                                toast({
                                  title: "Solicitação enviada",
                                  description: "O administrador foi notificado sobre sua solicitação.",
                                  status: "success",
                                });
                              } catch (error) {
                                console.error(error);
                                toast({
                                  title: "Falha ao solicitar cadastro",
                                  status: "error",
                                });
                              }
                            }}
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
                      value={tvSetup.soldAt}
                      onChange={(event) =>
                        setTvSetup((prev) => ({
                          ...prev,
                          soldAt: event.target.value,
                        }))
                      }
                    />
                  </FormControl>
                  <FormControl>
                    <FormLabel>Início</FormLabel>
                    <Input
                      type="date"
                      value={tvSetup.startsAt}
                      onChange={(event) =>
                        setTvSetup((prev) => ({
                          ...prev,
                          startsAt: event.target.value,
                        }))
                      }
                    />
                  </FormControl>
                  <FormControl isRequired>
                    <FormLabel>Vencimento</FormLabel>
                    <Input
                      type="date"
                      value={tvSetup.expiresAt}
                      onChange={(event) =>
                        setTvSetup((prev) => ({
                          ...prev,
                          expiresAt: event.target.value,
                        }))
                      }
                    />
                  </FormControl>
                  <GridItem colSpan={{ base: 1, md: 2, xl: 3 }}>
                    <FormControl>
                      <FormLabel>Observações</FormLabel>
                      <Textarea
                        rows={2}
                        value={tvSetup.notes}
                        onChange={(event) =>
                          setTvSetup((prev) => ({
                            ...prev,
                            notes: event.target.value,
                          }))
                        }
                        placeholder="Anotações complementares (opcional)"
                      />
                    </FormControl>
                  </GridItem>
                  <GridItem colSpan={{ base: 1, md: 2, xl: 3 }}>
                    <Text fontSize="sm" color="gray.500">
                      Os acessos serão gerados automaticamente após salvar o cliente.
                    </Text>
                  </GridItem>
                </SimpleGrid>
              </Box>
            )}
            {mode === "full" && isCloudSelected && (
              <Box
                mt={6}
                p={4}
                borderWidth={1}
                borderRadius="xl"
                borderColor={cardBorder}
                bg={cardBg}
              >
                <Text fontWeight="semibold" mb={3}>
                  Configurar serviços selecionados
                </Text>
                <Stack spacing={4}>
                  {selectedCloudServiceIds.map((serviceId) => {
                    const service = cloudServices.find((item) => item.id === serviceId);
                    const config = cloudSetups[serviceId] ?? buildInitialCloudSetup();
                    return (
                      <Box key={serviceId} borderWidth={1} borderRadius="lg" borderColor={cardBorder} p={4} bg={cloudItemBg}>
                        <Text fontWeight="semibold" mb={3}>
                          {service?.name ?? "Serviço"}
                        </Text>
                        <SimpleGrid columns={{ base: 1, md: 2 }} spacing={4}>
                          <FormControl isRequired>
                            <FormLabel>Data de vencimento</FormLabel>
                            <Input
                              type="date"
                              value={config.expiresAt}
                              onChange={(event) =>
                                setCloudSetups((prev) => ({
                                  ...prev,
                                  [serviceId]: {
                                    ...config,
                                    expiresAt: event.target.value,
                                  },
                                }))
                              }
                            />
                          </FormControl>
                          <FormControl>
                            <FormLabel>Tipo de acesso</FormLabel>
                            <Checkbox
                              isChecked={config.isTest}
                              onChange={(event) =>
                                setCloudSetups((prev) => ({
                                  ...prev,
                                  [serviceId]: {
                                    ...config,
                                    isTest: event.target.checked,
                                  },
                                }))
                              }
                            >
                              Teste
                            </Checkbox>
                          </FormControl>
                        </SimpleGrid>
                        <FormControl mt={4}>
                          <FormLabel>Comentários</FormLabel>
                          <Textarea
                            placeholder="Descrição ou observações"
                            value={config.notes}
                            onChange={(event) =>
                              setCloudSetups((prev) => ({
                                ...prev,
                                [serviceId]: {
                                  ...config,
                                  notes: event.target.value,
                                },
                              }))
                            }
                          />
                        </FormControl>
                      </Box>
                    );
                  })}
                </Stack>
              </Box>
            )}
            {/* TVAssignmentsManager só aparece quando editando cliente existente */}
            {mode === "full" && tvServices.length > 0 && defaultValues?.id && (
              <TVAssignmentsManager
                clientId={defaultValues.id}
                isTvSelected={isTvSelected}
                isOpen={isOpen}
              />
            )}
          </ModalBody>
          <ModalFooter gap={3}>
            <Button variant="ghost" onClick={handleClose}>
              Cancelar
            </Button>
            <Button type="submit" isLoading={isSubmitting}>
              {defaultValues ? "Atualizar" : "Cadastrar"}
            </Button>
          </ModalFooter>
        </form>
      </ModalContent>
    </Modal>
  );
}

