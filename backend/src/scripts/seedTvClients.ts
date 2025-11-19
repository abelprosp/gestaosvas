import "dotenv/config";
import supabase from "../supabaseClient";
import { assignSlotToClient, releaseSlotsForClient } from "../services/tvAssignments";

type TVPlanType = "ESSENCIAL" | "PREMIUM";

interface SeedClient {
  name: string;
  email: string;
  phone: string;
  document: string;
  companyName: string;
  address: string;
  city: string;
  state: string;
  notes: string;
  soldBy: string;
  soldAt: string;
  expiresAt: string;
  planType?: TVPlanType;
}

const seedClients: SeedClient[] = [
  {
    name: "Carlos Nascimento",
    email: "carlos.nascimento@example.com",
    phone: "(11) 99876-1001",
    document: "11111111110",
    companyName: "Nascimento Tech",
    address: "Rua das Acácias, 150",
    city: "São Paulo",
    state: "SP",
    notes: "Cliente prioritário para upsell de pacote HBO.",
    soldBy: "Ana Lima",
    soldAt: "2025-09-15",
    expiresAt: "2025-11-15",
    planType: "ESSENCIAL",
  },
  {
    name: "Fernanda Ribeiro",
    email: "fernanda.ribeiro@example.com",
    phone: "(21) 99741-2202",
    document: "11111111129",
    companyName: "FR Confeitaria",
    address: "Rua das Violetas, 88",
    city: "Rio de Janeiro",
    state: "RJ",
    notes: "Solicitou inclusão de canais infantis.",
    soldBy: "João Martins",
    soldAt: "2025-09-22",
    expiresAt: "2025-12-12",
    planType: "PREMIUM",
  },
  {
    name: "Ricardo Moreira",
    email: "ricardo.moreira@example.com",
    phone: "(31) 99620-3303",
    document: "11111111138",
    companyName: "RM Engenharia",
    address: "Av. Amazonas, 1020",
    city: "Belo Horizonte",
    state: "MG",
    notes: "Interessa em pacote corporativo para salas de espera.",
    soldBy: "Luiza Prado",
    soldAt: "2025-08-18",
    expiresAt: "2025-11-05",
    planType: "ESSENCIAL",
  },
  {
    name: "Patrícia Albuquerque",
    email: "patricia.albuquerque@example.com",
    phone: "(85) 99544-4404",
    document: "11111111147",
    companyName: "Padaria do Bairro",
    address: "Rua das Mangueiras, 12",
    city: "Fortaleza",
    state: "CE",
    notes: "Cliente fiel — oferecer upgrade no próximo contato.",
    soldBy: "Ana Lima",
    soldAt: "2025-09-05",
    expiresAt: "2025-11-12",
    planType: "ESSENCIAL",
  },
  {
    name: "Juliano Costa",
    email: "juliano.costa@example.com",
    phone: "(51) 99333-5505",
    document: "11111111156",
    companyName: "Costa Automóveis",
    address: "Av. Ipiranga, 999",
    city: "Porto Alegre",
    state: "RS",
    notes: "Necessita de suporte aos domingos.",
    soldBy: "Marina Siqueira",
    soldAt: "2025-08-02",
    expiresAt: "2025-12-18",
    planType: "PREMIUM",
  },
  {
    name: "Amanda Vargas",
    email: "amanda.vargas@example.com",
    phone: "(12) 99110-6606",
    document: "11111111165",
    companyName: "Espaço Vargas",
    address: "Rua dos Pinheiros, 70",
    city: "São José dos Campos",
    state: "SP",
    notes: "Agenda renovação automática.",
    soldBy: "João Martins",
    soldAt: "2025-08-28",
    expiresAt: "2025-11-14",
  },
  {
    name: "Fabrício Teixeira",
    email: "fabricio.teixeira@example.com",
    phone: "(41) 99980-7707",
    document: "11111111174",
    companyName: "FT Coworking",
    address: "Rua XV de Novembro, 310",
    city: "Curitiba",
    state: "PR",
    notes: "Feedback excelente sobre canais esportivos.",
    soldBy: "Ana Lima",
    soldAt: "2025-07-30",
    expiresAt: "2025-12-22",
  },
  {
    name: "Renata Santos",
    email: "renata.santos@example.com",
    phone: "(71) 99811-8808",
    document: "11111111183",
    companyName: "Salvador Fit",
    address: "Av. Oceânica, 420",
    city: "Salvador",
    state: "BA",
    notes: "Solicitou guia impresso dos canais.",
    soldBy: "Marina Siqueira",
    soldAt: "2025-09-10",
    expiresAt: "2026-01-09",
  },
  {
    name: "Gustavo Pontes",
    email: "gustavo.pontes@example.com",
    phone: "(62) 99221-9909",
    document: "11111111192",
    companyName: "Pontes & Associados",
    address: "Rua 7, 310",
    city: "Goiânia",
    state: "GO",
    notes: "Treinar equipe interna sobre app.",
    soldBy: "Luiza Prado",
    soldAt: "2025-10-01",
    expiresAt: "2026-01-20",
  },
  {
    name: "Bianca Freitas",
    email: "bianca.freitas@example.com",
    phone: "(19) 99450-0010",
    document: "11111111201",
    companyName: "Bi Freitas Studio",
    address: "Rua Andrade Neves, 55",
    city: "Campinas",
    state: "SP",
    notes: "Cliente VIP — enviar brindes de fim de ano.",
    soldBy: "Ana Lima",
    soldAt: "2025-09-18",
    expiresAt: "2026-02-02",
  },
  {
    name: "Cláudio Pires",
    email: "claudio.pires@example.com",
    phone: "(48) 99123-1111",
    document: "11111111210",
    companyName: "Pires Consultoria",
    address: "Rua Felipe Schmidt, 200",
    city: "Florianópolis",
    state: "SC",
    notes: "Solicitou treinamento remoto para equipe.",
    soldBy: "Marina Siqueira",
    soldAt: "2025-08-15",
    expiresAt: "2025-12-28",
  },
  {
    name: "Eduarda Luz",
    email: "eduarda.luz@example.com",
    phone: "(16) 99021-1212",
    document: "11111111229",
    companyName: "Luz Beauty",
    address: "Rua São Sebastião, 312",
    city: "Ribeirão Preto",
    state: "SP",
    notes: "Programar campanha de fidelização.",
    soldBy: "João Martins",
    soldAt: "2025-09-05",
    expiresAt: "2025-12-30",
  },
  {
    name: "Tadeu Andrade",
    email: "tadeu.andrade@example.com",
    phone: "(27) 99654-1313",
    document: "11111111238",
    companyName: "Andrade Surf Shop",
    address: "Av. Beira Mar, 45",
    city: "Vitória",
    state: "ES",
    notes: "Interessa em pay-per-view de campeonatos.",
    soldBy: "Luiza Prado",
    soldAt: "2025-10-03",
    expiresAt: "2026-01-28",
  },
  {
    name: "Helena Moura",
    email: "helena.moura@example.com",
    phone: "(98) 99145-1414",
    document: "11111111247",
    companyName: "Moura Pousadas",
    address: "Rua das Palmeiras, 500",
    city: "São Luís",
    state: "MA",
    notes: "Precisa de relatórios mensais de consumo.",
    soldBy: "Marina Siqueira",
    soldAt: "2025-09-12",
    expiresAt: "2026-01-15",
  },
  {
    name: "Valter Rodrigues",
    email: "valter.rodrigues@example.com",
    phone: "(92) 99532-1515",
    document: "11111111256",
    companyName: "VR Madeiras",
    address: "Rua Rio Branco, 210",
    city: "Manaus",
    state: "AM",
    notes: "Solicitou instalação em duas salas adicionais.",
    soldBy: "Ana Lima",
    soldAt: "2025-09-24",
    expiresAt: "2026-02-10",
  },
  {
    name: "Larissa Prado",
    email: "larissa.prado@example.com",
    phone: "(44) 99777-1616",
    document: "11111111265",
    companyName: "Prado Eventos",
    address: "Rua das Figueiras, 140",
    city: "Maringá",
    state: "PR",
    notes: "Enviar proposta de plano corporativo.",
    soldBy: "João Martins",
    soldAt: "2025-10-06",
    expiresAt: "2026-02-15",
  },
  {
    name: "Roberto Campos",
    email: "roberto.campos@example.com",
    phone: "(62) 99890-1717",
    document: "11111111274",
    companyName: "Campos Clínica",
    address: "Rua 10, 215",
    city: "Goiânia",
    state: "GO",
    notes: "Pacote inclui canais infantis para sala de espera.",
    soldBy: "Luiza Prado",
    soldAt: "2025-08-07",
    expiresAt: "2025-11-08",
  },
  {
    name: "Tatiane Fialho",
    email: "tatiane.fialho@example.com",
    phone: "(11) 99664-1818",
    document: "11111111283",
    companyName: "Fialho Design",
    address: "Rua Bela Cintra, 90",
    city: "São Paulo",
    state: "SP",
    notes: "Aguardando instalação de ponto extra.",
    soldBy: "Ana Lima",
    soldAt: "2025-10-02",
    expiresAt: "2026-01-18",
  },
  {
    name: "Erick Paulista",
    email: "erick.paulista@example.com",
    phone: "(81) 99991-1919",
    document: "11111111292",
    companyName: "Paulista Barber",
    address: "Av. Boa Viagem, 61",
    city: "Recife",
    state: "PE",
    notes: "Preferência por canais de esportes.",
    soldBy: "Marina Siqueira",
    soldAt: "2025-09-02",
    expiresAt: "2025-12-25",
  },
  {
    name: "Joice Barros",
    email: "joice.barros@example.com",
    phone: "(47) 99155-2020",
    document: "11111111301",
    companyName: "Barros Idiomas",
    address: "Rua das Gaivotas, 23",
    city: "Itajaí",
    state: "SC",
    notes: "Solicitou treinamento para equipe comercial.",
    soldBy: "João Martins",
    soldAt: "2025-09-30",
    expiresAt: "2026-02-22",
  },
  {
    name: "Eduardo Paiva",
    email: "eduardo.paiva@example.com",
    phone: "(31) 99543-2121",
    document: "11111111310",
    companyName: "Paiva Cowork",
    address: "Av. Afonso Pena, 1120",
    city: "Belo Horizonte",
    state: "MG",
    notes: "Planeja abrir nova unidade em março.",
    soldBy: "Luiza Prado",
    soldAt: "2025-10-09",
    expiresAt: "2026-02-27",
  },
  {
    name: "Camila Souza",
    email: "camila.souza@example.com",
    phone: "(21) 99773-2222",
    document: "11111111329",
    companyName: "Souza Pet",
    address: "Rua do Catete, 401",
    city: "Rio de Janeiro",
    state: "RJ",
    notes: "Enviar pesquisa de satisfação em dezembro.",
    soldBy: "Ana Lima",
    soldAt: "2025-09-08",
    expiresAt: "2026-02-12",
  },
  {
    name: "Luís Otávio Gomes",
    email: "luis.gomes@example.com",
    phone: "(85) 99622-2323",
    document: "11111111338",
    companyName: "Gomes Advocacia",
    address: "Av. Beira Mar, 330",
    city: "Fortaleza",
    state: "CE",
    notes: "Interessa em combo internet + TV.",
    soldBy: "Marina Siqueira",
    soldAt: "2025-09-27",
    expiresAt: "2026-03-05",
  },
  {
    name: "Letícia Mourão",
    email: "leticia.mourao@example.com",
    phone: "(32) 99712-2424",
    document: "11111111347",
    companyName: "Mourão Café",
    address: "Rua Halfeld, 410",
    city: "Juiz de Fora",
    state: "MG",
    notes: "Precisa de nota fiscal discriminada.",
    soldBy: "Luiza Prado",
    soldAt: "2025-09-18",
    expiresAt: "2026-03-12",
  },
  {
    name: "Paulo Mendes",
    email: "paulo.mendes@example.com",
    phone: "(84) 99133-2525",
    document: "11111111356",
    companyName: "Mendes Hotel",
    address: "Rua das Dunas, 121",
    city: "Natal",
    state: "RN",
    notes: "Solicitou programação em inglês.",
    soldBy: "Ana Lima",
    soldAt: "2025-10-04",
    expiresAt: "2026-03-18",
  },
  {
    name: "Bruna Vilela",
    email: "bruna.vilela@example.com",
    phone: "(51) 99441-2626",
    document: "11111111365",
    companyName: "Vilela Decor",
    address: "Rua da República, 66",
    city: "Porto Alegre",
    state: "RS",
    notes: "Solicitou instalação em showroom.",
    soldBy: "João Martins",
    soldAt: "2025-09-28",
    expiresAt: "2026-03-22",
  },
  {
    name: "Caio Martins",
    email: "caio.martins@example.com",
    phone: "(11) 99912-2727",
    document: "11111111374",
    companyName: "Martins Cowork",
    address: "Av. Paulista, 1800",
    city: "São Paulo",
    state: "SP",
    notes: "Interessado em treinamento para equipe técnica.",
    soldBy: "Ana Lima",
    soldAt: "2025-09-29",
    expiresAt: "2026-03-25",
  },
  {
    name: "Isabela Nery",
    email: "isabela.nery@example.com",
    phone: "(81) 99845-2828",
    document: "11111111383",
    companyName: "Nery Pilates",
    address: "Rua do Sol, 32",
    city: "Recife",
    state: "PE",
    notes: "Solicitou relatório trimestral.",
    soldBy: "Marina Siqueira",
    soldAt: "2025-10-08",
    expiresAt: "2026-03-29",
  },
  {
    name: "Marcelo Batista",
    email: "marcelo.batista@example.com",
    phone: "(21) 99660-2929",
    document: "11111111392",
    companyName: "Batista Games",
    address: "Av. Brasil, 2400",
    city: "Rio de Janeiro",
    state: "RJ",
    notes: "Cliente gamer — avaliar canais premium.",
    soldBy: "Luiza Prado",
    soldAt: "2025-10-11",
    expiresAt: "2026-04-02",
  },
  {
    name: "Sônia Caldas",
    email: "sonia.caldas@example.com",
    phone: "(31) 99241-3030",
    document: "11111111401",
    companyName: "Caldas Restaurante",
    address: "Rua da Bahia, 500",
    city: "Belo Horizonte",
    state: "MG",
    notes: "Deseja incluir canais de notícias internacionais.",
    soldBy: "Ana Lima",
    soldAt: "2025-10-13",
    expiresAt: "2026-04-08",
  },
];

async function findOrCreateTvService(): Promise<string> {
  const { data: existing } = await supabase
    .from("services")
    .select("id, name")
    .ilike("name", "%tv%");

  if (existing?.length) {
    return existing[0].id;
  }

  const { data, error } = await supabase
    .from("services")
    .insert({ name: "TV", description: "Assinatura de TV", price: 99 })
    .select("id")
    .maybeSingle();

  if (error || !data) {
    throw error ?? new Error("Falha ao criar serviço de TV");
  }

  return data.id;
}

async function ensureClientService(clientId: string, serviceId: string) {
  const { data: existing } = await supabase
    .from("client_services")
    .select("id")
    .eq("client_id", clientId)
    .eq("service_id", serviceId)
    .maybeSingle();

  if (existing) {
    return;
  }

  const { error } = await supabase.from("client_services").insert({ client_id: clientId, service_id: serviceId });

  if (error) {
    throw error;
  }
}

async function upsertClient(seed: SeedClient) {
  const { data: existing } = await supabase
    .from("clients")
    .select("id")
    .eq("email", seed.email)
    .maybeSingle();

  if (existing) {
    return existing.id;
  }

  const { data, error } = await supabase
    .from("clients")
    .insert({
      name: seed.name,
      email: seed.email,
      phone: seed.phone,
      document: seed.document,
      company_name: seed.companyName,
      address: seed.address,
      city: seed.city,
      state: seed.state,
      notes: seed.notes,
    })
    .select("id")
    .maybeSingle();

  if (error || !data) {
    throw error ?? new Error("Falha ao inserir cliente");
  }

  return data.id;
}

async function ensureAssignment(clientId: string, seed: SeedClient, planType: TVPlanType) {
  const { data: currentAssignment } = await supabase
    .from("tv_slots")
    .select("id")
    .eq("client_id", clientId)
    .maybeSingle();

  if (currentAssignment) {
    await releaseSlotsForClient(clientId);
  }

  await assignSlotToClient({
    clientId,
    soldBy: seed.soldBy,
    soldAt: new Date(`${seed.soldAt}T12:00:00`).toISOString(),
    expiresAt: seed.expiresAt,
    notes: seed.notes,
    planType,
  });
}

async function main() {
  try {
    const tvServiceId = await findOrCreateTvService();

    for (let index = 0; index < seedClients.length; index += 1) {
      const seed = seedClients[index];
      const planType: TVPlanType = seed.planType ?? (index % 2 === 0 ? "ESSENCIAL" : "PREMIUM");
      const clientId = await upsertClient(seed);
      await ensureClientService(clientId, tvServiceId);
      await ensureAssignment(clientId, seed, planType);
      console.log(`Cliente ${seed.name} processado.`);
    }

    console.log("Seed de clientes de TV concluído com sucesso.");
    process.exit(0);
  } catch (error) {
    console.error("Falha ao executar seed: ", error);
    process.exit(1);
  }
}

main();
