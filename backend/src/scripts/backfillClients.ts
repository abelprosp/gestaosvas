import "dotenv/config";
import supabase from "../supabaseClient";
import { assignSlotToClient } from "../services/tvAssignments";

type DocumentType = "CPF" | "CNPJ";

type NewClientSeed = {
  name: string;
  email: string;
  phone: string;
  companyName: string;
  city: string;
  state: string;
  notes: string;
};

const GOAL_NEW_CLIENTS = 30;
const TV_GOAL_PLAN_TYPES: Array<"ESSENCIAL" | "PREMIUM"> = ["ESSENCIAL", "PREMIUM"];

// ⚠️ IMPORTANTE: Credenciais devem vir de variáveis de ambiente
// Configure no .env ou passe como variáveis:
// VENDOR_LUCAS_EMAIL=lucas.vendas@nexusrs.com.br
// VENDOR_LUCAS_PASSWORD=senha-segura
// VENDOR_RAFAEL_EMAIL=rafael.vendas@nexusrs.com.br
// VENDOR_RAFAEL_PASSWORD=senha-segura

const VENDORS = [
  {
    name: "Lucas Almeida",
    email: process.env.VENDOR_LUCAS_EMAIL || "lucas.vendas@nexusrs.com.br",
    password: process.env.VENDOR_LUCAS_PASSWORD || "",
  },
  {
    name: "Rafael Martins",
    email: process.env.VENDOR_RAFAEL_EMAIL || "rafael.vendas@nexusrs.com.br",
    password: process.env.VENDOR_RAFAEL_PASSWORD || "",
  },
].filter((v) => v.password) as Array<{ name: string; email: string; password: string }>;

if (VENDORS.length === 0) {
  console.error("❌ Erro: Nenhuma credencial de vendedor configurada!");
  console.error("");
  console.error("Configure no .env:");
  console.error("  VENDOR_LUCAS_EMAIL=lucas.vendas@nexusrs.com.br");
  console.error("  VENDOR_LUCAS_PASSWORD=senha-segura");
  console.error("  VENDOR_RAFAEL_EMAIL=rafael.vendas@nexusrs.com.br");
  console.error("  VENDOR_RAFAEL_PASSWORD=senha-segura");
  console.error("");
  process.exit(1);
}

const SEED_CLIENTS: NewClientSeed[] = [
  {
    name: "Anderson Figueiredo",
    email: "anderson.figueiredo@example.com",
    phone: "(11) 99610-2001",
    companyName: "Figueiredo Tech Studio",
    city: "São Paulo",
    state: "SP",
    notes: "Interessado em pacote esportivo completo.",
  },
  {
    name: "Renata Moraes",
    email: "renata.moraes@example.com",
    phone: "(21) 99540-2002",
    companyName: "Moraes Boutique",
    city: "Rio de Janeiro",
    state: "RJ",
    notes: "Solicitou material de divulgação para clientes.",
  },
  {
    name: "Thiago Matos",
    email: "thiago.matos@example.com",
    phone: "(31) 99770-2003",
    companyName: "Matos Cowork",
    city: "Belo Horizonte",
    state: "MG",
    notes: "Instalar ponto extra na recepção.",
  },
  {
    name: "Larissa Campos",
    email: "larissa.campos@example.com",
    phone: "(41) 99811-2004",
    companyName: "Campos Estética",
    city: "Curitiba",
    state: "PR",
    notes: "Agendar treinamento para equipe.",
  },
  {
    name: "Marcos Pacheco",
    email: "marcos.pacheco@example.com",
    phone: "(71) 99155-2005",
    companyName: "Pacheco Restaurante",
    city: "Salvador",
    state: "BA",
    notes: "Interesse em canais gastronômicos.",
  },
  {
    name: "Beatriz Silveira",
    email: "beatriz.silveira@example.com",
    phone: "(85) 99441-2006",
    companyName: "Silveira Pilates",
    city: "Fortaleza",
    state: "CE",
    notes: "Adicionar sala de espera infantil.",
  },
  {
    name: "Rodrigo Paes",
    email: "rodrigo.paes@example.com",
    phone: "(62) 99320-2007",
    companyName: "Paes Advocacia",
    city: "Goiânia",
    state: "GO",
    notes: "Enviar proposta corporativa.",
  },
  {
    name: "Juliana Teles",
    email: "juliana.teles@example.com",
    phone: "(48) 99980-2008",
    companyName: "Teles Turismo",
    city: "Florianópolis",
    state: "SC",
    notes: "Precisa de canais multilíngues.",
  },
  {
    name: "Caio Antunes",
    email: "caio.antunes@example.com",
    phone: "(98) 99700-2009",
    companyName: "Antunes Imóveis",
    city: "São Luís",
    state: "MA",
    notes: "Disponibilizar aplicativo para corretores.",
  },
  {
    name: "Luana Barreto",
    email: "luana.barreto@example.com",
    phone: "(83) 99666-2010",
    companyName: "Barreto Café",
    city: "João Pessoa",
    state: "PB",
    notes: "Avaliar upgrade para plano Premium.",
  },
  {
    name: "Felipe Vasconcelos",
    email: "felipe.vasconcelos@example.com",
    phone: "(51) 99555-2011",
    companyName: "Vasconcelos Fit",
    city: "Porto Alegre",
    state: "RS",
    notes: "Solicitou relatórios de acesso mensal.",
  },
  {
    name: "Patrícia Nunes",
    email: "patricia.nunes@example.com",
    phone: "(27) 99432-2012",
    companyName: "Nunes Hotel",
    city: "Vitória",
    state: "ES",
    notes: "Instalar TVs nos quartos premium.",
  },
  {
    name: "Gabriel Tavares",
    email: "gabriel.tavares@example.com",
    phone: "(34) 99520-2013",
    companyName: "Tavares Games",
    city: "Uberlândia",
    state: "MG",
    notes: "Clientes pedem canais de e-sports.",
  },
  {
    name: "Mirela Porto",
    email: "mirela.porto@example.com",
    phone: "(44) 99144-2014",
    companyName: "Porto Dance",
    city: "Maringá",
    state: "PR",
    notes: "Programar playlist temática semanal.",
  },
  {
    name: "Samuel Furtado",
    email: "samuel.furtado@example.com",
    phone: "(92) 99222-2015",
    companyName: "Furtado Clínica",
    city: "Manaus",
    state: "AM",
    notes: "Criar guias impressos para pacientes.",
  },
  {
    name: "Natália Alves",
    email: "natalia.alves@example.com",
    phone: "(24) 99888-2016",
    companyName: "Alves Turismo",
    city: "Petrópolis",
    state: "RJ",
    notes: "Upgrade planejado para dezembro.",
  },
  {
    name: "Sérgio Guimarães",
    email: "sergio.guimaraes@example.com",
    phone: "(67) 99111-2017",
    companyName: "Guimarães Motors",
    city: "Campo Grande",
    state: "MS",
    notes: "Canais 24h em área de clientes.",
  },
  {
    name: "Talita Peixoto",
    email: "talita.peixoto@example.com",
    phone: "(82) 99321-2018",
    companyName: "Peixoto Decor",
    city: "Maceió",
    state: "AL",
    notes: "Adicionar canais de design e arquitetura.",
  },
  {
    name: "Rogério Prado",
    email: "rogerio.prado@example.com",
    phone: "(35) 99177-2019",
    companyName: "Prado Logística",
    city: "Poços de Caldas",
    state: "MG",
    notes: "Solicitou treinamento remoto trimestral.",
  },
  {
    name: "Clara Viana",
    email: "clara.viana@example.com",
    phone: "(17) 99299-2020",
    companyName: "Viana Gourmet",
    city: "São José do Rio Preto",
    state: "SP",
    notes: "Personalizar grade com canais culinários.",
  },
  {
    name: "Marcelo Duarte",
    email: "marcelo.duarte@example.com",
    phone: "(19) 99944-2021",
    companyName: "Duarte Cowork",
    city: "Campinas",
    state: "SP",
    notes: "Verificar disponibilidade de planos corporativos.",
  },
  {
    name: "Ana Karla Ferreira",
    email: "ana.ferreira@example.com",
    phone: "(12) 99487-2022",
    companyName: "Ferreira Studio",
    city: "São José dos Campos",
    state: "SP",
    notes: "Enviar resumo de consumo mensal.",
  },
  {
    name: "Henrique Paiva",
    email: "henrique.paiva@example.com",
    phone: "(16) 99356-2023",
    companyName: "Paiva Tattoo",
    city: "Ribeirão Preto",
    state: "SP",
    notes: "Canais de música alternativa preferidos.",
  },
  {
    name: "Priscila Duarte",
    email: "priscila.duarte@example.com",
    phone: "(91) 99705-2024",
    companyName: "Duarte Kids",
    city: "Belém",
    state: "PA",
    notes: "Criar área infantil personalizada.",
  },
  {
    name: "Leandro Azevedo",
    email: "leandro.azevedo@example.com",
    phone: "(43) 99661-2025",
    companyName: "Azevedo Digital",
    city: "Londrina",
    state: "PR",
    notes: "Solicitou canais internacionais adicionais.",
  },
  {
    name: "Viviane Pires",
    email: "viviane.pires@example.com",
    phone: "(15) 99521-2026",
    companyName: "Pires Spa",
    city: "Sorocaba",
    state: "SP",
    notes: "Acompanhar avaliação de clientes premium.",
  },
  {
    name: "Daniela Rocha",
    email: "daniela.rocha@example.com",
    phone: "(86) 99234-2027",
    companyName: "Rocha Hotel",
    city: "Teresina",
    state: "PI",
    notes: "Atualizar grade com canais turísticos.",
  },
  {
    name: "Igor Sales",
    email: "igor.sales@example.com",
    phone: "(13) 99158-2028",
    companyName: "Sales Surf Shop",
    city: "Santos",
    state: "SP",
    notes: "Preferência por canais esportivos em HD.",
  },
  {
    name: "Melissa Cardoso",
    email: "melissa.cardoso@example.com",
    phone: "(45) 99698-2029",
    companyName: "Cardoso Clínica",
    city: "Foz do Iguaçu",
    state: "PR",
    notes: "Solicitou monitor de espera interativo.",
  },
  {
    name: "Alexandre Prado",
    email: "alexandre.prado@example.com",
    phone: "(14) 99284-2030",
    companyName: "Prado Educacional",
    city: "Bauru",
    state: "SP",
    notes: "Instalar conteúdo educativo na biblioteca.",
  },
  {
    name: "Helena Batista",
    email: "helena.batista@example.com",
    phone: "(98) 99474-2031",
    companyName: "Batista Grill",
    city: "São Luís",
    state: "MA",
    notes: "Pacote de música ambiente solicitado.",
  },
];

function randomChoice<T>(items: T[]): T {
  return items[Math.floor(Math.random() * items.length)];
}

function generateDigits(length: number) {
  const digits = Array.from({ length }, () => Math.floor(Math.random() * 10)).join("");
  return digits;
}

function generateDocument(type: DocumentType, used: Set<string>): string {
  let doc = "";
  do {
    doc = generateDigits(type === "CPF" ? 11 : 14);
  } while (used.has(doc));
  used.add(doc);
  return doc;
}

function randomInt(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomDateBetween(start: Date, end: Date) {
  const startTime = start.getTime();
  const endTime = end.getTime();
  const timestamp = startTime + Math.random() * (endTime - startTime);
  return new Date(timestamp);
}

function getDefaultSaleRange() {
  const end = new Date();
  const start = new Date(end);
  start.setMonth(start.getMonth() - 11);
  start.setDate(1);
  start.setHours(0, 0, 0, 0);
  end.setHours(23, 59, 59, 999);
  return { start, end };
}

function addYears(date: Date, years: number) {
  const clone = new Date(date);
  clone.setFullYear(clone.getFullYear() + years);
  return clone;
}

function pickRandomSubset<T>(items: readonly T[], maximum: number): T[] {
  if (!items.length || maximum <= 0) {
    return [];
  }
  const shuffled = [...items];
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = randomInt(0, index);
    [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
  }
  const count = randomInt(0, Math.min(maximum, shuffled.length));
  return shuffled.slice(0, count);
}

type ServiceOption = {
  id: string;
  name: string;
};

type ServiceCatalog = {
  tvServiceId: string | null;
  additionalServices: ServiceOption[];
};

async function fetchServiceCatalog(): Promise<ServiceCatalog> {
  const { data, error } = await supabase.from("services").select("id, name");
  if (error) {
    console.error("Falha ao consultar serviços cadastrados", error);
    return { tvServiceId: null, additionalServices: [] };
  }

  const services = (data ?? []).filter((service) => service?.id && service?.name) as Array<{ id: string; name: string }>;
  const tvEntry = services.find((service) => service.name.toLowerCase().includes("tv")) ?? null;
  const additional = services.filter((service) => !tvEntry || service.id !== tvEntry.id);

  return {
    tvServiceId: tvEntry?.id ?? null,
    additionalServices: additional,
  };
}

async function ensureVendors() {
  const existingUsers = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 });
  if (existingUsers.error) {
    throw existingUsers.error;
  }

  for (const vendor of VENDORS) {
    const alreadyThere = existingUsers.data.users.find(
      (user) => user.email?.toLowerCase() === vendor.email.toLowerCase(),
    );
    if (alreadyThere) {
      if ((alreadyThere.user_metadata as { name?: string } | undefined)?.name !== vendor.name) {
        await supabase.auth.admin.updateUserById(alreadyThere.id, {
          user_metadata: {
            ...(alreadyThere.user_metadata as Record<string, unknown>),
            name: vendor.name,
          },
        });
      }
      continue;
    }

    const created = await supabase.auth.admin.createUser({
      email: vendor.email,
      password: vendor.password,
      email_confirm: true,
      user_metadata: { role: "user", name: vendor.name },
    });

    if (created.error) {
      console.error(`Falha ao criar vendedor ${vendor.email}`, created.error);
    } else {
      console.log(`Vendedor criado: ${vendor.name} (${vendor.email})`);
    }
  }
}

async function updateClientsCostCenter(usedDocuments: Set<string>) {
  const { data: clients, error } = await supabase.from("clients").select("id, document");
  if (error) {
    throw error;
  }

  const half = Math.ceil((clients?.length ?? 0) / 2);
  let cpfCount = 0;

  for (const client of clients ?? []) {
    const docType: DocumentType = cpfCount < half ? "CPF" : "CNPJ";
    const newDocument = generateDocument(docType, usedDocuments);
    cpfCount += docType === "CPF" ? 1 : 0;

    const randomCenter = Math.random() < 0.5 ? "LUXUS" : "NEXUS";
    const { error: updateError } = await supabase
      .from("clients")
      .update({ cost_center: randomCenter, document: newDocument })
      .eq("id", client.id);
    if (updateError) {
      console.error(`Falha ao atualizar cliente ${client.id}`, updateError);
    }
  }

  console.log("Centro de custo e documentos atualizados para clientes existentes.");
}

async function randomizeClientServiceDates() {
  const { start, end } = getDefaultSaleRange();
  const { data, error } = await supabase.from("client_services").select("id");
  if (error) {
    console.error("Falha ao listar serviços existentes para randomização de datas", error);
    return;
  }

  for (const relation of data ?? []) {
    const randomDate = randomDateBetween(start, end).toISOString();
    const { error: updateError } = await supabase
      .from("client_services")
      .update({ created_at: randomDate })
      .eq("id", relation.id);
    if (updateError) {
      console.error(`Falha ao atualizar data do serviço ${relation.id}`, updateError);
    }
  }
}

async function seedAdditionalClients(usedDocuments: Set<string>) {
  const vendorNames = VENDORS.map((vendor) => vendor.name);
  const { tvServiceId, additionalServices } = await fetchServiceCatalog();
  const { start: saleStart, end: saleEnd } = getDefaultSaleRange();

  let createdCount = 0;

  for (const seed of SEED_CLIENTS.slice(0, GOAL_NEW_CLIENTS)) {
    const docType: DocumentType = createdCount % 2 === 0 ? "CPF" : "CNPJ";
    const document = generateDocument(docType, usedDocuments);
    const costCenter = Math.random() < 0.5 ? "NEXUS" : "LUXUS";
    const soldBy = randomChoice(vendorNames);
    const saleDate = randomDateBetween(saleStart, saleEnd);
    const expirationDate = addYears(saleDate, 1);

    const { data, error } = await supabase
      .from("clients")
      .insert({
        name: seed.name,
        email: seed.email,
        phone: seed.phone,
        document,
        cost_center: costCenter,
        company_name: seed.companyName,
        notes: seed.notes,
        address: `${seed.city}, ${seed.state}`,
        city: seed.city,
        state: seed.state,
        created_at: saleDate.toISOString(),
        updated_at: saleDate.toISOString(),
      })
      .select("id")
      .maybeSingle();

    if (error || !data) {
      console.error("Falha ao criar cliente adicional", seed.name, error);
      continue;
    }

    createdCount += 1;

    if (tvServiceId) {
      await supabase
        .from("client_services")
        .insert({ client_id: data.id, service_id: tvServiceId, created_at: saleDate.toISOString() });
    }

    const optionalServices = pickRandomSubset(additionalServices, 3);
    for (const service of optionalServices) {
      const serviceDate = randomDateBetween(saleDate, saleEnd).toISOString();
      const { error: additionalError } = await supabase.from("client_services").insert({
        client_id: data.id,
        service_id: service.id,
        created_at: serviceDate,
      });
      if (additionalError) {
        console.error(`Falha ao vincular serviço adicional ${service.name} para ${seed.name}`, additionalError);
      }
    }

    try {
      await assignSlotToClient({
        clientId: data.id,
        soldBy,
        soldAt: saleDate.toISOString(),
        expiresAt: expirationDate.toISOString().slice(0, 10),
        notes: seed.notes,
        planType: randomChoice(TV_GOAL_PLAN_TYPES),
      });
    } catch (errorAssign) {
      console.error("Falha ao atribuir TV para cliente", seed.name, errorAssign);
    }
  }

  console.log(`${createdCount} novos clientes foram cadastrados.`);
}

async function assignTvVendors() {
  const vendorNames = VENDORS.map((vendor) => vendor.name);
  const { data: slots, error } = await supabase
    .from("tv_slots")
    .select("id, status")
    .in("status", ["ASSIGNED", "SUSPENDED", "INACTIVE"]);
  if (error) {
    if (error.code && error.code.startsWith("PGRST2")) {
      console.warn("Tabelas de TV não estão disponíveis. Pulando associação de vendedores.");
      return;
    }
    throw error;
  }

  for (const slot of slots ?? []) {
    const randomVendor = randomChoice(vendorNames);
    const { error: updateError } = await supabase
      .from("tv_slots")
      .update({ sold_by: randomVendor })
      .eq("id", slot.id);
    if (updateError) {
      console.error(`Falha ao atualizar vendedor do slot ${slot.id}`, updateError);
    }
  }
  console.log("Vendedores atribuídos aos acessos de TV.");
}

async function main() {
  try {
    await ensureVendors();

    const usedDocuments = new Set<string>();
    await updateClientsCostCenter(usedDocuments);
    await randomizeClientServiceDates();
    await seedAdditionalClients(usedDocuments);
    await assignTvVendors();

    console.log("Backfill concluído com sucesso.");
  } catch (error) {
    console.error("Falha no backfill:", error);
    process.exitCode = 1;
  }
}

main();

