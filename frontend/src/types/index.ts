export type ContractStatus = "DRAFT" | "SENT" | "SIGNED" | "CANCELLED";

export interface Service {
  id: string;
  name: string;
  description?: string | null;
  price: number;
  allowCustomPrice: boolean;
  customPrice?: number | null;
  createdAt: string;
  updatedAt: string;
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
  state?: string | null;
  createdAt: string;
  updatedAt: string;
  services?: Service[];
  tvAssignments?: ClientTVAssignment[];
  cloudAccesses?: CloudAccess[];
}

export interface CnpjLookupResult {
  document: string;
  name?: string | null;
  companyName?: string | null;
  tradeName?: string | null;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  phone?: string | null;
  postalCode?: string | null;
  email?: string | null;
  openingDate?: string | null;
}

export type TVSlotStatus = "AVAILABLE" | "ASSIGNED" | "INACTIVE" | "SUSPENDED";

export interface TVSlotHistory {
  id: string;
  action: string;
  metadata?: Record<string, unknown> | null;
  createdAt: string;
}

export type TVPlanType = "ESSENCIAL" | "PREMIUM";

export interface ClientTVAssignment {
  slotId: string;
  slotNumber: number;
  username: string;
  email: string;
  password: string;
  status: TVSlotStatus;
  soldBy?: string | null;
  soldAt?: string | null;
  startsAt?: string | null;
  expiresAt?: string | null;
  notes?: string | null;
  planType?: TVPlanType | null;
  history: TVSlotHistory[];
  clientId?: string | null;
  profileLabel?: string | null;
}

export interface CloudAccess {
  id: string;
  clientId?: string;
  serviceId: string;
  expiresAt: string;
  isTest: boolean;
  notes?: string | null;
  client?: {
    id: string;
    name: string;
    email?: string | null;
    document?: string | null;
  } | null;
  service?: Service | null;
}

export interface ServiceReportRow {
  id: string;
  category: "TV" | "CLOUD" | "HUB" | "TELE" | "SERVICE";
  clientId: string;
  clientName: string;
  clientDocument: string;
  clientEmail?: string | null;
  serviceId?: string | null;
  serviceName: string;
  identifier: string;
  planType?: string | null;
  responsible?: string | null;
  status?: string | null;
  startsAt?: string | null;
  expiresAt?: string | null;
  notes?: string | null;
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
  status: ContractStatus;
  content: string;
  signUrl?: string | null;
  externalId?: string | null;
  sentAt?: string | null;
  signedAt?: string | null;
  storageLocation?: string | null;
  createdAt: string;
  updatedAt: string;
  client: Client;
  template?: ContractTemplate | null;
}

export interface SummaryMetrics {
  cpf: number;
  cnpj: number;
  total: number;
  lastMonth: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  summary?: Record<string, unknown>;
}

export interface PlanSummaryItem {
  plan: "ESSENCIAL" | "PREMIUM";
  clients: number;
  slots: number;
}

export interface TVUsageSummary {
  goal: number;
  used: number;
  available: number;
  percentage: number;
}

export interface StatsOverview {
  metrics: {
    all: SummaryMetrics;
    essencial: SummaryMetrics;
    premium: SummaryMetrics;
  };
  planSummary: PlanSummaryItem[];
  tvUsage: TVUsageSummary;
  recentContracts: Array<Contract>;
  segments: Array<{
    key: string;
    label: string;
    metrics: SummaryMetrics;
  }>;
}

export interface SalesTimeseriesService {
  key: string;
  name: string;
  group: "TV" | "SERVICO";
}

export interface SalesTimeseriesPoint {
  month: string;
  label: string;
  totals: Record<string, number>;
  total: number;
}

export interface SalesTimeseries {
  range: {
    start: string;
    end: string;
  };
  services: SalesTimeseriesService[];
  selectedServices: string[];
  points: SalesTimeseriesPoint[];
  totalSales: number;
}

export interface TVOverviewRecord {
  id: string;
  slotNumber: number;
  username: string;
  email: string;
  status: TVSlotStatus;
  password: string;
  soldBy?: string | null;
  soldAt?: string | null;
  startsAt?: string | null;
  expiresAt?: string | null;
  notes?: string | null;
  planType?: TVPlanType | null;
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

