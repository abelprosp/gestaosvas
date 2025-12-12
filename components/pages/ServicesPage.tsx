"use client";
import {
  Badge,
  Box,
  Button,
  Flex,
  Heading,
  IconButton,
  Input,
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalFooter,
  ModalHeader,
  ModalOverlay,
  Stack,
  Table,
  Tbody,
  Td,
  Text,
  Textarea,
  Th,
  Thead,
  Tr,
  useColorModeValue,
  useDisclosure,
  useToast,
  FormControl,
  FormLabel,
  Switch,
  FormHelperText,
} from "@chakra-ui/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { FiDownload, FiEdit, FiFilePlus, FiPlus, FiTrash, FiUpload } from "react-icons/fi";
import Papa from "papaparse";
import { api } from "@/lib/api/client";
import { Service } from "@/types";
import { exportToCsv, exportToPdf } from "@/lib/utils/exporters";

interface ServiceFormValues {
  name: string;
  description?: string;
  priceInput: string;
  allowCustomPrice: boolean;
}

interface ServiceFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (values: ServiceFormValues) => Promise<void>;
  defaultValues?: Service;
}

const currencyFormatter = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

function parsePriceInput(value: string): number {
  if (!value) return 0;
  const sanitized = value.replace(/\s/g, "").replace(/\./g, "").replace(",", ".");
  const parsed = Number(sanitized);
  if (Number.isNaN(parsed)) {
    return 0;
  }
  return parsed;
}

function mapFormValuesToPayload(values: ServiceFormValues) {
  return {
    name: values.name,
    description: values.description,
    price: parsePriceInput(values.priceInput),
    allowCustomPrice: values.allowCustomPrice,
  };
}

function ServiceFormModal({ isOpen, onClose, onSubmit, defaultValues }: ServiceFormModalProps) {
  const toast = useToast();
  const [formValues, setFormValues] = useState<ServiceFormValues>(() => ({
    name: defaultValues?.name ?? "",
    description: defaultValues?.description ?? "",
    priceInput:
      defaultValues?.price !== undefined
        ? defaultValues.price.toFixed(2).replace(".", ",")
        : "",
    allowCustomPrice: defaultValues?.allowCustomPrice ?? false,
  }));

  const resetForm = useCallback(
    (values?: ServiceFormValues) => {
      setFormValues({
        name: values?.name ?? defaultValues?.name ?? "",
        description: values?.description ?? defaultValues?.description ?? "",
        priceInput:
          values?.priceInput ??
          (defaultValues?.price !== undefined ? defaultValues.price.toFixed(2).replace(".", ",") : ""),
        allowCustomPrice: values?.allowCustomPrice ?? defaultValues?.allowCustomPrice ?? false,
      });
    },
    [defaultValues],
  );

  useEffect(() => {
    resetForm();
  }, [defaultValues, isOpen, resetForm]);

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    try {
      await onSubmit({
        name: formValues.name.trim(),
        description: formValues.description?.trim() ? formValues.description.trim() : undefined,
        priceInput: formValues.priceInput,
        allowCustomPrice: formValues.allowCustomPrice,
      });
      toast({
        title: defaultValues ? "Serviço atualizado" : "Serviço cadastrado",
        status: "success",
        duration: 3000,
        isClosable: true,
      });
      handleClose();
    } catch (error) {
      console.error(error);
      toast({
        title: "Erro ao salvar serviço",
        status: "error",
        duration: 4000,
        isClosable: true,
      });
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} size="lg">
      <ModalOverlay />
      <ModalContent>
        <ModalHeader>{defaultValues ? "Editar serviço" : "Cadastrar serviço"}</ModalHeader>
        <ModalCloseButton />
        <form onSubmit={handleSubmit}>
          <ModalBody>
            <Stack spacing={4}>
              <FormControl isRequired>
                <FormLabel>Nome do serviço</FormLabel>
                <Input
                  placeholder="Ex: Consultoria empresarial"
                  value={formValues.name}
                  onChange={(event) => setFormValues((prev) => ({ ...prev, name: event.target.value }))}
                />
              </FormControl>
              <FormControl>
                <FormLabel>Descrição</FormLabel>
                <Textarea
                  placeholder="Detalhes do serviço"
                  value={formValues.description ?? ""}
                  onChange={(event) =>
                    setFormValues((prev) => ({ ...prev, description: event.target.value }))
                  }
                  rows={3}
                />
              </FormControl>
              <FormControl isRequired>
                <FormLabel>Valor</FormLabel>
                <Input
                  placeholder="0,00"
                  value={formValues.priceInput}
                  onChange={(event) =>
                    setFormValues((prev) => ({ ...prev, priceInput: event.target.value }))
                  }
                />
              </FormControl>
              <FormControl display="flex" alignItems="center">
                <FormLabel htmlFor="allow-custom-price" mb="0">
                  Permitir preço negociável
                </FormLabel>
                <Switch
                  id="allow-custom-price"
                  isChecked={formValues.allowCustomPrice}
                  colorScheme="brand"
                  onChange={(event) =>
                    setFormValues((prev) => ({ ...prev, allowCustomPrice: event.target.checked }))
                  }
                />
                <FormHelperText ml={3}>
                  Habilite quando o valor for definido caso a caso durante a venda.
                </FormHelperText>
              </FormControl>
            </Stack>
          </ModalBody>
          <ModalFooter gap={3}>
            <Button variant="ghost" onClick={handleClose}>
              Cancelar
            </Button>
            <Button type="submit" colorScheme="brand">
              {defaultValues ? "Atualizar" : "Cadastrar"}
            </Button>
          </ModalFooter>
        </form>
      </ModalContent>
    </Modal>
  );
}

export function ServicesPage() {
  const toast = useToast();
  const queryClient = useQueryClient();
  const formModal = useDisclosure();
  const [selectedService, setSelectedService] = useState<Service | undefined>();
  const [isImporting, setIsImporting] = useState(false);
  const extractErrorMessage = (error: unknown) => {
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
  };

  const { data: services = [], isLoading } = useQuery<Service[]>({
    queryKey: ["services"],
    queryFn: async () => {
      const response = await api.get<Service[]>("/services");
      return response.data;
    },
    staleTime: 5 * 60 * 1000,
    placeholderData: [],
  });

  const createService = useMutation({
    mutationFn: async (values: ServiceFormValues) => {
      await api.post("/services", mapFormValuesToPayload(values));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["services"] });
    },
  });

  const updateService = useMutation({
    mutationFn: async ({ id, values }: { id: string; values: ServiceFormValues }) => {
      await api.patch(`/services/${id}`, mapFormValuesToPayload(values));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["services"] });
    },
  });

  const deleteService = useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/services/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["services"] });
      toast({ title: "Serviço removido", status: "info" });
    },
    onError: (error: unknown) => {
      toast({ title: "Erro ao remover serviço", status: "error", description: extractErrorMessage(error) });
    },
  });

  const handleCreate = async (values: ServiceFormValues) => {
    await createService.mutateAsync(values);
  };

  const handleUpdate = async (values: ServiceFormValues) => {
    if (!selectedService) return;
    await updateService.mutateAsync({ id: selectedService.id, values });
  };

  const openCreateModal = () => {
    setSelectedService(undefined);
    formModal.onOpen();
  };

  const openEditModal = (service: Service) => {
    setSelectedService(service);
    formModal.onOpen();
  };

  const handleExportCsv = () => {
    if (!services.length) {
      toast({ title: "Nenhum serviço para exportar", status: "info" });
      return;
    }

    exportToCsv(
      "servicos.csv",
      services.map((service) => ({
        Nome: service.name,
        Descricao: service.description ?? "",
        Valor: currencyFormatter.format(service.price),
        CriadoEm: service.createdAt,
      })),
    );
  };

  const handleExportPdf = () => {
    if (!services.length) {
      toast({ title: "Nenhum serviço para exportar", status: "info" });
      return;
    }

    exportToPdf(
      "Relatorio_Servicos",
      ["Nome", "Descrição", "Valor"],
      services.map((service) => [service.name, service.description ?? "-", currencyFormatter.format(service.price)]),
    );
  };

  const handleImportCsv = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsImporting(true);
    type ServiceCsvRow = {
      name?: string;
      description?: string;
      price?: string | number;
      priceInput?: string | number;
      valor?: string | number;
      allowCustomPrice?: string | number | boolean;
    };

    Papa.parse<ServiceCsvRow>(file, {
      header: true,
      skipEmptyLines: true,
      complete: async (results) => {
        const { data, errors } = results;
        if (errors.length) {
          toast({ title: "CSV inválido", description: errors[0].message, status: "error" });
          setIsImporting(false);
          return;
        }

        try {
          for (const row of data) {
            const name = row.name ?? "";
            if (!name) continue;
            const priceSource = row.priceInput ?? row.price ?? row.valor ?? "";
            const parsedPrice =
              typeof priceSource === "number" ? priceSource : parsePriceInput(String(priceSource));
            if (parsedPrice === undefined || Number.isNaN(parsedPrice)) {
              continue;
            }

            const allowCustom =
              typeof row.allowCustomPrice === "boolean"
                ? row.allowCustomPrice
                : String(row.allowCustomPrice ?? "")
                    .trim()
                    .toLowerCase()
                    .startsWith("s");

            await api.post("/services", {
              name,
              description: row.description,
              price: parsedPrice ?? 0,
              allowCustomPrice: allowCustom,
            });
          }
          toast({ title: "Importação concluída", status: "success" });
          queryClient.invalidateQueries({ queryKey: ["services"] });
        } catch (error) {
          toast({ title: "Erro ao importar", status: "error", description: extractErrorMessage(error) });
        } finally {
          setIsImporting(false);
          const input = document.getElementById("services-import-input") as HTMLInputElement | null;
          if (input) input.value = "";
        }
      },
    });
  };

  const sectionBg = useColorModeValue("rgba(255,255,255,0.78)", "rgba(15, 23, 42, 0.7)");
  const sectionBorder = useColorModeValue("rgba(226,232,240,0.6)", "rgba(45, 55, 72, 0.6)");
  const mutedText = useColorModeValue("gray.500", "gray.400");

  const sortedServices = useMemo(
    () =>
      [...services].sort((a, b) =>
        a.name.localeCompare(b.name, "pt-BR", { sensitivity: "base" }),
      ),
    [services],
  );

  return (
    <Stack spacing={{ base: 6, md: 8 }}>
      <Flex
        direction={{ base: "column", md: "row" }}
        align={{ base: "flex-start", md: "center" }}
        justify="space-between"
        gap={{ base: 4, md: 6 }}
      >
        <Box>
          <Heading size="lg">Serviços</Heading>
          <Text color={mutedText}>Cadastre serviços e vincule-os aos clientes.</Text>
        </Box>
        <Stack
          spacing={3}
          direction={{ base: "column", lg: "row" }}
          align={{ base: "stretch", lg: "center" }}
          justifyContent="flex-end"
          w="full"
        >
          <Button leftIcon={<FiDownload />} variant="outline" onClick={handleExportCsv} w={{ base: "full", lg: "auto" }}>
            Exportar CSV
          </Button>
          <Button leftIcon={<FiFilePlus />} variant="outline" onClick={handleExportPdf} w={{ base: "full", lg: "auto" }}>
            Exportar PDF
          </Button>
          <Button
            leftIcon={<FiUpload />}
            variant="outline"
            isLoading={isImporting}
            onClick={() => document.getElementById("services-import-input")?.click()}
            w={{ base: "full", lg: "auto" }}
          >
            Importar CSV
          </Button>
          <Button
            leftIcon={<FiPlus />}
            colorScheme="brand"
            onClick={openCreateModal}
            w={{ base: "full", lg: "auto" }}
          >
            Novo serviço
          </Button>
          <input
            id="services-import-input"
            type="file"
            accept=".csv"
            style={{ display: "none" }}
            onChange={handleImportCsv}
          />
        </Stack>
      </Flex>

      <Box
        bg={sectionBg}
        borderRadius="2xl"
        p={{ base: 4, md: 6 }}
        boxShadow="lg"
        borderWidth={1}
        borderColor={sectionBorder}
        transition="background-color 0.3s ease, transform 0.3s ease"
      >
        <Box overflowX="auto">
          <Table variant="simple" size={{ base: "sm", md: "md" }}>
            <Thead>
              <Tr>
                <Th>Serviço</Th>
                <Th>Descrição</Th>
                <Th>Valor</Th>
                <Th textAlign="right">Ações</Th>
              </Tr>
            </Thead>
            <Tbody>
              {isLoading && services.length === 0 &&
                Array.from({ length: 4 }).map((_, index) => (
                  <Tr key={index}>
                    <Td colSpan={4}>
                      <Text>Carregando...</Text>
                    </Td>
                  </Tr>
                ))}
              {!isLoading && sortedServices.length === 0 && (
                <Tr>
                  <Td colSpan={4} color={mutedText}>
                    Nenhum serviço cadastrado.
                  </Td>
                </Tr>
              )}
              {sortedServices.map((service) => (
                <Tr key={service.id}>
                  <Td>
                    <Stack spacing={1} align="flex-start">
                      <Text fontWeight="semibold">{service.name}</Text>
                      <Text display={{ base: "block", md: "none" }} fontSize="sm" color={mutedText}>
                        {service.description ?? "—"}
                      </Text>
                      <Badge colorScheme="purple" fontSize="0.75rem">
                        Última atualização: {new Date(service.updatedAt).toLocaleDateString("pt-BR")}
                      </Badge>
                    </Stack>
                  </Td>
                  <Td maxW="320px">
                    <Text noOfLines={3} color={mutedText}>
                      {service.description ?? "—"}
                    </Text>
                  </Td>
                  <Td fontWeight="semibold">
                    {currencyFormatter.format(service.price)}
                    {service.allowCustomPrice && (
                      <Badge ml={2} colorScheme="orange">
                        Negociável
                      </Badge>
                    )}
                  </Td>
                  <Td textAlign="right">
                    <Stack direction="row" spacing={2} justify="flex-end">
                      <IconButton
                        aria-label="Editar serviço"
                        icon={<FiEdit />}
                        variant="ghost"
                        onClick={() => openEditModal(service)}
                        isDisabled={updateService.isPending}
                      />
                      <IconButton
                        aria-label="Excluir serviço"
                        icon={<FiTrash />}
                        variant="ghost"
                        onClick={() => deleteService.mutate(service.id)}
                        isDisabled={deleteService.isPending}
                      />
                    </Stack>
                  </Td>
                </Tr>
              ))}
            </Tbody>
          </Table>
        </Box>
      </Box>

      <ServiceFormModal
        isOpen={formModal.isOpen}
        onClose={formModal.onClose}
        onSubmit={selectedService ? handleUpdate : handleCreate}
        defaultValues={selectedService}
      />
    </Stack>
  );
}

