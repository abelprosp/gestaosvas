"use client";
import { Box, Divider, Heading, ListItem, Stack, Text, UnorderedList, useColorModeValue } from "@chakra-ui/react";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  const cardBg = useColorModeValue("rgba(255,255,255,0.88)", "rgba(15, 23, 42, 0.7)");
  const borderColor = useColorModeValue("rgba(226,232,240,0.7)", "rgba(45,55,72,0.6)");

  return (
    <Box bg={cardBg} borderRadius="2xl" p={{ base: 5, md: 8 }} borderWidth={1} borderColor={borderColor} boxShadow="xl">
      <Heading size="md" mb={4}>
        {title}
      </Heading>
      {children}
    </Box>
  );
}

export function GuidePage() {
  return (
    <Stack spacing={8}>
      <Heading>Guia completo da central</Heading>
      <Text color="gray.500">
        Este documento resume o funcionamento de cada área da plataforma Serviços Telefonia, incluindo fluxos de cadastro,
        filtros recém-adicionados, geração de acessos de TV e rotinas administrativas.
      </Text>

      <Section title="1. Primeiro acesso e layout">
        <UnorderedList spacing={3}>
          <ListItem>
            A autenticação usa Supabase Auth. Insira e-mail/senha cadastrados pelo administrador em{" "}
            <strong>/login</strong>.
          </ListItem>
          <ListItem>
            O topo contém o botão de modo claro/escuro e o menu do usuário. O item <strong>Meu perfil</strong> permite
            atualizar nome, telefone e senha. Administradores visualizam também o atalho <strong>Administração</strong>.
          </ListItem>
          <ListItem>
            O menu lateral dá acesso rápido ao Dashboard, Clientes, Usuários TV, Serviços, Contratos, Templates, Guia e
            Administração. Em telas pequenas, abra-o pelo ícone de menu.
          </ListItem>
          <ListItem>O balão do assistente virtual fica no canto inferior direito e permanece visível no mobile.</ListItem>
        </UnorderedList>
      </Section>

      <Section title="2. Dashboard e indicadores">
        <UnorderedList spacing={3}>
          <ListItem>
            Os cards de métricas mostram totais de CPF, CNPJ, cadastros recentes e goal de acessos de TV. Tudo é atualizado
            em tempo real pelo endpoint <code>/stats/overview</code>.
          </ListItem>
          <ListItem>
            O gráfico de linhas “Vendas mensais por serviço” traz filtros de período e serviços (TV Essencial, TV Premium,
            Internet etc.) alimentados pelo endpoint <code>/stats/sales</code>. Use-o para comparar sazonalidade de contratos.
          </ListItem>
          <ListItem>
            O bloco “Resumo por serviços” consolida Essencial + Premium em um cartão com botão de expandir para ver cada
            modalidade. Serviços não relacionados à TV aparecem na área “Resumo por plano”.
          </ListItem>
          <ListItem>
            “Distribuição de cadastros” usa <strong>segments</strong> dinâmicos enviados pelo backend, permitindo analisar
            qualquer serviço sem necessidade de código.
          </ListItem>
        </UnorderedList>
      </Section>

      <Section title="3. Gestão de clientes">
        <UnorderedList spacing={3}>
          <ListItem>
            Utilize a busca textual para localizar por nome, e-mail, documento ou serviço. O seletor ao lado filtra entre
            <strong> CPF</strong> e <strong>CNPJ</strong>, refletindo diretamente na consulta ao backend.
          </ListItem>
          <ListItem>
            Paginação de 50 itens por página com botões “Anterior” e “Próxima”. A mudança de filtro ou busca sempre volta
            para a primeira página.
          </ListItem>
          <ListItem>
            Exportações CSV/PDF ficam acima da tabela. O input oculto permite importar novos clientes em lote.
          </ListItem>
          <ListItem>
            Clique em <strong>Novo cliente</strong> para abrir o modal:
            <UnorderedList mt={2} spacing={2}>
              <ListItem>
                O botão <strong>Buscar CNPJ</strong> consulta a BrasilAPI. Se o CNPJ for encontrado, nome, empresa, endereço,
                cidade, estado, telefone e e-mail são preenchidos automaticamente.
              </ListItem>
              <ListItem>
                A lista de serviços reflete o cadastro atual. Serviços com preço negociável exibem campo para valor customizado.
              </ListItem>
              <ListItem>
                Ao selecionar um serviço de TV, aparece o bloco “Configurar acessos de TV”, onde é possível definir plano,
                quantidade, vendedor, datas e observações. O sistema gera automaticamente os slots e perfis sequenciais
                (ex.: Marina 1, Marina 2).
              </ListItem>
            </UnorderedList>
          </ListItem>
          <ListItem>
            Expandindo um cliente na tabela é possível ver detalhes, serviços contratados e todos os acessos de TV,
            incluindo perfil, status, notas e histórico.
          </ListItem>
        </UnorderedList>
      </Section>

      <Section title="4. Usuários de TV">
        <UnorderedList spacing={3}>
          <ListItem>
            A listagem suporta paginação, busca por nome, e-mail, telefone, documento, vendedor e perfil. Quando há termo
            de busca, o frontend repete a consulta para até 500 registros e filtra client-side para garantir resultados
            completos.
          </ListItem>
          <ListItem>
            O campo de CPF/CNPJ permite localizar rapidamente quem contratou o acesso; o documento também aparece no
            painel expandido.
          </ListItem>
          <ListItem>
            Cada registro mostra status, plano, vencimento e um botão de expandir. Na área expandida é possível editar notas
            (“Comentário”) e visualizar o perfil enumerado.
          </ListItem>
          <ListItem>
            Para liberar slots, utilize as ações de “Ver mais” dentro da tabela ou abra o cliente correspondente e remova o
            serviço de TV.
          </ListItem>
        </UnorderedList>
      </Section>

      <Section title="5. Serviços, contratos e templates">
        <UnorderedList spacing={3}>
          <ListItem>
            <strong>Serviços:</strong> cadastre todos os planos ofertados (TV Essencial, TV Premium, Internet, Telefonia
            fixa etc.). Marcando “Permitir valor customizado” o serviço passa a aceitar preço negociado no formulário.
          </ListItem>
          <ListItem>
            <strong>Templates:</strong> mantenha os modelos contratuais com variáveis de cliente. Eles são usados na aba
            <strong>Contratos</strong> para gerar documentos prontos para assinatura digital.
          </ListItem>
          <ListItem>
            <strong>Contratos:</strong> acompanhe o status (Rascunho, Enviado, Assinado, Cancelado), exporte PDFs e use o
            histórico no dashboard para identificar gargalos.
          </ListItem>
        </UnorderedList>
      </Section>

      <Section title="6. Administração e usuários">
        <UnorderedList spacing={3}>
          <ListItem>
            O menu “Administração” (visível apenas para <strong>isAdmin</strong>) abre a tela de gestão de usuários internos.
            Cadastre novos vendedores ou administradores e defina o papel na propriedade <code>user_metadata.role</code>.
          </ListItem>
          <ListItem>
            Solicitações feitas por usuários sem permissão (ex.: criação de vendedor) são enviadas via endpoint
            <code>/requests</code> e aparecem na área administrativa para aprovação.
          </ListItem>
        </UnorderedList>
      </Section>

      <Section title="7. Exportações, scripts e dados de exemplo">
        <UnorderedList spacing={3}>
          <ListItem>
            As telas de Clientes e Usuários TV oferecem exportação para CSV e PDF. O backend usa utilitários com
            <code>papaparse</code>, <code>html2canvas</code> e <code>jspdf</code>.
          </ListItem>
          <ListItem>
            Após um <em>pull</em>, rode <code>npx ts-node src/scripts/backfillClients.ts</code> e{" "}
            <code>npx ts-node src/scripts/generateRandomClients.ts</code> para gerar clientes e slots de TV com datas
            coerentes, garantindo gráficos realistas.
          </ListItem>
        </UnorderedList>
      </Section>

      <Section title="8. Boas práticas e suporte">
        <UnorderedList spacing={3}>
          <ListItem>Use os filtros CPF/CNPJ e os campos de busca antes de criar registros duplicados.</ListItem>
          <ListItem>
            Renove acessos vencendo em até 5 dias para manter os gráficos e a meta de acessos coerentes. O dashboard
            destaca automaticamente o total utilizado.
          </ListItem>
          <ListItem>
            Prefira atualizar dados pessoais pela página <strong>Meu perfil</strong> em vez de solicitar suporte para
            informações simples.
          </ListItem>
          <ListItem>
            Caso perceba divergência de indicadores, execute novamente os scripts de seed ou verifique se o backend está
            acessível em <code>http://localhost:4000/api</code>.
          </ListItem>
          <ListItem>
            Para dúvidas operacionais, use o chat do assistente virtual; para dúvidas técnicas, registre uma solicitação
            em Administração &gt; Requisições.
          </ListItem>
        </UnorderedList>
        <Divider my={6} />
        <Text fontSize="sm" color="gray.500">
          Última revisão: {new Date().toLocaleDateString("pt-BR")}. Atualize esta página sempre que novas funcionalidades
          forem lançadas.
        </Text>
      </Section>

      <Section title="9. Passo a passo das principais ações">
        <UnorderedList spacing={3}>
          <ListItem>
            <strong>Cadastrar cliente:</strong> clique em “Novo cliente” → preencha nome/e-mail → opcionalmente clique em
            “Buscar CNPJ” → selecione os serviços desejados → se incluir TV ou Cloud/Hub/Tele, configure vencimentos nos
            blocos adicionais → clique em “Cadastrar”.
          </ListItem>
          <ListItem>
            <strong>Editar cliente:</strong> abra “Ver mais” na tabela de clientes → clique em “Editar” → ajuste os dados que
            desejar → atualize vencimentos dos serviços selecionados → salve.
          </ListItem>
          <ListItem>
            <strong>Excluir cliente:</strong> na tabela de clientes, abra o menu de ações (ícone de lixeira) → confirme. Apenas
            administradores podem concluir a exclusão; usuários comuns enviam uma solicitação para aprovação.
          </ListItem>
          <ListItem>
            <strong>Alterar acesso de TV:</strong> na aba Usuários TV, clique em “Ver detalhes” → utilize os botões Renovar,
            Contato, Remover ou “Gerar nova senha”. Sempre confirme quando solicitado.
          </ListItem>
          <ListItem>
            <strong>Alterar acesso Cloud/Hub/Tele:</strong> vá até a aba correspondente → clique no ícone de edição →
            ajuste vencimento, marque se é teste, adicione comentário → salve. Para remover, use o mesmo modal (somente admin
            confirma a exclusão).
          </ListItem>
          <ListItem>
            <strong>Solicitar cadastro de vendedor:</strong> ao preencher um cliente e precisar de um vendedor novo, clique em
            “Cadastrar vendedor” → descreva o pedido. O administrador receberá a solicitação em Administração &gt;
            Requisições.
          </ListItem>
          <ListItem>
            <strong>Exportar dados:</strong> use os botões “Exportar CSV/Exportar filtrados” disponíveis em Clientes, Usuários TV
            e Relatórios. Para exportar um único documento, utilize o campo “Documento para relatório” e clique em “Exportar
            documento”.
          </ListItem>
        </UnorderedList>
      </Section>
    </Stack>
  );
}


