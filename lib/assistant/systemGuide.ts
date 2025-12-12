export type AppPage = {
  label: string;
  path: string;
  description: string;
  primaryActions?: string[];
};

export const APP_PAGES: AppPage[] = [
  {
    label: "Dashboard",
    path: "/dashboard",
    description: "Visão geral, métricas e atalhos.",
  },
  {
    label: "Clientes",
    path: "/clientes",
    description: "Cadastro/edição de clientes, observações do cliente, serviços vinculados, valores e exportação.",
    primaryActions: ["Novo cliente", "Editar", "Valores", "Serviços", "Exportar CSV", "Exportar PDF", "Importar CSV"],
  },
  {
    label: "Usuários TV",
    path: "/usuarios",
    description: "Gestão de slots/acessos de TV, plano Essencial/Premium, vencimentos e nomes (username).",
    primaryActions: ["Exportar", "Renovar", "Remover", "Gerar senha", "Editar e-mail", "Editar conta"],
  },
  {
    label: "Usuários Cloud",
    path: "/usuarios-cloud",
    description: "Gestão de acessos Cloud (vencimentos, testes, observações).",
  },
  {
    label: "Usuários Hub",
    path: "/usuarios-hub",
    description: "Gestão de acessos HubPlay.",
  },
  {
    label: "Usuários Tele",
    path: "/usuarios-tele",
    description: "Gestão de acessos Telemedicina/Telepet.",
  },
  {
    label: "Relatórios",
    path: "/relatorios/servicos",
    description: "Relatórios de serviços (filtros + exportação CSV).",
  },
  {
    label: "Serviços",
    path: "/servicos",
    description: "Catálogo de serviços, preço e se é negociável.",
    primaryActions: ["Novo serviço", "Editar", "Excluir", "Importar CSV", "Exportar CSV", "Exportar PDF"],
  },
  {
    label: "Contratos",
    path: "/contratos",
    description: "Criação/edição/envio/assinatura de contratos e status.",
    primaryActions: ["Novo contrato", "Visualizar", "Enviar", "Assinar", "Cancelar", "Exportar"],
  },
  {
    label: "Templates",
    path: "/templates",
    description: "Modelos de contrato (conteúdo e ativação).",
    primaryActions: ["Novo template", "Editar", "Ativar/Desativar"],
  },
  {
    label: "Guia de uso",
    path: "/guia",
    description: "Documentação interna do sistema.",
  },
  {
    label: "Perfil",
    path: "/perfil",
    description: "Dados do usuário e preferências.",
  },
  {
    label: "Administração",
    path: "/admin/usuarios",
    description: "Gestão administrativa (apenas admin).",
  },
];

type HowToKey =
  | "cadastrar-cliente"
  | "editar-cliente"
  | "adicionar-servicos-cliente"
  | "ver-valores-cliente"
  | "cadastrar-servico"
  | "cadastrar-contrato"
  | "criar-template"
  | "vincular-tv"
  | "renovar-tv"
  | "exportar-relatorio-servicos";

type HowTo = {
  key: HowToKey;
  title: string;
  triggers: RegExp[];
  steps: string[];
};

export const HOW_TOS: HowTo[] = [
  {
    key: "cadastrar-cliente",
    title: "Como cadastrar um cliente",
    triggers: [/cadastrar\s+cliente/i, /novo\s+cliente/i, /criar\s+cliente/i],
    steps: [
      "1) Menu **Clientes**",
      "2) Clique em **Novo cliente**",
      "3) Preencha: **Nome**, **E-mail**, **Documento (CPF/CNPJ)** (e opcional: telefone/empresa/cidade/estado/centro de custo)",
      "4) Clique em **Salvar**",
      "5) Depois, use os botões **Serviços** (vincular produtos) e **Valores** (visualizar valores/quantidades)",
    ],
  },
  {
    key: "editar-cliente",
    title: "Como editar um cliente",
    triggers: [/editar\s+cliente/i, /atualizar\s+cliente/i],
    steps: ["1) Menu **Clientes**", "2) Localize o cliente (busca)", "3) Clique em **Editar**", "4) Ajuste os campos", "5) **Salvar**"],
  },
  {
    key: "adicionar-servicos-cliente",
    title: "Como adicionar/editar serviços de um cliente",
    triggers: [/adicionar\s+servi[cç]o/i, /editar\s+servi[cç]os/i, /vincular\s+servi[cç]o/i],
    steps: [
      "1) Menu **Clientes**",
      "2) Localize o cliente → clique em **Serviços**",
      "3) Selecione os serviços e, quando aplicável, defina **preço personalizado**",
      "4) **Salvar**",
    ],
  },
  {
    key: "ver-valores-cliente",
    title: "Como ver os valores (quantidades e subtotais) de um cliente",
    triggers: [/ver\s+valores/i, /valores\s+do\s+cliente/i, /quantidade/i],
    steps: ["1) Menu **Clientes**", "2) Localize o cliente → clique em **Valores**", "3) Veja o produto + quantidade e totais"],
  },
  {
    key: "cadastrar-servico",
    title: "Como cadastrar um serviço",
    triggers: [/cadastrar\s+servi[cç]o/i, /novo\s+servi[cç]o/i, /criar\s+servi[cç]o/i],
    steps: ["1) Menu **Serviços**", "2) Clique em **Novo serviço**", "3) Informe nome/descrição/valor e se é negociável", "4) **Salvar**"],
  },
  {
    key: "cadastrar-contrato",
    title: "Como criar um contrato",
    triggers: [/criar\s+contrato/i, /novo\s+contrato/i, /cadastrar\s+contrato/i],
    steps: [
      "1) Menu **Contratos**",
      "2) Clique em **Novo contrato**",
      "3) Selecione o **cliente** e o **template** (se aplicável)",
      "4) Revise o conteúdo e **Salvar**",
      "5) Depois use **Enviar/Assinar** conforme o fluxo",
    ],
  },
  {
    key: "criar-template",
    title: "Como criar um template de contrato",
    triggers: [/criar\s+template/i, /novo\s+template/i, /modelo\s+de\s+contrato/i],
    steps: ["1) Menu **Templates**", "2) Clique em **Novo template**", "3) Informe nome e conteúdo", "4) Marque como **ativo** se for usar", "5) **Salvar**"],
  },
  {
    key: "vincular-tv",
    title: "Como vincular TV (Essencial/Premium) a um cliente",
    triggers: [/vincular\s+tv/i, /adicionar\s+tv/i, /cadastrar\s+tv/i, /plano\s+tv/i],
    steps: [
      "1) Menu **Clientes** → abra o cliente",
      "2) Clique em **Serviços** (e configure TV conforme o modal)",
      "3) Escolha **Essencial** ou **Premium** e confirme os dados",
      "4) Salve e depois confira em **Usuários TV** (vencimento/slot/username)",
    ],
  },
  {
    key: "renovar-tv",
    title: "Como renovar um acesso de TV",
    triggers: [/renovar\s+tv/i, /renova[cç][aã]o\s+tv/i, /vencendo\s+tv/i],
    steps: ["1) Menu **Usuários TV**", "2) Encontre o acesso (busca/filtros)", "3) Abra **Detalhes**", "4) Clique em **Renovar** e informe a nova data"],
  },
  {
    key: "exportar-relatorio-servicos",
    title: "Como exportar o relatório de serviços",
    triggers: [/exportar\s+relat[oó]rio/i, /relat[oó]rios/i, /exportar\s+csv/i],
    steps: ["1) Menu **Relatórios**", "2) Ajuste filtros (documento/categoria/serviço/busca)", "3) Clique **Aplicar filtros**", "4) Clique **Exportar CSV**"],
  },
];

export function buildSystemMapText(): string {
  return APP_PAGES.map((p) => `- ${p.label} (${p.path}): ${p.description}`).join("\n");
}

export function matchHowTo(message: string): HowTo | null {
  const q = message.trim();
  for (const howto of HOW_TOS) {
    if (howto.triggers.some((re) => re.test(q))) return howto;
  }
  return null;
}


