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

  // Encontrar serviço TV único (TV Essencial e Premium são fragmentos deste serviço)
  const tvService = (client.services ?? []).find((service) => {
    const normalized = normalizeServiceName(service.name);
    // Encontra serviço que contém "tv" mas não contém "essencial" nem "premium"
    return (
      normalized.includes("tv") &&
      !normalized.includes("essencial") &&
      !normalized.includes("premium")
    );
  });

  // Calcular valores TV
  // TV Essencial e Premium são fragmentos do serviço TV único
  // Prioridade: customPriceEssencial/customPricePremium > customPrice > price > 0
  const tvEssencialPricePerAccess =
    tvService?.customPriceEssencial !== null && tvService?.customPriceEssencial !== undefined
      ? tvService.customPriceEssencial
      : tvService?.customPrice !== null && tvService?.customPrice !== undefined
      ? tvService.customPrice
      : tvService?.price ?? 0;
  const tvEssencialTotal = tvEssencialPricePerAccess * tvEssencialAssignments.length;

  const tvPremiumPricePerAccess =
    tvService?.customPricePremium !== null && tvService?.customPricePremium !== undefined
      ? tvService.customPricePremium
      : tvService?.customPrice !== null && tvService?.customPrice !== undefined
      ? tvService.customPrice
      : tvService?.price ?? 0;
  const tvPremiumTotal = tvPremiumPricePerAccess * tvPremiumAssignments.length;

  // Debug: log dos serviços encontrados (depois de calcular os preços)
  if (isOpen) {
    console.log("🔍 Debug ClientValuesModal:", {
      clientName: client.name,
      allServices: (client.services ?? []).map((s) => ({
        id: s.id,
        name: s.name,
        price: s.price,
        customPrice: s.customPrice,
        customPriceEssencial: s.customPriceEssencial,
        customPricePremium: s.customPricePremium,
        allowCustomPrice: s.allowCustomPrice,
      })),
      tvService: tvService
        ? {
            name: tvService.name,
            price: tvService.price,
            customPrice: tvService.customPrice,
            customPriceEssencial: tvService.customPriceEssencial,
            customPricePremium: tvService.customPricePremium,
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

  // Calcular totais por tipo
  const cloudTotal = cloudServices.reduce((sum, service) => {
    const price = service.customPrice ?? service.price;
    return sum + price;
  }, 0);

  // Valor total geral
  const grandTotal = tvEssencialTotal + tvPremiumTotal + cloudTotal;

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
            {/* TV Essencial */}
            {tvEssencialAssignments.length > 0 && (
              <Box borderWidth={1} borderRadius="lg" p={4} bg={cardBg} borderColor={cardBorder}>
                <HStack justify="space-between" mb={2}>
                  <Text fontWeight="semibold">TV Essencial</Text>
                  <Badge colorScheme="teal">{tvEssencialAssignments.length} acesso(s)</Badge>
                </HStack>
                {tvService && tvEssencialPricePerAccess === 0 && (
                  <Text fontSize="xs" color="orange.500" mb={2}>
                    ⚠️ Valor do serviço está zerado. Verifique o preço no cadastro do serviço.
                  </Text>
                )}
                <VStack align="stretch" spacing={1} mt={2}>
                  <HStack justify="space-between">
                    <Text fontSize="sm" color={mutedText}>
                      Valor por acesso:
                    </Text>
                    <Text fontSize="sm" fontWeight="medium">
                      {currencyFormatter.format(tvEssencialPricePerAccess)}
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
                {tvService && tvPremiumPricePerAccess === 0 && (
                  <Text fontSize="xs" color="orange.500" mb={2}>
                    ⚠️ Valor do serviço está zerado. Verifique o preço no cadastro do serviço.
                  </Text>
                )}
                <VStack align="stretch" spacing={1} mt={2}>
                  <HStack justify="space-between">
                    <Text fontSize="sm" color={mutedText}>
                      Valor por acesso:
                    </Text>
                    <Text fontSize="sm" fontWeight="medium">
                      {currencyFormatter.format(tvPremiumPricePerAccess)}
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

            {/* Resumo quando não há serviços */}
            {tvEssencialAssignments.length === 0 &&
              tvPremiumAssignments.length === 0 &&
              cloudServices.length === 0 && (
                <Box textAlign="center" py={8}>
                  <Text color={mutedText}>Nenhum serviço ou acesso vinculado a este cliente.</Text>
                </Box>
              )}

            {/* Total Geral */}
            {(tvEssencialAssignments.length > 0 ||
              tvPremiumAssignments.length > 0 ||
              cloudServices.length > 0) && (
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
