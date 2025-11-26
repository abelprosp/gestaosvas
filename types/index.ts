export interface Service {
  id: string;
  name: string;
  description?: string | null;
  price: number;
  allowCustomPrice: boolean;
  customPrice?: number | null;
  // Preços específicos para TV Essencial e Premium (fragmentos do serviço TV)
  customPriceEssencial?: number | null;
  customPricePremium?: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface TVAccount {
  id: string;
  email: string;
  createdAt: string;
}

export type TVPlanType = "ESSENCIAL" | "PREMIUM";

export interface TVSlot {
  id: string;
  tvAccountId: string;
  slotNumber: number;
  username: string;
  password: string;
  status: "AVAILABLE" | "ASSIGNED" | "INACTIVE" | "SUSPENDED" | "USED";
  clientId?: string | null;
  soldBy?: string | null;
  soldAt?: string | null;
  startsAt?: string | null;
  expiresAt?: string | null;
  notes?: string | null;
  planType?: TVPlanType | null;
  hasTelephony?: boolean | null;
  createdAt: string;
  updatedAt: string;
  account?: TVAccount;
}

export interface TVSlotHistory {
  id: string;
  action: string;
  metadata?: Record<string, unknown> | null;
  createdAt: string;
}

export interface ClientTVAssignment {
  slotId: string;
  slotNumber: number;
  username: string;
  email: string;
  password: string;
  status: TVSlot["status"];
  soldBy?: string | null;
  soldAt?: string | null;
  startsAt?: string | null;
  expiresAt?: string | null;
  notes?: string | null;
  planType?: TVPlanType | null;
  hasTelephony?: boolean | null;
  history: TVSlotHistory[];
  clientId?: string | null;
  profileLabel?: string | null;
}

export interface CloudAccess {
  id: string;
  clientId: string;
  serviceId: string;
  expiresAt: string;
  isTest: boolean;
  notes?: string | null;
  createdAt?: string;
  updatedAt?: string;
  client?: Client;
  service?: Service;
}

export interface Client {
  id: string;
  name: string;
  email: string;
  phone?: string | null;
  document: string;
  costCenter: "LUXUS" | "NEXUS";
  companyName?: string | null;
  notes?: string | null;
  address?: string | null;
  city?: string | null;
  zipCode?: string | null; // CEP
  state?: string | null;
  openedBy?: string | null; // Vendedor que abriu o cliente
  createdAt: string;
  updatedAt: string;
  services?: Service[];
  tvAssignments?: ClientTVAssignment[];
  cloudAccesses?: CloudAccess[];
}

export interface Line {
  id: string;
  clientId: string;
  nickname?: string | null;
  phoneNumber: string;
  type: "TITULAR" | "DEPENDENTE";
  document?: string | null;
  notes?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ContractTemplate {
  id: string;
  name: string;
  content: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Contract {
  id: string;
  title: string;
  status: "DRAFT" | "SENT" | "SIGNED" | "CANCELLED";
  content: string;
  signUrl?: string | null;
  externalId?: string | null;
  sentAt?: string | null;
  signedAt?: string | null;
  storageLocation?: string | null;
  createdAt: string;
  updatedAt: string;
  clientId: string;
  templateId?: string | null;
  client?: Client;
  template?: ContractTemplate | null;
}

export interface CnpjLookupResult {
  cnpj: string;
  razao_social?: string | null;
  nome_fantasia?: string | null;
  logradouro?: string | null;
  numero?: string | null;
  complemento?: string | null;
  bairro?: string | null;
  municipio?: string | null;
  uf?: string | null;
  cep?: string | null;
  telefone?: string | null;
  ddd_telefone_1?: string | null;
  email?: string | null;
  porte?: string | null;
  abertura?: string | null;
  document?: string;
  name?: string | null;
  companyName?: string | null;
  tradeName?: string | null;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  phone?: string | null;
  postalCode?: string | null;
  openingDate?: string | null;
}

export type TVSlotStatus = "AVAILABLE" | "ASSIGNED" | "INACTIVE" | "SUSPENDED" | "USED";

export interface TVOverviewRecord {
  id: string;
  slotNumber: number;
  username: string;
  email: string;
  accountId?: string | null;
  status: TVSlotStatus;
  password: string;
  soldBy?: string | null;
  soldAt?: string | null;
  startsAt?: string | null;
  expiresAt?: string | null;
  notes?: string | null;
  planType?: TVPlanType | null;
  hasTelephony?: boolean | null;
  clientId?: string | null;
  profileLabel?: string | null;
  document?: string | null;
  client?: {
    id: string;
    name: string;
    email?: string | null;
    phone?: string | null;
    document?: string | null;
  } | null;
}

export interface PaginatedResponse<T> {
  data: T[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

