import "dotenv/config";
import supabase from "../supabaseClient";
import { assignSlotToClient } from "../services/tvAssignments";

const TARGET_CLIENTS = 40;
const MAX_ASSIGN_ATTEMPTS = 3;
const ASSIGN_RETRY_DELAY_MS = 1500;
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

const FIRST_NAMES = [
  "Ana",
  "Bruno",
  "Carlos",
  "Daniela",
  "Eduardo",
  "Fernanda",
  "Gabriel",
  "Helena",
  "Igor",
  "Julia",
  "Karen",
  "Leonardo",
  "Marina",
  "Natália",
  "Otávio",
  "Paula",
  "Rafael",
  "Sabrina",
  "Tiago",
  "Vitória",
  "William",
  "Yara",
  "Zilda",
];

const LAST_NAMES = [
  "Almeida",
  "Barbosa",
  "Cardoso",
  "Dias",
  "Esteves",
  "Figueiredo",
  "Gonçalves",
  "Henriques",
  "Ibrahim",
  "Junqueira",
  "Klein",
  "Lima",
  "Macedo",
  "Nascimento",
  "Oliveira",
  "Pereira",
  "Queiroz",
  "Rodrigues",
  "Silva",
  "Teixeira",
  "Uchoa",
  "Vieira",
  "Xavier",
  "Zamora",
];

const COMPANY_SUFFIXES = [
  "Tech",
  "Consultoria",
  "Gourmet",
  "Studio",
  "Logística",
  "Cowork",
  "Hospitality",
  "Eventos",
  "Design",
  "Motors",
  "Academia",
  "Coworking",
  "Hotel",
  "Barbearia",
  "Streaming",
  "Pet",
];

const STREET_NAMES = [
  "Rua das Flores",
  "Avenida Brasil",
  "Rua das Palmeiras",
  "Rua das Acácias",
  "Rua Dom Pedro",
  "Avenida Atlântica",
  "Rua da Consolação",
  "Avenida Paulista",
  "Rua XV de Novembro",
  "Rua das Mangueiras",
  "Rua Bento Gonçalves",
  "Rua dos Pinheiros",
  "Rua São João",
  "Rua Amazonas",
  "Rua das Figueiras",
];

const CITIES = [
  { city: "São Paulo", state: "SP", ddd: "11" },
  { city: "Rio de Janeiro", state: "RJ", ddd: "21" },
  { city: "Belo Horizonte", state: "MG", ddd: "31" },
  { city: "Curitiba", state: "PR", ddd: "41" },
  { city: "Salvador", state: "BA", ddd: "71" },
  { city: "Fortaleza", state: "CE", ddd: "85" },
  { city: "Goiânia", state: "GO", ddd: "62" },
  { city: "Florianópolis", state: "SC", ddd: "48" },
  { city: "Manaus", state: "AM", ddd: "92" },
  { city: "Recife", state: "PE", ddd: "81" },
  { city: "Porto Alegre", state: "RS", ddd: "51" },
  { city: "Natal", state: "RN", ddd: "84" },
  { city: "Belém", state: "PA", ddd: "91" },
  { city: "João Pessoa", state: "PB", ddd: "83" },
  { city: "Maceió", state: "AL", ddd: "82" },
];

type PlanType = "ESSENCIAL" | "PREMIUM";

type DocumentType = "CPF" | "CNPJ";

type GeneratedClient = {
  name: string;
  email: string;
  phone: string;
  document: string;
  costCenter: "LUXUS" | "NEXUS";
  companyName: string;
  address: string;
  city: string;
  state: string;
  notes: string;
  soldBy: string;
  soldAt: string;
  soldAtDate: Date;
  expiresAt: string;
  planType: PlanType;
};

type ServiceOption = {
  id: string;
  name: string;
};

type ServiceCatalog = {
  tvServiceId: string | null;
  additionalServices: ServiceOption[];
};

function randomChoice<T>(items: readonly T[]): T {
  return items[Math.floor(Math.random() * items.length)];
}

function randomInt(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function generateDigits(length: number) {
  return Array.from({ length }, () => randomInt(0, 9)).join("");
}

function generateUniqueDocument(type: DocumentType, used: Set<string>) {
  let candidate = "";
  do {
    candidate = generateDigits(type === "CPF" ? 11 : 14);
  } while (used.has(candidate));
  used.add(candidate);
  return candidate;
}

function slugifyName(name: string) {
  return name
    .normalize("NFD")
    .replace(/[^a-zA-Z\s]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .toLowerCase();
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

function addMonths(date: Date, months: number) {
  const clone = new Date(date);
  clone.setMonth(clone.getMonth() + months);
  return clone;
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

function createRandomClient(usedDocuments: Set<string>): GeneratedClient {
  const { city, state, ddd } = randomChoice(CITIES);
  const first = randomChoice(FIRST_NAMES);
  const last = randomChoice(LAST_NAMES);
  const name = `${first} ${last}`;
  const docType: DocumentType = Math.random() < 0.5 ? "CPF" : "CNPJ";
  const document = generateUniqueDocument(docType, usedDocuments);
  const companyName = `${last} ${randomChoice(COMPANY_SUFFIXES)}`;
  const emailSlug = slugifyName(`${first}.${last}`);
  const email = `${emailSlug}${randomInt(10, 99)}@example.com`;
  const phone = `(${ddd}) 9${generateDigits(4)}-${generateDigits(4)}`;
  const address = `${randomChoice(STREET_NAMES)}, ${randomInt(10, 999)}`;
  const notes = "Cliente gerado automaticamente.";
  const soldBy = randomChoice(VENDORS).name;
  const { start, end } = getDefaultSaleRange();
  const saleDate = randomDateBetween(start, end);
  const expiresAt = addYears(saleDate, 1);
  const planType = randomChoice<PlanType>(["ESSENCIAL", "PREMIUM"]);

  return {
    name,
    email,
    phone,
    document,
    costCenter: Math.random() < 0.5 ? "LUXUS" : "NEXUS",
    companyName,
    address,
    city,
    state,
    notes,
    soldBy,
    soldAt: saleDate.toISOString(),
    soldAtDate: saleDate,
    expiresAt: expiresAt.toISOString().slice(0, 10),
    planType,
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
      const metadata = (alreadyThere.user_metadata as { name?: string } | undefined) ?? {};
      if (metadata.name !== vendor.name) {
        await supabase.auth.admin.updateUserById(alreadyThere.id, {
          user_metadata: { ...metadata, name: vendor.name },
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

async function emailExists(email: string): Promise<boolean> {
  const { data, error } = await supabase.from("clients").select("id").eq("email", email).maybeSingle();
  if (error) {
    console.error("Falha ao verificar e-mail existente", email, error);
    return true;
  }
  return Boolean(data);
}

async function loadUsedDocuments(): Promise<Set<string>> {
  const used = new Set<string>();
  const { data, error } = await supabase.from("clients").select("document");
  if (error) {
    console.error("Falha ao carregar documentos existentes", error);
    return used;
  }
  (data ?? []).forEach((row) => {
    if (!row.document) return;
    used.add(row.document.replace(/\D/g, ""));
  });
  return used;
}

async function generateClients() {
  await ensureVendors();
  const { tvServiceId, additionalServices } = await fetchServiceCatalog();

  const usedDocuments = await loadUsedDocuments();
  let created = 0;

  while (created < TARGET_CLIENTS) {
    const candidate = createRandomClient(usedDocuments);

    if (await emailExists(candidate.email)) {
      continue;
    }

    console.log(`[${created + 1}/${TARGET_CLIENTS}] Inserindo cliente ${candidate.name} (${candidate.email})`);

    const { data: inserted, error: insertError } = await supabase
      .from("clients")
      .insert({
        name: candidate.name,
        email: candidate.email,
        phone: candidate.phone,
        document: candidate.document,
        cost_center: candidate.costCenter,
        company_name: candidate.companyName,
        notes: candidate.notes,
        address: candidate.address,
        city: candidate.city,
        state: candidate.state,
        created_at: candidate.soldAt,
        updated_at: candidate.soldAt,
      })
      .select("id")
      .maybeSingle();

    if (insertError || !inserted) {
      console.error("Falha ao inserir cliente", candidate.name, insertError);
      continue;
    }

    created += 1;

    if (tvServiceId) {
      const { error: serviceError } = await supabase
        .from("client_services")
        .insert({ client_id: inserted.id, service_id: tvServiceId, created_at: candidate.soldAt });
      if (serviceError) {
        console.error("Falha ao vincular serviço", candidate.name, serviceError);
      }
    }

    const optionalServices = pickRandomSubset(additionalServices, 3);
    for (const service of optionalServices) {
      const serviceDate = addMonths(candidate.soldAtDate, randomInt(0, 3));
      const { error: additionalError } = await supabase.from("client_services").insert({
        client_id: inserted.id,
        service_id: service.id,
        created_at: serviceDate.toISOString(),
      });
      if (additionalError) {
        console.error(`Falha ao vincular serviço adicional ${service.name} para ${candidate.name}`, additionalError);
      }
    }

    let assigned = false;
    for (let attempt = 1; attempt <= MAX_ASSIGN_ATTEMPTS && !assigned; attempt += 1) {
      try {
        console.log(
          `  → Tentando gerar acesso de TV (tentativa ${attempt}/${MAX_ASSIGN_ATTEMPTS}) para ${candidate.name}`,
        );
        await assignSlotToClient({
          clientId: inserted.id,
          soldBy: candidate.soldBy,
          soldAt: candidate.soldAt,
          expiresAt: candidate.expiresAt,
          notes: candidate.notes,
          planType: candidate.planType,
        });
        assigned = true;
      } catch (error) {
        console.error("    Falha ao atribuir acesso de TV", candidate.name, error);
        if (attempt < MAX_ASSIGN_ATTEMPTS) {
          await new Promise((resolve) => setTimeout(resolve, ASSIGN_RETRY_DELAY_MS));
        }
      }
    }

    if (!assigned) {
      console.warn(
        `  → Não foi possível gerar acesso de TV para ${candidate.name}. Continue após verificar o backend/Supabase.`,
      );
    } else {
      console.log(`  ✓ Acesso de TV gerado para ${candidate.name}\n`);
    }
  }

  console.log(`${created} clientes gerados com sucesso.`);
}

async function main() {
  const startedAt = Date.now();
  try {
    await generateClients();
    const elapsed = ((Date.now() - startedAt) / 1000).toFixed(1);
    console.log(`Processo concluído em ${elapsed} segundos.`);
  } catch (error) {
    console.error("Erro ao gerar clientes aleatórios:", error);
    process.exitCode = 1;
  }
}

main();
