"use client";

import {
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalCloseButton,
  ModalBody,
  ModalFooter,
  Button,
  VStack,
  FormControl,
  FormLabel,
  Input,
  Checkbox,
  Textarea,
  useToast,
  Box,
  Text,
  Grid,
  GridItem,
  Stack,
  Select,
  HStack,
  Badge,
  useColorModeValue,
} from "@chakra-ui/react";
import { useForm, Controller } from "react-hook-form";
import { useState, useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Service, Client } from "@/types";
import { TVPlanType } from "@/types";
import { fetchVendors, Vendor } from "@/lib/api/users";
import { vendorDisplayName } from "@/lib/utils/vendors";
import { useAuth } from "@/context/AuthContext";
import { createRequest } from "@/lib/api/requests";
import { FiUserPlus, FiSend } from "react-icons/fi";
import Link from "next/link";

const CLOUD_SERVICE_KEYWORDS = ["cloud", "hub", "hubplay", "telemedicina", "telepet"];

export interface ClientServicesFormValues {
  serviceIds?: string[];
  serviceSelections?: Array<{
    serviceId: string;
    customPrice?: number | null;
  }>;
  tvSetup?: {
    quantityEssencial?: number;
    quantityPremium?: number;
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
  }>;
}

interface ClientServicesModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (values: ClientServicesFormValues) => Promise<void>;
  client: Client;
  serviceOptions: Service[];
}

type TvSetupState = {
  quantityEssencial: string;
  quantityPremium: string;
  customEmail: string; // Email personalizado (cria conta com 1 slot exclusivo)
  soldBy: string;
  soldAt: string;
  startsAt: string;
  expiresAt: string;
  notes: string;
  hasTelephony: boolean;
};

type CloudSetupState = {
  expiresAt: string;
  isTest: boolean;
  notes: string;
};

function buildInitialTvSetup(): TvSetupState {
  const today = new Date().toISOString().slice(0, 10);
  return {
    quantityEssencial: "0",
    quantityPremium: "0",
    customEmail: "",
    soldBy: "",
    soldAt: today,
    startsAt: today,
    expiresAt: "",
    notes: "",
    hasTelephony: false,
  };
}

function buildInitialCloudSetup(): CloudSetupState {
  return {
    expiresAt: "",
    isTest: false,
    notes: "",
  };
}

export function ClientServicesModal({
  isOpen,
  onClose,
  onSubmit,
  client,
  serviceOptions,
}: ClientServicesModalProps) {
  const toast = useToast();
  const { isAdmin } = useAuth();
  const { data: vendors = [], isLoading: vendorsLoading } = useQuery<Vendor[]>({
    queryKey: ["vendors"],
    queryFn: fetchVendors,
    enabled: isOpen,
  });
  const cardBg = useColorModeValue("rgba(255,255,255,0.78)", "rgba(15, 23, 42, 0.7)");
  const cardBorder = useColorModeValue("rgba(226,232,240,0.6)", "rgba(45,55,72,0.6)");

  const vendorOptions = useMemo(() => {
    return vendors
      .map((vendor) => vendorDisplayName(vendor))
      .filter((label): label is string => Boolean(label))
      .map((label) => ({ label }));
  }, [vendors]);

  const currentServiceIds = useMemo(() => {
    if (!client || !client.services) return [];
    return client.services.map((s) => s.id);
  }, [client?.services]);

  const { control, handleSubmit, reset, watch, setValue } = useForm<ClientServicesFormValues>({
    defaultValues: {
      serviceIds: currentServiceIds,
    },
  });

  const selectedServiceIds = watch("serviceIds") ?? [];

  const [tvSetup, setTvSetup] = useState<TvSetupState>(buildInitialTvSetup());
  const [cloudSetups, setCloudSetups] = useState<Record<string, CloudSetupState>>({});
  const [customPrices, setCustomPrices] = useState<Record<string, string>>({});
  const [customPricesEssencial, setCustomPricesEssencial] = useState<Record<string, string>>({});
  const [customPricesPremium, setCustomPricesPremium] = useState<Record<string, string>>({});
  const [pricesInitialized, setPricesInitialized] = useState(false);

  // Carregar dados existentes - apenas UMA VEZ quando o modal abre
  useEffect(() => {
    if (!isOpen || !client || pricesInitialized) {
      return;
    }

    // Carregar preços personalizados apenas na primeira vez que o modal abre
    const prices: Record<string, string> = {};
    const pricesEssencial: Record<string, string> = {};
    const pricesPremium: Record<string, string> = {};
    (client.services ?? []).forEach((service) => {
      const serviceName = service.name.toLowerCase();
      const isTvService = serviceName.includes("tv") && 
                          !serviceName.includes("essencial") && 
                          !serviceName.includes("premium");
      
      if (isTvService) {
        // TV Essencial e Premium são fragmentos do serviço TV único
        // IMPORTANTE: Ler APENAS os preços específicos, SEM fallback para customPrice
        // Isso garante que os campos sejam completamente independentes
        if (service.customPriceEssencial !== undefined && service.customPriceEssencial !== null) {
          pricesEssencial[service.id] = service.customPriceEssencial.toFixed(2).replace(".", ",");
        }
        // Se não tiver customPriceEssencial, deixa vazio (não usa fallback)
        
        if (service.customPricePremium !== undefined && service.customPricePremium !== null) {
          pricesPremium[service.id] = service.customPricePremium.toFixed(2).replace(".", ",");
        }
        // Se não tiver customPricePremium, deixa vazio (não usa fallback)
      } else {
        // Para outros serviços, usar customPrice normal
        if (service.customPrice !== undefined && service.customPrice !== null) {
          prices[service.id] = service.customPrice.toFixed(2).replace(".", ",");
        }
      }
    });
    setCustomPrices(prices);
    setCustomPricesEssencial(pricesEssencial);
    setCustomPricesPremium(pricesPremium);
    setPricesInitialized(true);

    // Carregar configurações Cloud
    const cloudMap: Record<string, CloudSetupState> = {};
    (client.cloudAccesses ?? []).forEach((access) => {
      if (access.serviceId) {
        cloudMap[access.serviceId] = {
          expiresAt: access.expiresAt ? access.expiresAt.slice(0, 10) : "",
          isTest: access.isTest ?? false,
          notes: access.notes ?? "",
        };
      }
    });
    setCloudSetups(cloudMap);

    // Carregar configuração TV (se houver)
    if (client.tvAssignments && client.tvAssignments.length > 0) {
      const firstAssignment = client.tvAssignments[0];
      
      // Contar acessos existentes por tipo
      const existingEssencial = client.tvAssignments.filter((a) => (a.planType ?? "ESSENCIAL") === "ESSENCIAL").length;
      const existingPremium = client.tvAssignments.filter((a) => a.planType === "PREMIUM").length;
      
      setTvSetup({
        quantityEssencial: String(existingEssencial), // Usar total atual
        quantityPremium: String(existingPremium), // Usar total atual
        customEmail: "", // Não carregar email personalizado ao editar
        soldBy: firstAssignment.soldBy ?? "",
        soldAt: firstAssignment.soldAt ? firstAssignment.soldAt.slice(0, 10) : new Date().toISOString().slice(0, 10),
        startsAt: firstAssignment.startsAt ? firstAssignment.startsAt.slice(0, 10) : new Date().toISOString().slice(0, 10),
        expiresAt: firstAssignment.expiresAt ? firstAssignment.expiresAt.slice(0, 10) : "",
        notes: firstAssignment.notes ?? "",
        hasTelephony: firstAssignment.hasTelephony ?? false,
      });
    }

    reset({ serviceIds: currentServiceIds });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, client?.id, pricesInitialized]); // Apenas executar quando o modal abre ou o cliente muda


  const tvServices = useMemo(
    () =>
      serviceOptions.filter((service) => service.name.toLowerCase().includes("tv")),
    [serviceOptions],
  );

  const cloudServices = useMemo(
    () =>
      serviceOptions.filter((service) =>
        CLOUD_SERVICE_KEYWORDS.some((keyword) => service.name.toLowerCase().includes(keyword)),
      ),
    [serviceOptions],
  );

  const selectedCloudServiceIds = useMemo(() => {
    return selectedServiceIds.filter((serviceId) => cloudServices.some((service) => service.id === serviceId));
  }, [selectedServiceIds, cloudServices]);

  const isTvSelected = useMemo(() => {
    return tvServices.length
      ? selectedServiceIds.some((serviceId) => tvServices.some((service) => service.id === serviceId))
      : false;
  }, [selectedServiceIds, tvServices]);

  // Inicializar cloudSetups quando serviços Cloud são selecionados
  useEffect(() => {
    setCloudSetups((prev) => {
      const next: Record<string, CloudSetupState> = { ...prev };
      selectedCloudServiceIds.forEach((serviceId) => {
        if (!next[serviceId]) {
          next[serviceId] = buildInitialCloudSetup();
        }
      });
      return next;
    });
  }, [selectedCloudServiceIds]);

  const handleClose = () => {
    setTvSetup(buildInitialTvSetup());
    setCloudSetups({});
    setCustomPrices({});
    setCustomPricesEssencial({});
    setCustomPricesPremium({});
    setPricesInitialized(false);
    onClose();
  };

  const onSubmitInternal = async (values: ClientServicesFormValues) => {
    try {
      const serviceIds = values.serviceIds ?? [];
      
      // Encontrar serviço TV (genérico, não Essencial nem Premium)
      const tvService = serviceOptions.find((s) => {
        const name = s.name.toLowerCase();
        return name.includes("tv") && !name.includes("essencial") && !name.includes("premium");
      });
      
      const hasTvService = tvService && serviceIds.includes(tvService.id);
      
      // Obter preços Essencial e Premium do serviço TV genérico
      const priceEssencialStr = tvService ? customPricesEssencial[tvService.id] : null;
      const pricePremiumStr = tvService ? customPricesPremium[tvService.id] : null;
      
      const priceEssencial = priceEssencialStr ? parseFloat(priceEssencialStr.replace(",", ".")) : null;
      const pricePremium = pricePremiumStr ? parseFloat(pricePremiumStr.replace(",", ".")) : null;
      
      // Criar seleções de serviços
      // TV Essencial e Premium são fragmentos do serviço TV único, não serviços separados
      const serviceSelections = serviceIds.map((serviceId) => {
        const service = serviceOptions.find((s) => s.id === serviceId);
        const isTvService = service?.name.toLowerCase().includes("tv") && 
                           !service?.name.toLowerCase().includes("essencial") && 
                           !service?.name.toLowerCase().includes("premium");
        
        let customPrice: number | null = null;
        let customPriceEssencial: number | null = null;
        let customPricePremium: number | null = null;
        
        if (isTvService && hasTvService && serviceId === tvService.id) {
          // Para o serviço TV único, salvar preços Essencial e Premium como campos separados
          customPriceEssencial = isNaN(priceEssencial ?? NaN) ? null : priceEssencial;
          customPricePremium = isNaN(pricePremium ?? NaN) ? null : pricePremium;
          // customPrice pode ser usado como fallback ou null
          customPrice = customPriceEssencial ?? customPricePremium ?? null;
        } else {
          // Para outros serviços, usar o preço normal
          const priceStr = customPrices[serviceId];
          customPrice = priceStr ? parseFloat(priceStr.replace(",", ".")) : null;
          customPrice = isNaN(customPrice ?? NaN) ? null : customPrice;
        }
        
        return {
          serviceId,
          customPrice,
          customPriceEssencial,
          customPricePremium,
        };
      });

      let tvSetupPayload: ClientServicesFormValues["tvSetup"] | undefined;
      if (isTvSelected) {
        const hasSoldBy = tvSetup.soldBy && tvSetup.soldBy.trim();
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

        if (hasSoldBy && hasExpiresAt) {
          // Sempre usar campos principais (total desejado)
          const parsedEssencial = parseInt(tvSetup.quantityEssencial || "0", 10);
          const parsedPremium = parseInt(tvSetup.quantityPremium || "0", 10);
          const quantityEssencial = Number.isFinite(parsedEssencial) && parsedEssencial >= 0 ? Math.min(50, parsedEssencial) : 0;
          const quantityPremium = Number.isFinite(parsedPremium) && parsedPremium >= 0 ? Math.min(50, parsedPremium) : 0;

          // Se pelo menos uma quantidade for maior que 0, criar payload
          if (quantityEssencial > 0 || quantityPremium > 0) {
            tvSetupPayload = {
              quantityEssencial,
              quantityPremium,
              customEmail: tvSetup.customEmail?.trim() || undefined, // Email personalizado (apenas se fornecido)
              soldBy: tvSetup.soldBy.trim(),
              soldAt: tvSetup.soldAt || undefined,
              startsAt: tvSetup.startsAt || undefined,
              expiresAt: expiresAtFormatted,
              notes: tvSetup.notes?.trim() || undefined,
              hasTelephony: tvSetup.hasTelephony || undefined,
            };
          }
        }
      }

      let cloudSetupsPayload: ClientServicesFormValues["cloudSetups"];
      if (selectedCloudServiceIds.length) {
        const setups: NonNullable<ClientServicesFormValues["cloudSetups"]> = [];
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
        }
        cloudSetupsPayload = setups.length > 0 ? setups : undefined;
      }

      await onSubmit({
        serviceIds,
        serviceSelections,
        tvSetup: tvSetupPayload,
        cloudSetups: cloudSetupsPayload,
      });

      toast({
        title: "Serviços atualizados",
        status: "success",
        duration: 3000,
        isClosable: true,
      });
      handleClose();
    } catch (error) {
      console.error("Erro ao salvar serviços:", error);
      toast({
        title: "Erro ao salvar serviços",
        description: error instanceof Error ? error.message : "Não foi possível salvar os serviços.",
        status: "error",
        duration: 10000,
        isClosable: true,
      });
    }
  };

  if (!client) {
    return null;
  }

  return (
    <Modal isOpen={isOpen} onClose={handleClose} size="4xl">
      <ModalOverlay />
      <ModalContent>
        <ModalHeader>Gerenciar serviços - {client.name}</ModalHeader>
        <ModalCloseButton />
        <form onSubmit={handleSubmit(onSubmitInternal)}>
          <ModalBody>
            <VStack spacing={6} align="stretch">
              <Box>
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
                        <VStack align="stretch" spacing={2}>
                          {serviceOptions.map((service) => (
                            <Checkbox
                              key={service.id}
                              isChecked={field.value?.includes(service.id)}
                              onChange={(e) => {
                                const current = field.value ?? [];
                                if (e.target.checked) {
                                  field.onChange([...current, service.id]);
                                } else {
                                  field.onChange(current.filter((id) => id !== service.id));
                                }
                              }}
                            >
                              {service.name}
                              {service.allowCustomPrice && (
                                <Badge ml={2} colorScheme="purple">
                                  Preço personalizado
                                </Badge>
                              )}
                            </Checkbox>
                          ))}
                        </VStack>
                      )}
                    />
                  )}
                </FormControl>
              </Box>

              {/* Preços personalizados */}
              {selectedServiceIds
                .map((id) => serviceOptions.find((s) => s.id === id))
                .filter((s) => s?.allowCustomPrice)
                .map((service) => {
                  const isTvService = service!.name.toLowerCase().includes("tv");
                  return (
                    <Box key={service!.id} p={4} bg={cardBg} borderRadius="lg" borderWidth={1} borderColor={cardBorder}>
                      {isTvService ? (
                        <Grid templateColumns={{ base: "1fr", md: "1fr 1fr" }} gap={4}>
                          <GridItem>
                            <FormControl>
                              <FormLabel>Preço personalizado - {service!.name} ESSENCIAL</FormLabel>
                              <Input
                                id={`tv-essencial-${service!.id}`}
                                placeholder="0,00"
                                value={customPricesEssencial[service!.id] || ""}
                                onChange={(e) => {
                                  const value = e.target.value.replace(/[^\d,]/g, "");
                                  const serviceId = service!.id;
                                  // Atualizar APENAS o estado Essencial, sem tocar no Premium
                                  setCustomPricesEssencial((prev) => {
                                    const newState = { ...prev };
                                    newState[serviceId] = value;
                                    return newState;
                                  });
                                }}
                              />
                            </FormControl>
                          </GridItem>
                          <GridItem>
                            <FormControl>
                              <FormLabel>Preço personalizado - {service!.name} PREMIUM</FormLabel>
                              <Input
                                id={`tv-premium-${service!.id}`}
                                placeholder="0,00"
                                value={customPricesPremium[service!.id] || ""}
                                onChange={(e) => {
                                  const value = e.target.value.replace(/[^\d,]/g, "");
                                  const serviceId = service!.id;
                                  // Atualizar APENAS o estado Premium, sem tocar no Essencial
                                  setCustomPricesPremium((prev) => {
                                    const newState = { ...prev };
                                    newState[serviceId] = value;
                                    return newState;
                                  });
                                }}
                              />
                            </FormControl>
                          </GridItem>
                        </Grid>
                      ) : (
                        <FormControl>
                          <FormLabel>Preço personalizado - {service!.name}</FormLabel>
                          <Input
                            placeholder="0,00"
                            value={customPrices[service!.id] ?? ""}
                            onChange={(e) => {
                              const value = e.target.value.replace(/[^\d,]/g, "");
                              setCustomPrices((prev) => ({ ...prev, [service!.id]: value }));
                            }}
                          />
                        </FormControl>
                      )}
                    </Box>
                  );
                })}

              {/* Configuração TV */}
              {isTvSelected && (
                <Box p={4} bg={cardBg} borderRadius="lg" borderWidth={1} borderColor={cardBorder}>
                  <Text fontWeight="semibold" mb={4}>
                    ⚡ Configuração de TV (Acessos serão gerados automaticamente)
                  </Text>
                  {client?.tvAssignments && client.tvAssignments.length > 0 && (
                    <Text fontSize="sm" color="gray.500" mb={3}>
                      Acessos existentes: {client.tvAssignments.length} (Essencial: {client.tvAssignments.filter((a) => (a.planType ?? "ESSENCIAL") === "ESSENCIAL").length}, Premium: {client.tvAssignments.filter((a) => a.planType === "PREMIUM").length})
                    </Text>
                  )}
                  <Grid templateColumns={{ base: "1fr", md: "1fr 1fr" }} gap={4} mb={4}>
                    <GridItem>
                      <FormControl>
                        <FormLabel>Quantidade TV ESSENCIAL</FormLabel>
                        <Input
                          type="number"
                          min={0}
                          max={50}
                          value={tvSetup.quantityEssencial}
                          onChange={(e) => setTvSetup((prev) => ({ ...prev, quantityEssencial: e.target.value }))}
                        />
                        <Text fontSize="xs" color="gray.500" mt={1}>
                          Total de acessos Essencial que o cliente terá
                        </Text>
                      </FormControl>
                    </GridItem>
                    <GridItem>
                      <FormControl>
                        <FormLabel>Quantidade TV PREMIUM</FormLabel>
                        <Input
                          type="number"
                          min={0}
                          max={50}
                          value={tvSetup.quantityPremium}
                          onChange={(e) => setTvSetup((prev) => ({ ...prev, quantityPremium: e.target.value }))}
                        />
                        <Text fontSize="xs" color="gray.500" mt={1}>
                          Total de acessos Premium que o cliente terá
                        </Text>
                      </FormControl>
                    </GridItem>
                  </Grid>
                  <FormControl>
                    <FormLabel>E-mail personalizado (opcional)</FormLabel>
                    <Input
                      type="email"
                      value={tvSetup.customEmail}
                      onChange={(e) => setTvSetup((prev) => ({ ...prev, customEmail: e.target.value }))}
                      placeholder="exemplo@empresa.com.br"
                    />
                    <Text fontSize="xs" color="gray.500" mt={1}>
                      Se informado, será criada uma conta exclusiva com 1 slot para este email. Deixe vazio para usar emails padrão (1a8, 2a9, etc).
                    </Text>
                  </FormControl>
                  <Grid templateColumns={{ base: "1fr", md: "1fr 1fr" }} gap={4}>
                    <GridItem colSpan={{ base: 1, md: 2 }}>
                      <FormControl>
                        <FormLabel>Vendido por</FormLabel>
                        <Input
                          list="client-services-vendors"
                          placeholder={vendorsLoading ? "Carregando vendedores..." : "Nome do vendedor"}
                          value={tvSetup.soldBy}
                          onChange={(e) => setTvSetup((prev) => ({ ...prev, soldBy: e.target.value }))}
                          autoComplete="off"
                        />
                        <datalist id="client-services-vendors">
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
                                    clientId: client?.id ?? null,
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
                    <GridItem>
                      <FormControl>
                        <FormLabel>Data de venda</FormLabel>
                        <Input
                          type="date"
                          value={tvSetup.soldAt}
                          onChange={(e) => setTvSetup((prev) => ({ ...prev, soldAt: e.target.value }))}
                        />
                      </FormControl>
                    </GridItem>
                    <GridItem>
                      <FormControl>
                        <FormLabel>Data de início</FormLabel>
                        <Input
                          type="date"
                          value={tvSetup.startsAt}
                          onChange={(e) => setTvSetup((prev) => ({ ...prev, startsAt: e.target.value }))}
                        />
                      </FormControl>
                    </GridItem>
                    <GridItem>
                      <FormControl>
                        <FormLabel>Vencimento</FormLabel>
                        <Input
                          type="date"
                          value={tvSetup.expiresAt}
                          onChange={(e) => setTvSetup((prev) => ({ ...prev, expiresAt: e.target.value }))}
                        />
                      </FormControl>
                    </GridItem>
                    <GridItem colSpan={{ base: 1, md: 2 }}>
                      <FormControl>
                        <Checkbox
                          isChecked={tvSetup.hasTelephony}
                          onChange={(e) => setTvSetup((prev) => ({ ...prev, hasTelephony: e.target.checked }))}
                        >
                          Inclui telefonia
                        </Checkbox>
                      </FormControl>
                    </GridItem>
                    <GridItem colSpan={{ base: 1, md: 2 }}>
                      <FormControl>
                        <FormLabel>Observações</FormLabel>
                        <Textarea
                          value={tvSetup.notes}
                          onChange={(e) => setTvSetup((prev) => ({ ...prev, notes: e.target.value }))}
                        />
                      </FormControl>
                    </GridItem>
                  </Grid>
                </Box>
              )}

              {/* Configurações Cloud */}
              {selectedCloudServiceIds.map((serviceId) => {
                const service = serviceOptions.find((s) => s.id === serviceId);
                const config = cloudSetups[serviceId] ?? buildInitialCloudSetup();
                return (
                  <Box key={serviceId} p={4} bg={cardBg} borderRadius="lg" borderWidth={1} borderColor={cardBorder}>
                    <Text fontWeight="semibold" mb={4}>
                      Configurar {service?.name}
                    </Text>
                    <Grid templateColumns={{ base: "1fr", md: "1fr 1fr" }} gap={4}>
                      <GridItem>
                        <FormControl isRequired>
                          <FormLabel>Data de vencimento</FormLabel>
                          <Input
                            type="date"
                            value={config.expiresAt}
                            onChange={(e) =>
                              setCloudSetups((prev) => ({
                                ...prev,
                                [serviceId]: { ...prev[serviceId], expiresAt: e.target.value },
                              }))
                            }
                          />
                        </FormControl>
                      </GridItem>
                      <GridItem>
                        <FormControl>
                          <Checkbox
                            isChecked={config.isTest}
                            onChange={(e) =>
                              setCloudSetups((prev) => ({
                                ...prev,
                                [serviceId]: { ...prev[serviceId], isTest: e.target.checked },
                              }))
                            }
                          >
                            Tipo de acesso: Teste
                          </Checkbox>
                        </FormControl>
                      </GridItem>
                      <GridItem colSpan={{ base: 1, md: 2 }}>
                        <FormControl>
                          <FormLabel>Comentários</FormLabel>
                          <Textarea
                            placeholder="Descrição ou observações"
                            value={config.notes}
                            onChange={(e) =>
                              setCloudSetups((prev) => ({
                                ...prev,
                                [serviceId]: { ...prev[serviceId], notes: e.target.value },
                              }))
                            }
                          />
                        </FormControl>
                      </GridItem>
                    </Grid>
                  </Box>
                );
              })}
            </VStack>
          </ModalBody>
          <ModalFooter>
            <Button variant="ghost" mr={3} onClick={handleClose}>
              Cancelar
            </Button>
            <Button type="submit" colorScheme="blue">
              Salvar serviços
            </Button>
          </ModalFooter>
        </form>
      </ModalContent>
    </Modal>
  );
}

