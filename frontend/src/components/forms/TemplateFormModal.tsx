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
  Switch,
  Textarea,
  Input,
  VStack,
  useToast,
} from "@chakra-ui/react";
import { useForm } from "react-hook-form";
import { ContractTemplate } from "../../types";

export interface TemplateFormValues {
  name: string;
  content: string;
  active: boolean;
}

interface TemplateFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (values: TemplateFormValues) => Promise<void>;
  defaultValues?: ContractTemplate;
}

export function TemplateFormModal({
  isOpen,
  onClose,
  onSubmit,
  defaultValues,
}: TemplateFormModalProps) {
  const toast = useToast();
  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { isSubmitting },
  } = useForm<TemplateFormValues>({
    defaultValues: {
      name: defaultValues?.name ?? "",
      content: defaultValues?.content ?? "",
      active: defaultValues?.active ?? true,
    },
  });

  const active = watch("active");

  const handleClose = () => {
    reset({
      name: defaultValues?.name ?? "",
      content: defaultValues?.content ?? "",
      active: defaultValues?.active ?? true,
    });
    onClose();
  };

  const onSubmitInternal = async (values: TemplateFormValues) => {
    try {
      await onSubmit(values);
      toast({
        title: defaultValues ? "Template atualizado" : "Template criado",
        status: "success",
      });
      handleClose();
    } catch (error) {
      console.error(error);
      toast({ title: "Erro ao salvar template", status: "error" });
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} size="4xl">
      <ModalOverlay />
      <ModalContent>
        <ModalHeader>{defaultValues ? "Editar template" : "Novo template"}</ModalHeader>
        <ModalCloseButton />
        <form onSubmit={handleSubmit(onSubmitInternal)}>
          <ModalBody>
            <VStack align="stretch" spacing={4}>
              <FormControl isRequired>
                <FormLabel>Nome</FormLabel>
                <Input placeholder="Contrato padrão" {...register("name", { required: true })} />
              </FormControl>
              <FormControl display="flex" alignItems="center" justifyContent="space-between">
                <FormLabel mb="0">Ativo</FormLabel>
                <Switch
                  isChecked={active}
                  onChange={(event) => setValue("active", event.target.checked)}
                />
              </FormControl>
              <FormControl isRequired>
                <FormLabel>Conteúdo</FormLabel>
                <Textarea
                  rows={12}
                  fontFamily="'JetBrains Mono', monospace"
                  placeholder="Use placeholders como {{clientName}}, {{currentDate}}, {{linesList}}"
                  {...register("content", { required: true })}
                />
              </FormControl>
            </VStack>
          </ModalBody>
          <ModalFooter gap={3}>
            <Button variant="ghost" onClick={handleClose}>
              Cancelar
            </Button>
            <Button type="submit" isLoading={isSubmitting}>
              Salvar template
            </Button>
          </ModalFooter>
        </form>
      </ModalContent>
    </Modal>
  );
}










