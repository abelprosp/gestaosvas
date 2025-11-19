"use client";
import {
  Button,
  FormControl,
  FormLabel,
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalFooter,
  ModalHeader,
  ModalOverlay,
  Select,
  Textarea,
  useToast,
  VStack,
  Input,
} from "@chakra-ui/react";
import { useForm } from "react-hook-form";
import { Client, ContractTemplate } from "@/types";

export interface ContractCreateValues {
  title: string;
  clientId: string;
  templateId?: string;
  contentOverride?: string;
  customFields?: Record<string, string>;
}

interface ContractCreateModalProps {
  isOpen: boolean;
  onClose: () => void;
  clients: Client[];
  templates: ContractTemplate[];
  onCreate: (values: ContractCreateValues) => Promise<void>;
}

export function ContractCreateModal({
  isOpen,
  onClose,
  clients,
  templates,
  onCreate,
}: ContractCreateModalProps) {
  const toast = useToast();
  const {
    register,
    handleSubmit,
    reset,
    formState: { isSubmitting },
  } = useForm<ContractCreateValues & { customFieldsRaw: string }>({
    defaultValues: {
      title: "Contrato de prestação",
      customFieldsRaw: "",
    },
  });

  const handleClose = () => {
    reset({ title: "Contrato de prestação", customFieldsRaw: "" });
    onClose();
  };

  const onSubmit = async (
    values: ContractCreateValues & { customFieldsRaw?: string },
  ) => {
    const customFields: Record<string, string> = {};
    if (values.customFieldsRaw) {
      values.customFieldsRaw.split("\n").forEach((line) => {
        const [key, ...rest] = line.split("=");
        if (key && rest.length > 0) {
          customFields[key.trim()] = rest.join("=").trim();
        }
      });
    }

    try {
      await onCreate({
        title: values.title,
        clientId: values.clientId,
        templateId: values.templateId || undefined,
        contentOverride: values.contentOverride || undefined,
        customFields: Object.keys(customFields).length ? customFields : undefined,
      });
      toast({ title: "Contrato gerado", status: "success" });
      handleClose();
    } catch (error) {
      console.error(error);
      toast({ title: "Falha ao criar contrato", status: "error" });
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} size="2xl">
      <ModalOverlay />
      <ModalContent>
        <ModalHeader>Novo contrato</ModalHeader>
        <ModalCloseButton />
        <form onSubmit={handleSubmit(onSubmit)}>
          <ModalBody>
            <VStack spacing={4} align="stretch">
              <FormControl isRequired>
                <FormLabel>Título do contrato</FormLabel>
                <Input placeholder="Contrato de prestação" {...register("title", { required: true })} />
              </FormControl>
              <FormControl isRequired>
                <FormLabel>Cliente</FormLabel>
                <Select placeholder="Selecione um cliente" {...register("clientId", { required: true })}>
                  {clients.map((client) => (
                    <option key={client.id} value={client.id}>
                      {client.name} · {client.document}
                    </option>
                  ))}
                </Select>
              </FormControl>
              <FormControl>
                <FormLabel>Template base</FormLabel>
                <Select placeholder="Selecione um template" {...register("templateId")}
                >
                  {templates.map((template) => (
                    <option key={template.id} value={template.id}>
                      {template.name}
                    </option>
                  ))}
                </Select>
              </FormControl>
              <FormControl>
                <FormLabel>Conteúdo personalizado</FormLabel>
                <Textarea
                  placeholder="Cole um conteúdo customizado (opcional)"
                  rows={6}
                  {...register("contentOverride")}
                />
              </FormControl>
              <FormControl>
                <FormLabel>Campos extras (chave=valor por linha)</FormLabel>
                <Textarea
                  placeholder={`ex:\nvelocidade=500MB\nadesao=12 meses`}
                  rows={4}
                  {...register("customFieldsRaw")}
                />
              </FormControl>
            </VStack>
          </ModalBody>
          <ModalFooter gap={3}>
            <Button variant="ghost" onClick={handleClose}>
              Cancelar
            </Button>
            <Button type="submit" isLoading={isSubmitting}>
              Gerar contrato
            </Button>
          </ModalFooter>
        </form>
      </ModalContent>
    </Modal>
  );
}










