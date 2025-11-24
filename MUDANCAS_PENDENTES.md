# Mudanças Pendentes - Implementação Completa

## ✅ Já Implementado

1. **Correção de salvamento de vendedor (openedBy) e CEP (zipCode)**
   - ✅ Migração SQL criada (`supabase/migration_fixes.sql`)
   - ✅ Mappers atualizados para salvar e ler `opened_by`
   - ✅ Schema do backend já aceita `openedBy`

2. **Rota para criar conta TV manual**
   - ✅ Rota POST `/api/tv/accounts` criada
   - ✅ Função `createTVAccount` adicionada na API client

## 🔄 Pendente de Implementação

### 1. Adicionar botão na página de Usuários TV para criar e-mail manual

**Arquivo:** `components/pages/Users/UsersPage.tsx`

Adicionar:
- Botão "Criar e-mail manual" (apenas para admin)
- Modal para inserir e-mail
- Chamar `createTVAccount` da API
- Atualizar lista após criação

**Código sugerido:**
```tsx
import { createTVAccount } from "@/lib/api/tv";
import { FiPlus } from "react-icons/fi";
import { useDisclosure } from "@chakra-ui/react";
import { Modal, ModalOverlay, ModalContent, ModalHeader, ModalBody, ModalFooter, Input, FormControl, FormLabel } from "@chakra-ui/react";

// No componente:
const createAccountModal = useDisclosure();
const [newEmail, setNewEmail] = useState("");

const handleCreateAccount = async () => {
  try {
    await createTVAccount(newEmail);
    toast({ title: "Conta criada com sucesso", status: "success" });
    queryClient.invalidateQueries({ queryKey: ["tvOverview"] });
    createAccountModal.onClose();
    setNewEmail("");
  } catch (error) {
    toast({ title: "Erro ao criar conta", status: "error", description: extractErrorMessage(error) });
  }
};

// No JSX, adicionar botão ao lado do Heading:
{isAdmin && (
  <Button leftIcon={<FiPlus />} onClick={createAccountModal.onOpen}>
    Criar e-mail manual
  </Button>
)}

// Modal:
<Modal isOpen={createAccountModal.isOpen} onClose={createAccountModal.onClose}>
  <ModalOverlay />
  <ModalContent>
    <ModalHeader>Criar conta TV manual</ModalHeader>
    <ModalBody>
      <FormControl>
        <FormLabel>E-mail</FormLabel>
        <Input
          type="email"
          value={newEmail}
          onChange={(e) => setNewEmail(e.target.value)}
          placeholder="exemplo@dominio.com"
        />
      </FormControl>
    </ModalBody>
    <ModalFooter>
      <Button variant="ghost" mr={3} onClick={createAccountModal.onClose}>
        Cancelar
      </Button>
      <Button colorScheme="blue" onClick={handleCreateAccount}>
        Criar (8 usuários serão criados)
      </Button>
    </ModalFooter>
  </ModalContent>
</Modal>
```

### 2. Separar TV em serviços: TV ESSENCIAL e TV PREMIUM

**Mudanças necessárias:**

#### A. Atualizar detecção de serviços TV

**Arquivos a modificar:**
- `components/forms/ClientFormModal.tsx` (linha ~376)
- `components/forms/ClientServicesModal.tsx` (similar)
- `app/api/clients/[id]/route.ts` (linha ~225)
- `app/api/clients/route.ts` (linha ~245)

**Mudança:**
```typescript
// ANTES:
const tvServices = useMemo(
  () => serviceOptions.filter((service) => service.name.toLowerCase().includes("tv")),
  [serviceOptions],
);

// DEPOIS:
const tvServices = useMemo(
  () => serviceOptions.filter((service) => {
    const name = service.name.toLowerCase();
    return name.includes("tv essencial") || name.includes("tv premium");
  }),
  [serviceOptions],
);
```

#### B. Atualizar lógica de criação de acessos TV

**Arquivo:** `app/api/clients/[id]/route.ts` e `app/api/clients/route.ts`

**Mudança na função `handleTvServiceForClient`:**
```typescript
// ANTES:
const hasTv = services.some((service) => service.name?.toLowerCase().includes("tv"));

// DEPOIS:
const hasTv = services.some((service) => {
  const name = service.name?.toLowerCase() ?? "";
  return name.includes("tv essencial") || name.includes("tv premium");
});

// E determinar o planType baseado no serviço:
const tvService = services.find((service) => {
  const name = service.name?.toLowerCase() ?? "";
  return name.includes("tv essencial") || name.includes("tv premium");
});

const planTypeFromService = tvService?.name?.toLowerCase().includes("premium") 
  ? "PREMIUM" 
  : "ESSENCIAL";
```

### 3. Adicionar opção de adicionar mais acessos na edição de serviços

**Arquivo:** `components/forms/ClientServicesModal.tsx`

**Mudança:**
Adicionar um botão/input para adicionar mais acessos quando já existem acessos TV:

```tsx
// Após a seção de configuração TV, adicionar:
{isTvSelected && client.tvAssignments && client.tvAssignments.length > 0 && (
  <Box p={4} bg={cardBg} borderRadius="lg" borderWidth={1} borderColor={cardBorder}>
    <Text fontWeight="semibold" mb={2}>
      Acessos existentes: {client.tvAssignments.length}
    </Text>
    <FormControl>
      <FormLabel>Adicionar mais acessos</FormLabel>
      <Input
        type="number"
        min={1}
        max={50}
        value={additionalSlots}
        onChange={(e) => setAdditionalSlots(parseInt(e.target.value) || 0)}
        placeholder="Quantidade de acessos adicionais"
      />
    </FormControl>
    <Text fontSize="sm" color="gray.500" mt={2}>
      Serão adicionados {additionalSlots} acessos com as mesmas configurações
    </Text>
  </Box>
)}
```

E no submit, se `additionalSlots > 0`, chamar `assignMultipleSlotsToClient` com a quantidade adicional.

## 📋 SQL para Executar no Supabase

Execute o arquivo `supabase/migration_fixes.sql` que já foi criado. Ele contém:

1. Adicionar coluna `opened_by` na tabela `clients`
2. Verificar/garantir coluna `zip_code` existe
3. Criar serviços "TV ESSENCIAL" e "TV PREMIUM"
4. Migrar clientes do serviço TV antigo para TV ESSENCIAL

**IMPORTANTE:** Após executar o SQL, você precisará:
- Verificar se os serviços foram criados corretamente
- Ajustar manualmente clientes que deveriam ter TV PREMIUM (baseado em `plan_type` dos acessos)
- Remover o serviço TV antigo se desejar (linha comentada no SQL)

## 🎯 Ordem de Implementação Recomendada

1. ✅ Executar SQL no Supabase (`migration_fixes.sql`)
2. ⏳ Adicionar botão de criar e-mail manual na página de usuários TV
3. ⏳ Atualizar detecção de serviços TV (TV ESSENCIAL e TV PREMIUM)
4. ⏳ Adicionar opção de adicionar mais acessos na edição

