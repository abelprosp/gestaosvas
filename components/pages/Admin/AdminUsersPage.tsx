"use client";
import {
  AlertDialog,
  AlertDialogBody,
  AlertDialogContent,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogOverlay,
  Box,
  Button,
  Flex,
  FormControl,
  FormHelperText,
  FormLabel,
  Heading,
  HStack,
  IconButton,
  Input,
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalFooter,
  ModalHeader,
  ModalOverlay,
  Select,
  Stack,
  Table,
  Tbody,
  Td,
  Text,
  Th,
  Thead,
  Tr,
  useColorModeValue,
  useDisclosure,
  useToast,
  Alert,
  AlertIcon,
} from "@chakra-ui/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FormEvent, useRef, useState } from "react";
import { FiEdit, FiTrash } from "react-icons/fi";
import { api } from "@/lib/api/client";
import { useAuth } from "@/context/AuthContext";

interface AdminUser {
  id: string;
  email: string | null;
  role: string;
  name: string | null;
  createdAt?: string | null;
  lastSignInAt?: string | null;
}

export function AdminUsersPage() {
  const queryClient = useQueryClient();
  const toast = useToast();
  const { isAdmin, role, user } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [roleField, setRoleField] = useState("user");
  const [name, setName] = useState("");
  const editModal = useDisclosure();
  const deleteDialog = useDisclosure();
  const cancelDeleteRef = useRef<HTMLButtonElement>(null);
  const [userToDelete, setUserToDelete] = useState<AdminUser | null>(null);
  const [editingUser, setEditingUser] = useState<AdminUser | null>(null);
  const [editEmail, setEditEmail] = useState("");
  const [editName, setEditName] = useState("");
  const [editRole, setEditRole] = useState("user");
  const [editPassword, setEditPassword] = useState("");
  const cardBg = useColorModeValue("rgba(255,255,255,0.78)", "rgba(15, 23, 42, 0.7)");
  const borderColor = useColorModeValue("rgba(226,232,240,0.6)", "rgba(45,55,72,0.6)");
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

  const { data: users = [], isLoading, error: usersError } = useQuery<AdminUser[]>({
    queryKey: ["admin", "users"],
    queryFn: async () => {
      try {
        const response = await api.get<AdminUser[]>("/admin/users");
        return response.data;
      } catch (error: any) {
        console.error("Erro ao buscar usuários:", error);
        
        // Extrair mensagem de erro mais detalhada
        let errorMessage = "Erro ao carregar usuários";
        if (error?.response?.data?.message) {
          errorMessage = error.response.data.message;
        } else if (error?.response?.data?.details) {
          errorMessage = typeof error.response.data.details === "string" 
            ? error.response.data.details 
            : JSON.stringify(error.response.data.details);
        } else if (error?.message) {
          errorMessage = error.message;
        }
        
        console.error("Detalhes do erro:", {
          status: error?.response?.status,
          data: error?.response?.data,
          message: errorMessage,
        });
        
        toast({
          title: "Erro ao carregar usuários",
          description: errorMessage,
          status: "error",
          duration: 10000,
          isClosable: true,
        });
        throw error;
      }
    },
    retry: false,
  });

  const createUser = useMutation({
    mutationFn: async () => {
      const response = await api.post("/admin/users", {
        email,
        password,
        role: roleField,
        name: name.trim() ? name.trim() : undefined,
      });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "users"] });
      toast({ title: "Usuário criado", status: "success" });
      setEmail("");
      setPassword("");
      setRoleField("user");
      setName("");
    },
    onError: (error: unknown) => {
      toast({
        title: "Erro ao criar usuário",
        status: "error",
        description: extractErrorMessage(error),
      });
    },
  });

  const updateUser = useMutation({
    mutationFn: async ({ id, payload }: { id: string; payload: Record<string, unknown> }) => {
      const response = await api.patch(`/admin/users/${id}`, payload);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "users"] });
      toast({ title: "Usuário atualizado", status: "success" });
      setEditingUser(null);
      setEditPassword("");
      editModal.onClose();
    },
    onError: (error: unknown) => {
      toast({
        title: "Erro ao atualizar usuário",
        status: "error",
        description: extractErrorMessage(error),
      });
    },
  });

  const deleteUser = useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/admin/users/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "users"] });
      toast({ title: "Usuário removido", status: "info" });
      deleteDialog.onClose();
      setUserToDelete(null);
    },
    onError: (error: unknown) => {
      toast({
        title: "Erro ao remover usuário",
        status: "error",
        description: extractErrorMessage(error),
      });
    },
  });

  const handleDeleteClick = (user: AdminUser) => {
    setUserToDelete(user);
    deleteDialog.onOpen();
  };

  const handleConfirmDelete = () => {
    if (!userToDelete) return;
    deleteUser.mutate(userToDelete.id);
  };

  const closeDeleteDialog = () => {
    if (deleteUser.isPending) return;
    deleteDialog.onClose();
    setUserToDelete(null);
  };

  const openEdit = (user: AdminUser) => {
    setEditingUser(user);
    setEditEmail(user.email ?? "");
    setEditName(user.name ?? "");
    setEditRole(user.role ?? "user");
    setEditPassword("");
    editModal.onOpen();
  };

  const handleCloseEdit = () => {
    if (updateUser.isPending) return;
    setEditingUser(null);
    setEditPassword("");
    editModal.onClose();
  };

  const handleEditSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!editingUser) return;

    const payload: Record<string, unknown> = {};
    if (editEmail && editEmail !== editingUser.email) {
      payload.email = editEmail;
    }
    if (editRole && editRole !== editingUser.role) {
      payload.role = editRole;
    }
    if (editPassword) {
      payload.password = editPassword;
    }

    const trimmedName = editName.trim();
    if (trimmedName !== (editingUser.name ?? "")) {
      payload.name = trimmedName;
    }

    if (Object.keys(payload).length === 0) {
      toast({ title: "Nenhuma alteração realizada", status: "info" });
      return;
    }

    updateUser.mutate({ id: editingUser.id, payload });
  };

  if (!isAdmin) {
    return (
      <Stack spacing={6}>
        <Alert status="warning">
          <AlertIcon />
          Você não tem permissão para acessar esta página. Apenas administradores podem gerenciar usuários.
          <Text fontSize="sm" mt={2}>
            Seu role atual: <strong>{role}</strong>
          </Text>
        </Alert>
      </Stack>
    );
  }

  return (
    <Stack spacing={6}>
      <Heading>Gerenciamento de usuários</Heading>

      <Box bg={cardBg} borderRadius="2xl" p={6} borderWidth={1} borderColor={borderColor} boxShadow="lg">
        <Heading size="md" mb={4}>
          Novo usuário
        </Heading>
        <Stack
          as="form"
          autoComplete="off"
          onSubmit={(event) => {
            event.preventDefault();
            createUser.mutate();
          }}
          spacing={4}
          direction={{ base: "column", md: "row" }}
          align={{ base: "stretch", md: "flex-start" }}
          flexWrap="wrap"
        >
          <FormControl flex={2} isRequired>
            <FormLabel mb={1}>E-mail corporativo</FormLabel>
            <Input
              placeholder="nome@empresa.com"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              type="email"
              autoComplete="off"
            />
            <FormHelperText>Utilize o e-mail oficial do colaborador.</FormHelperText>
          </FormControl>

          <FormControl flex={{ base: 1, md: 1.1 }}>
            <FormLabel mb={1}>Nome completo (opcional)</FormLabel>
            <Input
              placeholder="Responsável pelo acesso"
              value={name}
              onChange={(event) => setName(event.target.value)}
              autoComplete="off"
            />
            <FormHelperText>Visível no topo e nos relatórios.</FormHelperText>
          </FormControl>

          <FormControl flex={1} isRequired>
            <FormLabel mb={1}>Senha inicial</FormLabel>
            <Input
              placeholder="Mínimo 6 caracteres"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              type="password"
              minLength={6}
              autoComplete="new-password"
            />
            <FormHelperText>Combine letras, números e um caractere especial.</FormHelperText>
          </FormControl>

          <FormControl flex={{ base: 1, md: 0.8 }}>
            <FormLabel mb={1}>Função</FormLabel>
            <Select value={roleField} onChange={(event) => setRoleField(event.target.value)} autoComplete="off">
              <option value="user">Usuário</option>
              <option value="admin">Administrador</option>
            </Select>
            <FormHelperText>Admins conseguem criar e remover acessos.</FormHelperText>
          </FormControl>

          <Button
            type="submit"
            colorScheme="brand"
            isLoading={createUser.isPending}
            isDisabled={!email || !password}
            flexShrink={0}
            alignSelf={{ base: "stretch", md: "flex-start" }}
            h={{ base: "auto", md: "56px" }}
          >
            Criar acesso
          </Button>
        </Stack>
      </Box>

      <Box bg={cardBg} borderRadius="2xl" p={{ base: 4, md: 6 }} borderWidth={1} borderColor={borderColor} boxShadow="lg">
        <Flex justify="space-between" align="center" mb={4}>
          <Heading size="md">Usuários ativos</Heading>
        </Flex>
        <Box overflowX="auto">
          <Table size={{ base: "sm", md: "md" }}>
            <Thead>
              <Tr>
                <Th>Nome</Th>
                <Th>E-mail</Th>
                <Th>Função</Th>
                <Th>Último acesso</Th>
                <Th textAlign="right">Ações</Th>
              </Tr>
            </Thead>
            <Tbody>
              {isLoading && (
                <Tr>
                  <Td colSpan={5}>Carregando...</Td>
                </Tr>
              )}
              {usersError && (
                <Tr>
                  <Td colSpan={5}>
                    <Text color="red.500">
                      Erro ao carregar usuários: {extractErrorMessage(usersError)}
                    </Text>
                  </Td>
                </Tr>
              )}
              {!isLoading && !usersError && users.length === 0 && (
                <Tr>
                  <Td colSpan={5}>Nenhum usuário cadastrado.</Td>
                </Tr>
              )}
              {!usersError && users.map((user) => (
                <Tr key={user.id}>
                  <Td>{user.name ?? "—"}</Td>
                  <Td>{user.email}</Td>
                  <Td textTransform="capitalize">{user.role}</Td>
                  <Td>{user.lastSignInAt ? new Date(user.lastSignInAt).toLocaleString("pt-BR") : "Nunca"}</Td>
                  <Td textAlign="right">
                    <HStack justify="flex-end" spacing={1}>
                      <IconButton
                        aria-label="Editar usuário"
                        icon={<FiEdit />}
                        variant="ghost"
                        onClick={() => openEdit(user)}
                        isDisabled={updateUser.isPending}
                      />
                      <IconButton
                        aria-label="Excluir usuário"
                        icon={<FiTrash />}
                        variant="ghost"
                        onClick={() => handleDeleteClick(user)}
                        isDisabled={deleteUser.isPending || updateUser.isPending}
                      />
                    </HStack>
                  </Td>
                </Tr>
              ))}
            </Tbody>
          </Table>
        </Box>
      </Box>

      <Modal isOpen={editModal.isOpen} onClose={handleCloseEdit} size="lg">
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>Editar usuário</ModalHeader>
          <ModalCloseButton isDisabled={updateUser.isPending} />
          <ModalBody>
            <form id="edit-user-form" onSubmit={handleEditSubmit} autoComplete="off">
              <Stack spacing={4}>
                <FormControl>
                  <FormLabel>Nome completo</FormLabel>
                  <Input
                    placeholder="Identificação do colaborador"
                    value={editName}
                    onChange={(event) => setEditName(event.target.value)}
                    autoComplete="off"
                  />
                </FormControl>

                <FormControl isRequired>
                  <FormLabel>E-mail</FormLabel>
                  <Input
                    type="email"
                    placeholder="nome@empresa.com"
                    value={editEmail}
                    onChange={(event) => setEditEmail(event.target.value)}
                    autoComplete="off"
                  />
                </FormControl>

                <FormControl>
                  <FormLabel>Nova senha (opcional)</FormLabel>
                  <Input
                    type="password"
                    placeholder="Mínimo 6 caracteres"
                    value={editPassword}
                    onChange={(event) => setEditPassword(event.target.value)}
                    minLength={6}
                    autoComplete="new-password"
                  />
                  <FormHelperText>Preencha apenas se desejar redefinir a senha.</FormHelperText>
                </FormControl>

                <FormControl>
                  <FormLabel>Função</FormLabel>
                  <Select value={editRole} onChange={(event) => setEditRole(event.target.value)}>
                    <option value="user">Usuário</option>
                    <option value="admin">Administrador</option>
                  </Select>
                  <FormHelperText>Define o nível de acesso deste usuário.</FormHelperText>
                </FormControl>
              </Stack>
            </form>
          </ModalBody>
          <ModalFooter>
            <Button variant="ghost" mr={3} onClick={handleCloseEdit} isDisabled={updateUser.isPending}>
              Cancelar
            </Button>
            <Button colorScheme="brand" type="submit" form="edit-user-form" isLoading={updateUser.isPending}>
              Salvar alterações
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

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
                Tem certeza que deseja remover o usuário{" "}
                <strong>{userToDelete?.name || userToDelete?.email || "selecionado"}</strong>? Esta ação é permanente e
                não pode ser desfeita.
              </Text>
            </AlertDialogBody>
            <AlertDialogFooter>
              <Button ref={cancelDeleteRef} onClick={closeDeleteDialog} isDisabled={deleteUser.isPending}>
                Cancelar
              </Button>
              <Button colorScheme="red" ml={3} onClick={handleConfirmDelete} isLoading={deleteUser.isPending}>
                Excluir
              </Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialogOverlay>
      </AlertDialog>
    </Stack>
  );
}

