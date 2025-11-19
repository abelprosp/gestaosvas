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
  status: "AVAILABLE" | "ASSIGNED" | "INACTIVE" | "SUSPENDED";
  clientId?: string | null;
  soldBy?: string | null;
  soldAt?: string | null;
  startsAt?: string | null;
  expiresAt?: string | null;
  notes?: string | null;
  planType?: TVPlanType | null;
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
  state?: string | null;
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

