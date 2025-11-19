"use client";

import {
  Box,
  Button,
  Center,
  Heading,
  Input,
  Stack,
  Text,
  useColorModeValue,
  useToast,
} from "@chakra-ui/react";
import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/context/AuthContext";

// Forçar renderização dinâmica (não pré-renderizar)
export const dynamic = "force-dynamic";

function LoginForm() {
  const { signIn, loading, user } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [hasRedirected, setHasRedirected] = useState(false);
  const toast = useToast();
  const router = useRouter();
  const searchParams = useSearchParams();
  const cardBg = useColorModeValue("rgba(255,255,255,0.9)", "rgba(13, 18, 34, 0.9)");

  const from = searchParams.get("from") || "/clientes";

  useEffect(() => {
    if (!loading && user && !hasRedirected) {
      setHasRedirected(true);
      router.replace(from); // Usar replace em vez de push para evitar histórico duplicado
    }
  }, [loading, user, router, from, hasRedirected]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSubmitting(true);
    const { error } = await signIn({ email, password });
    setSubmitting(false);
    if (error) {
      toast({ title: "Falha ao autenticar", description: error, status: "error" });
      return;
    }
    // O useEffect vai detectar quando o usuário for atualizado e redirecionar
    // Não precisa mostrar toast aqui, o redirecionamento acontece automaticamente
  };

  return (
    <Center minH="100vh" bgGradient="linear(to-br, brand.500, brand.700)">
      <Box
        as="form"
        onSubmit={handleSubmit}
        bg={cardBg}
        p={10}
        borderRadius="2xl"
        boxShadow="2xl"
        width={{ base: "90%", md: "420px" }}
      >
        <Stack spacing={6}>
          <Box>
            <Heading size="lg">Serviços Telefonia Luxus</Heading>
            <Text color="gray.500">Autenticação do painel administrativo</Text>
          </Box>
          <Stack spacing={4}>
            <Box>
              <Text mb={1} fontWeight="medium">
                E-mail
              </Text>
              <Input
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                type="email"
                isRequired
              />
            </Box>
            <Box>
              <Text mb={1} fontWeight="medium">
                Senha
              </Text>
              <Input
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                type="password"
                isRequired
              />
            </Box>
          </Stack>
          <Button type="submit" colorScheme="brand" isLoading={submitting} loadingText="Entrando">
            Entrar
          </Button>
        </Stack>
      </Box>
    </Center>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <Center minH="100vh" bgGradient="linear(to-br, brand.500, brand.700)">
        <Text color="white">Carregando...</Text>
      </Center>
    }>
      <LoginForm />
    </Suspense>
  );
}


