"use client";
import {
  AlertDialog,
  AlertDialogBody,
  AlertDialogContent,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogOverlay,
  Badge,
  Box,
  Button,
  Flex,
  Heading,
  IconButton,
  SimpleGrid,
  Skeleton,
  Text,
  useDisclosure,
  useToast,
  VStack,
  useColorModeValue,
  Stack,
  Input,
} from "@chakra-ui/react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { FiEdit, FiPlus, FiTrash, FiDownload, FiFilePlus, FiUpload } from "react-icons/fi";
import { api } from "@/lib/api/client";
import { ContractTemplate } from "@/types";
import {
  TemplateFormModal,
  TemplateFormValues,
} from "@/components/forms/TemplateFormModal";
import { formatDate } from "@/lib/utils/format";
import { exportToCsv, exportToPdf } from "@/lib/utils/exporters";
import Papa from "papaparse";
import { useAuth } from "@/context/AuthContext";

export function TemplatesPage() {
  const toast = useToast();
  const queryClient = useQueryClient();
  const formModal = useDisclosure();
  const [selectedTemplate, setSelectedTemplate] = useState<ContractTemplate | undefined>();
  const [isImporting, setIsImporting] = useState(false);
  const deleteDialog = useDisclosure();
  const [templatePendingDelete, setTemplatePendingDelete] = useState<ContractTemplate | null>(null);
  const [deletePassword, setDeletePassword] = useState("");
  const cancelDeleteRef = useRef<HTMLButtonElement | null>(null);
  const { isAdmin } = useAuth();
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

  const { data: templates = [], isLoading } = useQuery<ContractTemplate[]>({
    queryKey: ["templates"],
    queryFn: async () => {
      const response = await api.get<ContractTemplate[]>("/templates");
      return response.data;
    },
    staleTime: 5 * 60 * 1000,
    placeholderData: [],
  });

  const createTemplate = useMutation({
    mutationFn: async (values: TemplateFormValues) => {
      await api.post("/templates", values);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["templates"] });
    },
  });

  const updateTemplate = useMutation({
    mutationFn: async ({ id, values }: { id: string; values: TemplateFormValues }) => {
      await api.put(`/templates/${id}`, values);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["templates"] });
    },
  });

  const deleteTemplate = useMutation({
    mutationFn: async ({ id, password }: { id: string; password: string }) => {
      await api.delete(`/templates/${id}`, { data: { password } });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["templates"] });
    },
  });

  const handleCreate = async (values: TemplateFormValues) => {
    await createTemplate.mutateAsync(values);
  };

  const handleUpdate = async (values: TemplateFormValues) => {
    if (!selectedTemplate) return;
    await updateTemplate.mutateAsync({ id: selectedTemplate.id, values });
  };

  const closeDeleteDialog = () => {
    deleteDialog.onClose();
    setTemplatePendingDelete(null);
    setDeletePassword("");
  };

  const requestDelete = (template: ContractTemplate) => {
    if (!isAdmin) {
      toast({
        title: "Acesso restrito",
        description: "Somente administradores podem excluir templates.",
        status: "warning",
      });
      return;
    }
    setTemplatePendingDelete(template);
    setDeletePassword("");
    deleteDialog.onOpen();
  };

  const handleConfirmDelete = async () => {
    if (!templatePendingDelete) return;
    if (!deletePassword.trim()) {
      toast({ title: "Informe sua senha", status: "warning" });
      return;
    }
    try {
      await deleteTemplate.mutateAsync({ id: templatePendingDelete.id, password: deletePassword });
      toast({ title: "Template removido", status: "success" });
      closeDeleteDialog();
    } catch (error) {
      console.error(error);
      toast({ title: "Erro ao remover template", status: "error", description: extractErrorMessage(error) });
    }
  };

  const handleExportCsv = () => {
    if (!templates.length) {
      toast({ title: "Nenhum template para exportar", status: "info" });
      return;
    }

    exportToCsv(
      "templates.csv",
      templates.map((template) => ({
        Nome: template.name,
        Ativo: template.active ? "Sim" : "Não",
        Atualizado: formatDate(template.updatedAt),
      })),
    );
  };

  const handleExportPdf = () => {
    if (!templates.length) {
      toast({ title: "Nenhum template para exportar", status: "info" });
      return;
    }

    exportToPdf(
      "Relatorio_Templates",
      ["Nome", "Ativo", "Atualizado"],
      templates.map((template) => [template.name, template.active ? "Sim" : "Não", formatDate(template.updatedAt)]),
    );
  };

  const handleImportCsv = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsImporting(true);
    Papa.parse<Record<string, string>>(file, {
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
            if (!row.name || !row.content) continue;
            await api.post("/templates", {
              name: row.name,
              content: row.content,
              active: row.active ? row.active.toLowerCase() === "sim" || row.active === "true" : true,
            });
          }
          toast({ title: "Templates importados", status: "success" });
          queryClient.invalidateQueries({ queryKey: ["templates"] });
        } catch (error) {
          toast({ title: "Erro ao importar", status: "error", description: extractErrorMessage(error) });
        } finally {
          setIsImporting(false);
          const input = document.getElementById("templates-import-input") as HTMLInputElement | null;
          if (input) input.value = "";
        }
      },
    });
  };

  const openCreateModal = () => {
    setSelectedTemplate(undefined);
    formModal.onOpen();
  };

  const openEditModal = (template: ContractTemplate) => {
    setSelectedTemplate(template);
    formModal.onOpen();
  };

  const sectionBg = useColorModeValue("rgba(255,255,255,0.78)", "rgba(15, 23, 42, 0.7)");
  const sectionBorder = useColorModeValue("rgba(226,232,240,0.6)", "rgba(45,55,72,0.6)");
  const mutedText = useColorModeValue("gray.500", "gray.400");
  const codeBg = useColorModeValue("gray.900", "gray.700");
  const codeColor = useColorModeValue("teal.100", "teal.200");

  return (
    <VStack align="stretch" spacing={{ base: 6, md: 8 }}>
      <Flex
        direction={{ base: "column", md: "row" }}
        align={{ base: "flex-start", md: "center" }}
        justify="space-between"
        gap={{ base: 4, md: 6 }}
        flexWrap="wrap"
      >
        <Box>
          <Heading size="lg">Templates de contrato</Heading>
          <Text color={mutedText}>
            Centralize modelos e personalize com placeholders dinâmicos.
          </Text>
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
            onClick={() => document.getElementById("templates-import-input")?.click()}
            w={{ base: "full", lg: "auto" }}
          >
            Importar CSV
          </Button>
          <Button leftIcon={<FiPlus />} onClick={openCreateModal} colorScheme="brand" w={{ base: "full", lg: "auto" }}>
            Novo template
          </Button>
        </Stack>
        <input
          id="templates-import-input"
          type="file"
          accept=".csv"
          style={{ display: "none" }}
          onChange={handleImportCsv}
        />
      </Flex>

      <SimpleGrid columns={{ base: 1, lg: 2 }} spacing={{ base: 4, md: 6 }}>
        {isLoading &&
          Array.from({ length: 4 }).map((_, index) => (
            <Skeleton key={index} height="220px" borderRadius="2xl" />
          ))}

        {!isLoading && templates.length === 0 && (
          <Text color={mutedText}>Nenhum template cadastrado ainda.</Text>
        )}

        {templates.map((template) => (
          <Box
            key={template.id}
            bg={sectionBg}
            borderRadius="2xl"
            p={6}
            boxShadow="lg"
            borderWidth={1}
            borderColor={sectionBorder}
            transition="background-color 0.3s ease, transform 0.3s ease"
          >
            <Flex justify="space-between" align="start" mb={4}>
              <Box>
                <Heading size="md">{template.name}</Heading>
                <Text fontSize="sm" color={mutedText}>
                  Atualizado em {formatDate(template.updatedAt)}
                </Text>
              </Box>
              <Badge colorScheme={template.active ? "green" : "red"} borderRadius="full" px={3} py={1}>
                {template.active ? "Ativo" : "Inativo"}
              </Badge>
            </Flex>
            <Box
              bg={codeBg}
              color={codeColor}
              borderRadius="lg"
              p={4}
              fontFamily="'JetBrains Mono', monospace"
              fontSize="sm"
              height="160px"
              overflowY="auto"
            >
              {template.content}
            </Box>
            <Flex justify="flex-end" gap={2} mt={4}>
              <IconButton
                aria-label="Editar"
                icon={<FiEdit />}
                variant="ghost"
                onClick={() => openEditModal(template)}
              />
              <IconButton
                aria-label="Excluir"
                icon={<FiTrash />}
                variant="ghost"
                onClick={() => requestDelete(template)}
                isDisabled={!isAdmin}
              />
            </Flex>
          </Box>
        ))}
      </SimpleGrid>

      <TemplateFormModal
        isOpen={formModal.isOpen}
        onClose={formModal.onClose}
        onSubmit={selectedTemplate ? handleUpdate : handleCreate}
        defaultValues={selectedTemplate}
      />

      <AlertDialog
        isOpen={deleteDialog.isOpen}
        leastDestructiveRef={cancelDeleteRef}
        onClose={closeDeleteDialog}
      >
        <AlertDialogOverlay>
          <AlertDialogContent>
            <AlertDialogHeader>Confirmar exclusão</AlertDialogHeader>
            <AlertDialogBody>
              <Text mb={3}>
                Digite sua senha para excluir o template{" "}
                <strong>{templatePendingDelete?.name ?? "selecionado"}</strong>. Esta ação é permanente.
              </Text>
              <Input
                type="password"
                placeholder="Sua senha de acesso"
                value={deletePassword}
                onChange={(event) => setDeletePassword(event.target.value)}
              />
            </AlertDialogBody>
            <AlertDialogFooter>
              <Button ref={cancelDeleteRef} onClick={closeDeleteDialog}>
                Cancelar
              </Button>
              <Button colorScheme="red" ml={3} onClick={handleConfirmDelete} isLoading={deleteTemplate.isPending}>
                Excluir
              </Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialogOverlay>
      </AlertDialog>
    </VStack>
  );
}

