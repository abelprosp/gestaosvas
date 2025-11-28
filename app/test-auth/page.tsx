"use client";

import { useEffect, useState } from "react";
import { Box, Button, Code, Heading, VStack, Text, Alert, AlertIcon } from "@chakra-ui/react";
import { supabase } from "@/lib/supabase/client";
import { api } from "@/lib/api/client";

export default function TestAuthPage() {
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [sessionInfo, setSessionInfo] = useState<any>(null);

  useEffect(() => {
    // Verificar sessão atual
    supabase.auth.getSession().then(({ data, error }) => {
      if (error) {
        setSessionInfo({ error: error.message });
      } else {
        setSessionInfo({
          hasSession: !!data.session,
          hasToken: !!data.session?.access_token,
          tokenLength: data.session?.access_token?.length || 0,
          tokenPrefix: data.session?.access_token?.substring(0, 30) + "..." || "N/A",
          expiresAt: data.session?.expires_at,
          user: data.session?.user ? {
            id: data.session.user.id,
            email: data.session.user.email,
            role: (data.session.user.user_metadata as any)?.role || "não definido",
          } : null,
        });
      }
    });
  }, []);

  const testAuth = async () => {
    setLoading(true);
    setResult(null);

    try {
      // Testar endpoint de teste
      const response = await api.get("/test-auth");
      setResult({
        success: true,
        data: response.data,
      });
    } catch (error: any) {
      setResult({
        success: false,
        error: error.response?.data || error.message,
        status: error.response?.status,
        statusText: error.response?.statusText,
      });
    } finally {
      setLoading(false);
    }
  };

  const testAdminUsers = async () => {
    setLoading(true);
    setResult(null);

    try {
      // Testar endpoint real de admin
      const response = await api.get("/admin/users");
      setResult({
        success: true,
        data: response.data,
        count: Array.isArray(response.data) ? response.data.length : "N/A",
      });
    } catch (error: any) {
      setResult({
        success: false,
        error: error.response?.data || error.message,
        status: error.response?.status,
        statusText: error.response?.statusText,
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box p={8} maxW="4xl" mx="auto">
      <VStack spacing={6} align="stretch">
        <Heading>Teste de Autenticação</Heading>

        <Box>
          <Heading size="md" mb={2}>Informações da Sessão</Heading>
          <Code p={4} display="block" whiteSpace="pre-wrap" fontSize="sm">
            {JSON.stringify(sessionInfo, null, 2)}
          </Code>
        </Box>

        {!sessionInfo?.hasSession && (
          <Alert status="warning">
            <AlertIcon />
            Você não está logado. Faça login primeiro em /login
          </Alert>
        )}

        <VStack spacing={3} align="stretch">
          <Button
            onClick={testAuth}
            isLoading={loading}
            isDisabled={!sessionInfo?.hasSession}
            colorScheme="blue"
          >
            Testar Endpoint /api/test-auth
          </Button>

          <Button
            onClick={testAdminUsers}
            isLoading={loading}
            isDisabled={!sessionInfo?.hasSession}
            colorScheme="purple"
          >
            Testar Endpoint /api/admin/users
          </Button>
        </VStack>

        {result && (
          <Box>
            <Heading size="md" mb={2}>
              Resultado: {result.success ? "✅ Sucesso" : "❌ Erro"}
            </Heading>
            {result.status && (
              <Text mb={2}>
                Status: {result.status} {result.statusText}
              </Text>
            )}
            <Code p={4} display="block" whiteSpace="pre-wrap" fontSize="sm">
              {JSON.stringify(result, null, 2)}
            </Code>
          </Box>
        )}

        <Box>
          <Heading size="sm" mb={2}>Instruções</Heading>
          <Text fontSize="sm" color="gray.600">
            1. Faça login em /login primeiro<br/>
            2. Volte para esta página<br/>
            3. Clique nos botões acima para testar<br/>
            4. Verifique os logs no terminal do servidor (npm run dev)
          </Text>
        </Box>
      </VStack>
    </Box>
  );
}

