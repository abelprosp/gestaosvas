import {
  Box,
  Button,
  FormControl,
  FormLabel,
  Input,
  Stack,
  Text,
  useColorModeValue,
  Heading,
  useToast,
  SimpleGrid,
} from "@chakra-ui/react";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { useAuth } from "../../context/AuthContext";
import supabase from "../../lib/supabaseClient";

type ProfileFormValues = {
  name: string;
  phone?: string;
  password?: string;
  confirmPassword?: string;
};

export function ProfilePage() {
  const { user } = useAuth();
  const toast = useToast();
  const cardBg = useColorModeValue("rgba(255,255,255,0.92)", "rgba(15, 23, 42, 0.72)");
  const borderColor = useColorModeValue("gray.200", "whiteAlpha.200");
  const metadata = (user?.user_metadata ?? {}) as { name?: string; phone?: string };

  const {
    register,
    handleSubmit,
    reset,
    formState: { isSubmitting },
    watch,
  } = useForm<ProfileFormValues>({
    defaultValues: {
      name: metadata.name ?? "",
      phone: metadata.phone ?? "",
      password: "",
      confirmPassword: "",
    },
  });

  useEffect(() => {
    reset({
      name: metadata.name ?? "",
      phone: metadata.phone ?? "",
      password: "",
      confirmPassword: "",
    });
  }, [metadata.name, metadata.phone, reset]);

  const passwordValue = watch("password");

  const onSubmit = async (values: ProfileFormValues) => {
    if (!user) {
      toast({
        title: "Sessão expirada",
        description: "Faça login novamente para atualizar seu perfil.",
        status: "warning",
      });
      return;
    }

    if (values.password && values.password.length < 6) {
      toast({
        title: "Senha muito curta",
        description: "Use ao menos 6 caracteres.",
        status: "error",
      });
      return;
    }

    if (values.password && values.password !== values.confirmPassword) {
      toast({
        title: "Senhas não coincidem",
        description: "Confirme a senha corretamente.",
        status: "error",
      });
      return;
    }

    try {
      const payload: Parameters<typeof supabase.auth.updateUser>[0] = {
        data: {
          name: values.name.trim(),
          phone: values.phone?.trim() ?? null,
        },
      };

      if (values.password) {
        payload.password = values.password;
      }

      const { error } = await supabase.auth.updateUser(payload);
      if (error) {
        throw error;
      }

      toast({
        title: "Perfil atualizado",
        description: values.password ? "Informações e senha atualizadas com sucesso." : "Informações salvas com sucesso.",
        status: "success",
      });

      reset((current) => ({
        ...current,
        password: "",
        confirmPassword: "",
      }));
    } catch (error) {
      console.error(error);
      toast({
        title: "Erro ao atualizar perfil",
        description: (error as { message?: string })?.message ?? "Tente novamente em instantes.",
        status: "error",
      });
    }
  };

  return (
    <Box>
      <Heading size="lg" mb={2}>
        Meu perfil
      </Heading>
      <Text color="gray.500" mb={8}>
        Atualize suas informações pessoais e senha de acesso.
      </Text>

      <Box
        bg={cardBg}
        borderWidth={1}
        borderColor={borderColor}
        borderRadius="2xl"
        p={{ base: 4, md: 8 }}
        maxW="3xl"
        boxShadow="xl"
      >
        <form onSubmit={handleSubmit(onSubmit)}>
          <Stack spacing={6}>
            <SimpleGrid columns={{ base: 1, md: 2 }} spacing={6}>
              <FormControl>
                <FormLabel>Nome completo</FormLabel>
                <Input placeholder="Seu nome" {...register("name")} />
              </FormControl>
              <FormControl>
                <FormLabel>Telefone</FormLabel>
                <Input placeholder="(11) 99999-9999" {...register("phone")} />
              </FormControl>
              <FormControl isReadOnly>
                <FormLabel>E-mail</FormLabel>
                <Input value={user?.email ?? ""} />
              </FormControl>
              <FormControl isReadOnly>
                <FormLabel>Identificador</FormLabel>
                <Input value={user?.id ?? ""} />
              </FormControl>
            </SimpleGrid>

            <Box>
              <Text fontWeight="semibold" mb={3}>
                Atualizar senha
              </Text>
              <SimpleGrid columns={{ base: 1, md: 2 }} spacing={6}>
                <FormControl>
                  <FormLabel>Nova senha</FormLabel>
                  <Input type="password" placeholder="••••••••" {...register("password")} />
                </FormControl>
                <FormControl>
                  <FormLabel>Confirmar senha</FormLabel>
                  <Input type="password" placeholder="Repita a senha" {...register("confirmPassword")} />
                </FormControl>
              </SimpleGrid>
              {passwordValue && passwordValue.length > 0 && (
                <Text fontSize="sm" color="gray.500" mt={2}>
                  A senha deve ter pelo menos 6 caracteres.
                </Text>
              )}
            </Box>

            <Button type="submit" colorScheme="brand" size="lg" alignSelf="flex-start" isLoading={isSubmitting}>
              Salvar alterações
            </Button>
          </Stack>
        </form>
      </Box>
    </Box>
  );
}







