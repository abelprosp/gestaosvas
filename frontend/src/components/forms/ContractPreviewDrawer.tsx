import {
  Badge,
  Box,
  Button,
  Divider,
  Drawer,
  DrawerBody,
  DrawerCloseButton,
  DrawerContent,
  DrawerFooter,
  DrawerHeader,
  DrawerOverlay,
  HStack,
  Text,
  useClipboard,
  useToast,
  VStack,
} from "@chakra-ui/react";
import { Contract } from "../../types";
import { formatDateTime } from "../../utils/format";

interface ContractPreviewDrawerProps {
  contract?: Contract;
  isOpen: boolean;
  onClose: () => void;
  onSend: () => Promise<void>;
  onSign: () => Promise<void>;
  onCancel: () => Promise<void>;
}

export function ContractPreviewDrawer({
  contract,
  isOpen,
  onClose,
  onSend,
  onSign,
  onCancel,
}: ContractPreviewDrawerProps) {
  const toast = useToast();
  const { onCopy } = useClipboard(contract?.signUrl ?? "");

  const handleCopy = () => {
    onCopy();
    toast({ title: "Link de assinatura copiado", status: "success" });
  };

  return (
    <Drawer isOpen={isOpen} placement="right" size="xl" onClose={onClose}>
      <DrawerOverlay />
      <DrawerContent>
        <DrawerCloseButton />
        <DrawerHeader>
          <HStack justify="space-between">
            <Box>
              <Text fontWeight="semibold">{contract?.title}</Text>
              <Text fontSize="sm" color="gray.500">
                {contract?.client.name}
              </Text>
            </Box>
            {contract && (
              <Badge
                colorScheme={
                  contract.status === "SIGNED"
                    ? "green"
                    : contract.status === "SENT"
                    ? "blue"
                    : contract.status === "CANCELLED"
                    ? "red"
                    : "gray"
                }
                borderRadius="full"
                px={3}
                py={1}
              >
                {contract.status}
              </Badge>
            )}
          </HStack>
        </DrawerHeader>
        <DrawerBody>
          {!contract ? (
            <Text>Selecione um contrato para visualizar.</Text>
          ) : (
            <VStack align="stretch" spacing={6}>
              <Box bg="gray.50" borderRadius="xl" p={4}>
                <Text fontWeight="semibold">Detalhes</Text>
                <Text fontSize="sm" color="gray.500">
                  Criado em {formatDateTime(contract.createdAt)}
                </Text>
                {contract.sentAt && (
                  <Text fontSize="sm" color="gray.500">
                    Enviado em {formatDateTime(contract.sentAt)}
                  </Text>
                )}
                {contract.signedAt && (
                  <Text fontSize="sm" color="gray.500">
                    Assinado em {formatDateTime(contract.signedAt)}
                  </Text>
                )}
              </Box>

              {contract.signUrl && (
                <Box bg="gray.800" color="white" borderRadius="xl" p={4}>
                  <Text fontWeight="semibold">Link de assinatura</Text>
                  <Text fontSize="sm" mt={2} wordBreak="break-all">
                    {contract.signUrl}
                  </Text>
                  <Button mt={3} size="sm" onClick={handleCopy}>
                    Copiar link
                  </Button>
                </Box>
              )}

              <Divider />

              <Box borderWidth={1} borderRadius="xl" p={5} maxH="60vh" overflowY="auto">
                <Text whiteSpace="pre-wrap" fontFamily="'Inter', sans-serif">
                  {contract.content}
                </Text>
              </Box>
            </VStack>
          )}
        </DrawerBody>
        <DrawerFooter gap={3}>
          <Button variant="ghost" onClick={onClose}>
            Fechar
          </Button>
          <Button
            colorScheme="red"
            onClick={onCancel}
            isDisabled={!contract || contract.status === "CANCELLED"}
          >
            Cancelar
          </Button>
          <Button
            colorScheme="green"
            onClick={onSign}
            isDisabled={!contract || contract.status !== "SENT"}
          >
            Confirmar assinatura
          </Button>
          <Button
            onClick={onSend}
            isDisabled={!contract || contract.status === "SIGNED" || contract.status === "SENT"}
          >
            Enviar para assinatura
          </Button>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
}










