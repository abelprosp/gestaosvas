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
  Box,
  Text,
  HStack,
  Divider,
  useColorModeValue,
  Badge,
} from "@chakra-ui/react";
import { Client, Service } from "@/types";
import { FiDollarSign } from "react-icons/fi";

const currencyFormatter = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

interface ClientValuesModalProps {
  isOpen: boolean;
  onClose: () => void;
  client: Client;
}

const CLOUD_KEYWORDS = ["cloud"];
const HUB_KEYWORDS = ["hub", "hubplay"];
const TELE_KEYWORDS = ["telemedicina", "telepet"];

function isServiceType(service: Service, keywords: string[]): boolean {
  const name = service.name.toLowerCase();
  return keywords.some((keyword) => name.includes(keyword));
}

export function ClientValuesModal({ isOpen, onClose, client }: ClientValuesModalProps) {
  const cardBg = useColorModeValue("white", "gray.800");
  const cardBorder = useColorModeValue("gray.200", "gray.700");
  const mutedText = useColorModeValue("gray.600", "gray.400");

  // Calcular valores de TV
  const tvEssencialAssignments = (client.tvAssignments ?? []).filter(
    (assignment) => assignment.planType === "ESSENCIAL"
  );
  const tvPremiumAssignments = (client.tvAssignments ?? []).filter(
    (assignment) => assignment.planType === "PREMIUM"
  );

  // Função auxiliar para normalizar nomes de serviços (remove acentos, espaços extras, etc)
  const normalizeServiceName = (name: string): string => {
    return name
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "") // Remove acentos
      .replace(/\s+/g, " ") // Normaliza espaços
      .trim();
  };

  // Encontrar serviços TV - busca mais flexível
  // Primeiro tenta encontrar serviços específicos (TV Essencial, TV Premium)
  let tvEssencialService = (client.services ?? []).find((service) => {
    const normalized = normalizeServiceName(service.name);
    return normalized.includes("tv") && normalized.includes("essencial");
  });
  
  let tvPremiumService = (client.services ?? []).find((service) => {
    const normalized = normalizeServiceName(service.name);
    return normalized.includes("tv") && normalized.includes("premium");
  });

  // Se não encontrou serviços específicos, tenta usar serviço TV genérico
  // (isso acontece quando o cliente tem apenas "TV" vinculado)
  if (!tvEssencialService || !tvPremiumService) {
    const tvGenericService = (client.services ?? []).find((service) => {
      const normalized = normalizeServiceName(service.name);
      // Encontra serviço que contém "tv" mas não contém "essencial" nem "premium"
      return (
        normalized.includes("tv") &&
        !normalized.includes("essencial") &&
        !normalized.includes("premium")
      );
    });

    // Se encontrou serviço TV genérico, usa ele para ambos
    if (tvGenericService) {
      if (!tvEssencialService) {
        tvEssencialService = tvGenericService;
      }
      if (!tvPremiumService) {
        tvPremiumService = tvGenericService;
      }
    }
  }

  // Calcular valores TV
  // Prioridade: customPrice > price > 0
  const tvEssencialPricePerAccess =
    tvEssencialService?.customPrice !== null && tvEssencialService?.customPrice !== undefined
      ? tvEssencialService.customPrice
      : tvEssencialService?.price ?? 0;
  const tvEssencialTotal = tvEssencialPricePerAccess * tvEssencialAssignments.length;

  const tvPremiumPricePerAccess =
    tvPremiumService?.customPrice !== null && tvPremiumService?.customPrice !== undefined
      ? tvPremiumService.customPrice
      : tvPremiumService?.price ?? 0;
  const tvPremiumTotal = tvPremiumPricePerAccess * tvPremiumAssignments.length;

  // Debug: log dos serviços encontrados (depois de calcular os preços)
  if (isOpen) {
    const tvGenericService = (client.services ?? []).find((service) => {
      const normalized = normalizeServiceName(service.name);
      return (
        normalized.includes("tv") &&
        !normalized.includes("essencial") &&
        !normalized.includes("premium")
      );
    });

    console.log("🔍 Debug ClientValuesModal:", {
      clientName: client.name,
      allServices: (client.services ?? []).map((s) => ({
        id: s.id,
        name: s.name,
        price: s.price,
        customPrice: s.customPrice,
        allowCustomPrice: s.allowCustomPrice,
      })),
      tvGenericService: tvGenericService
        ? {
            name: tvGenericService.name,
            price: tvGenericService.price,
            customPrice: tvGenericService.customPrice,
          }
        : null,
      tvEssencialService: tvEssencialService
        ? {
            name: tvEssencialService.name,
            price: tvEssencialService.price,
            customPrice: tvEssencialService.customPrice,
          }
        : null,
      tvPremiumService: tvPremiumService
        ? {
            name: tvPremiumService.name,
            price: tvPremiumService.price,
            customPrice: tvPremiumService.customPrice,
          }
        : null,
      tvEssencialAssignments: tvEssencialAssignments.length,
      tvPremiumAssignments: tvPremiumAssignments.length,
      calculatedEssencialPrice: tvEssencialPricePerAccess,
      calculatedPremiumPrice: tvPremiumPricePerAccess,
    });
  }

  // Separar serviços por tipo
  const cloudServices = (client.services ?? []).filter((service) => isServiceType(service, CLOUD_KEYWORDS));
  const hubServices = (client.services ?? []).filter((service) => isServiceType(service, HUB_KEYWORDS));
  const teleServices = (client.services ?? []).filter((service) => isServiceType(service, TELE_KEYWORDS));

  // Calcular totais por tipo
  const cloudTotal = cloudServices.reduce((sum, service) => {
    const price = service.customPrice ?? service.price;
    return sum + price;
  }, 0);

  const hubTotal = hubServices.reduce((sum, service) => {
    const price = service.customPrice ?? service.price;
    return sum + price;
  }, 0);

  const teleTotal = teleServices.reduce((sum, service) => {
    const price = service.customPrice ?? service.price;
    return sum + price;
  }, 0);

  // Valor total geral
  const grandTotal = tvEssencialTotal + tvPremiumTotal + cloudTotal + hubTotal + teleTotal;

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="xl" scrollBehavior="inside">
      <ModalOverlay />
      <ModalContent>
        <ModalHeader>
          <HStack spacing={2}>
            <FiDollarSign />
            <Text>Valores Discriminados - {client.name}</Text>
          </HStack>
        </ModalHeader>
        <ModalCloseButton />
        <ModalBody>
          <VStack align="stretch" spacing={4}>
            {/* Debug: Listar todos os serviços do cliente */}
            {(tvEssencialAssignments.length > 0 || tvPremiumAssignments.length > 0) &&
              (!tvEssencialService || !tvPremiumService) && (
                <Box borderWidth={1} borderRadius="lg" p={3} bg="orange.50" borderColor="orange.200" _dark={{ bg: "orange.900", borderColor: "orange.700" }}>
                  <Text fontSize="sm" fontWeight="semibold" mb={2} color="orange.700" _dark={{ color: "orange.300" }}>
                    ⚠️ Informações de Debug
                  </Text>
                  <VStack align="stretch" spacing={1}>
                    <Text fontSize="xs" color="orange.600" _dark={{ color: "orange.400" }}>
                      Serviços vinculados ao cliente:
                    </Text>
                    {(client.services ?? []).map((service) => (
                      <Text key={service.id} fontSize="xs" color="orange.600" _dark={{ color: "orange.400" }}>
                        • {service.name} - Preço: {currencyFormatter.format(service.price)} | Custom:{" "}
                        {service.customPrice !== null && service.customPrice !== undefined
                          ? currencyFormatter.format(service.customPrice)
                          : "não definido"}
                      </Text>
                    ))}
                    {(!client.services || client.services.length === 0) && (
                      <Text fontSize="xs" color="orange.600" _dark={{ color: "orange.400" }}>
                        Nenhum serviço vinculado
                      </Text>
                    )}
                  </VStack>
                </Box>
              )}

            {/* TV Essencial */}
            {tvEssencialAssignments.length > 0 && (
              <Box borderWidth={1} borderRadius="lg" p={4} bg={cardBg} borderColor={cardBorder}>
                <HStack justify="space-between" mb={2}>
                  <Text fontWeight="semibold">TV Essencial</Text>
                  <Badge colorScheme="teal">{tvEssencialAssignments.length} acesso(s)</Badge>
                </HStack>
                {tvEssencialService && tvEssencialPricePerAccess === 0 && (
                  <Text fontSize="xs" color="orange.500" mb={2}>
                    ⚠️ Valor do serviço está zerado. Verifique o preço no cadastro do serviço.
                  </Text>
                )}
                {tvEssencialService && 
                 normalizeServiceName(tvEssencialService.name).includes("tv") &&
                 !normalizeServiceName(tvEssencialService.name).includes("essencial") &&
                 !normalizeServiceName(tvEssencialService.name).includes("premium") && (
                  <Text fontSize="xs" color="blue.500" mb={2}>
                    ℹ️ Usando serviço genérico "TV" (preço pode ser compartilhado entre Essencial e Premium)
                  </Text>
                )}
                <VStack align="stretch" spacing={1} mt={2}>
                  <HStack justify="space-between">
                    <Text fontSize="sm" color={mutedText}>
                      Serviço:
                    </Text>
                    <Text fontSize="sm" fontWeight="medium">
                      {tvEssencialService?.name ?? "Não encontrado"}
                    </Text>
                  </HStack>
                  <HStack justify="space-between">
                    <Text fontSize="sm" color={mutedText}>
                      Valor por acesso:
                    </Text>
                    <Text fontSize="sm" fontWeight="medium">
                      {currencyFormatter.format(tvEssencialPricePerAccess)}
                      {tvEssencialService && (
                        <Text as="span" fontSize="xs" color={mutedText} ml={2}>
                          ({tvEssencialService.customPrice !== null && tvEssencialService.customPrice !== undefined
                            ? `custom: ${currencyFormatter.format(tvEssencialService.customPrice)}`
                            : `padrão: ${currencyFormatter.format(tvEssencialService.price)}`}
                          )
                        </Text>
                      )}
                    </Text>
                  </HStack>
                  <HStack justify="space-between">
                    <Text fontSize="sm" color={mutedText}>
                      Quantidade:
                    </Text>
                    <Text fontSize="sm">{tvEssencialAssignments.length} acesso(s)</Text>
                  </HStack>
                  <Divider />
                  <HStack justify="space-between">
                    <Text fontWeight="semibold">Total TV Essencial:</Text>
                    <Text fontWeight="bold" color="teal.500">
                      {currencyFormatter.format(tvEssencialTotal)}
                    </Text>
                  </HStack>
                </VStack>
              </Box>
            )}

            {/* TV Premium */}
            {tvPremiumAssignments.length > 0 && (
              <Box borderWidth={1} borderRadius="lg" p={4} bg={cardBg} borderColor={cardBorder}>
                <HStack justify="space-between" mb={2}>
                  <Text fontWeight="semibold">TV Premium</Text>
                  <Badge colorScheme="pink">{tvPremiumAssignments.length} acesso(s)</Badge>
                </HStack>
                {tvPremiumService && tvPremiumPricePerAccess === 0 && (
                  <Text fontSize="xs" color="orange.500" mb={2}>
                    ⚠️ Valor do serviço está zerado. Verifique o preço no cadastro do serviço.
                  </Text>
                )}
                {tvPremiumService && 
                 normalizeServiceName(tvPremiumService.name).includes("tv") &&
                 !normalizeServiceName(tvPremiumService.name).includes("essencial") &&
                 !normalizeServiceName(tvPremiumService.name).includes("premium") && (
                  <Text fontSize="xs" color="blue.500" mb={2}>
                    ℹ️ Usando serviço genérico "TV" (preço pode ser compartilhado entre Essencial e Premium)
                  </Text>
                )}
                <VStack align="stretch" spacing={1} mt={2}>
                  <HStack justify="space-between">
                    <Text fontSize="sm" color={mutedText}>
                      Serviço:
                    </Text>
                    <Text fontSize="sm" fontWeight="medium">
                      {tvPremiumService?.name ?? "Não encontrado"}
                    </Text>
                  </HStack>
                  <HStack justify="space-between">
                    <Text fontSize="sm" color={mutedText}>
                      Valor por acesso:
                    </Text>
                    <Text fontSize="sm" fontWeight="medium">
                      {currencyFormatter.format(tvPremiumPricePerAccess)}
                      {tvPremiumService && (
                        <Text as="span" fontSize="xs" color={mutedText} ml={2}>
                          ({tvPremiumService.customPrice !== null && tvPremiumService.customPrice !== undefined
                            ? `custom: ${currencyFormatter.format(tvPremiumService.customPrice)}`
                            : `padrão: ${currencyFormatter.format(tvPremiumService.price)}`}
                          )
                        </Text>
                      )}
                    </Text>
                  </HStack>
                  <HStack justify="space-between">
                    <Text fontSize="sm" color={mutedText}>
                      Quantidade:
                    </Text>
                    <Text fontSize="sm">{tvPremiumAssignments.length} acesso(s)</Text>
                  </HStack>
                  <Divider />
                  <HStack justify="space-between">
                    <Text fontWeight="semibold">Total TV Premium:</Text>
                    <Text fontWeight="bold" color="pink.500">
                      {currencyFormatter.format(tvPremiumTotal)}
                    </Text>
                  </HStack>
                </VStack>
              </Box>
            )}

            {/* Cloud */}
            {cloudServices.length > 0 && (
              <Box borderWidth={1} borderRadius="lg" p={4} bg={cardBg} borderColor={cardBorder}>
                <HStack justify="space-between" mb={2}>
                  <Text fontWeight="semibold">Cloud</Text>
                  <Badge colorScheme="blue">{cloudServices.length} serviço(s)</Badge>
                </HStack>
                <VStack align="stretch" spacing={2} mt={2}>
                  {cloudServices.map((service) => (
                    <HStack key={service.id} justify="space-between">
                      <Text fontSize="sm">{service.name}</Text>
                      <Text fontSize="sm" fontWeight="medium">
                        {currencyFormatter.format(service.customPrice ?? service.price)}
                      </Text>
                    </HStack>
                  ))}
                  <Divider />
                  <HStack justify="space-between">
                    <Text fontWeight="semibold">Total Cloud:</Text>
                    <Text fontWeight="bold" color="blue.500">
                      {currencyFormatter.format(cloudTotal)}
                    </Text>
                  </HStack>
                </VStack>
              </Box>
            )}

            {/* Hub */}
            {hubServices.length > 0 && (
              <Box borderWidth={1} borderRadius="lg" p={4} bg={cardBg} borderColor={cardBorder}>
                <HStack justify="space-between" mb={2}>
                  <Text fontWeight="semibold">Hub</Text>
                  <Badge colorScheme="purple">{hubServices.length} serviço(s)</Badge>
                </HStack>
                <VStack align="stretch" spacing={2} mt={2}>
                  {hubServices.map((service) => (
                    <HStack key={service.id} justify="space-between">
                      <Text fontSize="sm">{service.name}</Text>
                      <Text fontSize="sm" fontWeight="medium">
                        {currencyFormatter.format(service.customPrice ?? service.price)}
                      </Text>
                    </HStack>
                  ))}
                  <Divider />
                  <HStack justify="space-between">
                    <Text fontWeight="semibold">Total Hub:</Text>
                    <Text fontWeight="bold" color="purple.500">
                      {currencyFormatter.format(hubTotal)}
                    </Text>
                  </HStack>
                </VStack>
              </Box>
            )}

            {/* Tele */}
            {teleServices.length > 0 && (
              <Box borderWidth={1} borderRadius="lg" p={4} bg={cardBg} borderColor={cardBorder}>
                <HStack justify="space-between" mb={2}>
                  <Text fontWeight="semibold">Tele</Text>
                  <Badge colorScheme="orange">{teleServices.length} serviço(s)</Badge>
                </HStack>
                <VStack align="stretch" spacing={2} mt={2}>
                  {teleServices.map((service) => (
                    <HStack key={service.id} justify="space-between">
                      <Text fontSize="sm">{service.name}</Text>
                      <Text fontSize="sm" fontWeight="medium">
                        {currencyFormatter.format(service.customPrice ?? service.price)}
                      </Text>
                    </HStack>
                  ))}
                  <Divider />
                  <HStack justify="space-between">
                    <Text fontWeight="semibold">Total Tele:</Text>
                    <Text fontWeight="bold" color="orange.500">
                      {currencyFormatter.format(teleTotal)}
                    </Text>
                  </HStack>
                </VStack>
              </Box>
            )}

            {/* Resumo quando não há serviços */}
            {tvEssencialAssignments.length === 0 &&
              tvPremiumAssignments.length === 0 &&
              cloudServices.length === 0 &&
              hubServices.length === 0 &&
              teleServices.length === 0 && (
                <Box textAlign="center" py={8}>
                  <Text color={mutedText}>Nenhum serviço ou acesso vinculado a este cliente.</Text>
                </Box>
              )}

            {/* Total Geral */}
            {(tvEssencialAssignments.length > 0 ||
              tvPremiumAssignments.length > 0 ||
              cloudServices.length > 0 ||
              hubServices.length > 0 ||
              teleServices.length > 0) && (
              <Box borderWidth={2} borderRadius="lg" p={4} bg={cardBg} borderColor="brand.500">
                <HStack justify="space-between">
                  <Text fontSize="lg" fontWeight="bold">
                    Total Geral:
                  </Text>
                  <Text fontSize="xl" fontWeight="bold" color="brand.500">
                    {currencyFormatter.format(grandTotal)}
                  </Text>
                </HStack>
              </Box>
            )}
          </VStack>
        </ModalBody>
        <ModalFooter>
          <Button onClick={onClose}>Fechar</Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}

