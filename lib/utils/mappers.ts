import {
  Client,
  ClientTVAssignment,
  CloudAccess,
  Contract,
  ContractTemplate,
  Line,
  Service,
  TVAccount,
  TVSlot,
  TVSlotHistory,
} from "@/types";

type ClientRow = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  document: string;
  cost_center: "LUXUS" | "NEXUS";
  company_name: string | null;
  notes: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  created_at: string;
  updated_at: string;
  client_services?:
    | Array<{
        service: ServiceRow | null;
        custom_price: string | number | null;
      } | null>
    | null;
  cloud_accesses?:
    | Array<{
        id: string;
        service_id: string;
        expires_at: string;
        is_test: boolean;
        notes: string | null;
        created_at: string;
        updated_at: string;
        service?: ServiceRow | null;
      }>
    | null;
};

type LineRow = {
  id: string;
  client_id: string;
  nickname: string | null;
  phone_number: string;
  type: "TITULAR" | "DEPENDENTE";
  document: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

type ContractTemplateRow = {
  id: string;
  name: string;
  content: string;
  active: boolean;
  created_at: string;
  updated_at: string;
};

type ContractRow = {
  id: string;
  title: string;
  status: "DRAFT" | "SENT" | "SIGNED" | "CANCELLED";
  content: string;
  sign_url: string | null;
  external_id: string | null;
  sent_at: string | null;
  signed_at: string | null;
  storage_location: string | null;
  client_id: string;
  template_id: string | null;
  created_at: string;
  updated_at: string;
  client?: ClientRow | null;
  template?: ContractTemplateRow | null;
};

type ServiceRow = {
  id: string;
  name: string;
  description: string | null;
  price: string | number | null;
  allow_custom_price: boolean | null;
  created_at: string;
  updated_at: string;
};

type TVAccountRow = {
  id: string;
  email: string;
  created_at: string;
};

type TVSlotRow = {
  id: string;
  tv_account_id: string;
  slot_number: number;
  username: string;
  password: string;
  status: string;
  client_id: string | null;
  sold_by: string | null;
  sold_at: string | null;
  starts_at: string | null;
  expires_at: string | null;
  notes: string | null;
  plan_type: string | null;
  has_telephony: boolean | null;
  created_at: string;
  updated_at: string;
  tv_accounts?: TVAccountRow | null;
};

type TVSlotHistoryRow = {
  id: string;
  tv_slot_id: string;
  action: string;
  metadata: Record<string, unknown> | null;
  created_at: string;
};

type CloudAccessRow = {
  id: string;
  client_id: string;
  service_id: string;
  expires_at: string;
  is_test: boolean;
  notes: string | null;
  created_at: string;
  updated_at: string;
  service?: ServiceRow | null;
};

export function mapClientRow(row: ClientRow): Client {
  const client: Client = {
    id: row.id,
    name: row.name,
    email: row.email,
    phone: row.phone,
    document: row.document,
    costCenter: row.cost_center,
    companyName: row.company_name,
    notes: row.notes,
    address: row.address,
    city: row.city,
    state: row.state,
    openedBy: (row as any).opened_by ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    services: [],
    tvAssignments: [],
    cloudAccesses: [],
  };

  if (Array.isArray(row.client_services)) {
    client.services = row.client_services
      .map((relation) => {
        if (!relation?.service) {
          return null;
        }
        const mapped = mapServiceRow(relation.service);
        if (relation.custom_price !== undefined && relation.custom_price !== null) {
          mapped.customPrice = typeof relation.custom_price === "number" ? relation.custom_price : Number(relation.custom_price);
        } else {
          mapped.customPrice = null;
        }
        return mapped;
      })
      .filter((service): service is Service => Boolean(service));
  } else {
    client.services = [];
  }

  client.tvAssignments = [];
  client.cloudAccesses =
    row.cloud_accesses?.map((access) => mapCloudAccessRow({ ...access, client_id: row.id })) ?? [];

  return client;
}

export function clientInsertPayload(data: Partial<Client>): Record<string, unknown> {
  return {
    name: data.name,
    email: data.email,
    phone: data.phone ?? null,
    document: data.document,
    cost_center: data.costCenter ?? "LUXUS",
    company_name: data.companyName ?? null,
    notes: data.notes ?? null,
    address: data.address ?? null,
    city: data.city ?? null,
    state: data.state ?? null,
    opened_by: data.openedBy ?? null,
  };
}

export function clientUpdatePayload(data: Partial<Client>): Record<string, unknown> {
  return {
    ...(data.name !== undefined ? { name: data.name } : {}),
    ...(data.email !== undefined ? { email: data.email } : {}),
    ...(data.phone !== undefined ? { phone: data.phone } : {}),
    ...(data.document !== undefined ? { document: data.document } : {}),
    ...(data.costCenter !== undefined ? { cost_center: data.costCenter } : {}),
    ...(data.companyName !== undefined ? { company_name: data.companyName } : {}),
    ...(data.notes !== undefined ? { notes: data.notes } : {}),
    ...(data.address !== undefined ? { address: data.address } : {}),
    ...(data.city !== undefined ? { city: data.city } : {}),
    ...(data.state !== undefined ? { state: data.state } : {}),
    ...(data.openedBy !== undefined ? { opened_by: data.openedBy ?? null } : {}),
    updated_at: new Date().toISOString(),
  };
}

export function mapLineRow(row: LineRow): Line {
  return {
    id: row.id,
    clientId: row.client_id,
    nickname: row.nickname,
    phoneNumber: row.phone_number,
    type: row.type,
    document: row.document,
    notes: row.notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function lineInsertPayload(data: Partial<Line>) {
  return {
    client_id: data.clientId,
    nickname: data.nickname ?? null,
    phone_number: data.phoneNumber,
    type: data.type ?? "TITULAR",
    document: data.document ?? null,
    notes: data.notes ?? null,
  };
}

export function lineUpdatePayload(data: Partial<Line>) {
  return {
    ...(data.clientId !== undefined ? { client_id: data.clientId } : {}),
    ...(data.nickname !== undefined ? { nickname: data.nickname } : {}),
    ...(data.phoneNumber !== undefined ? { phone_number: data.phoneNumber } : {}),
    ...(data.type !== undefined ? { type: data.type } : {}),
    ...(data.document !== undefined ? { document: data.document } : {}),
    ...(data.notes !== undefined ? { notes: data.notes } : {}),
    updated_at: new Date().toISOString(),
  };
}

export function mapTemplateRow(row: ContractTemplateRow): ContractTemplate {
  return {
    id: row.id,
    name: row.name,
    content: row.content,
    active: row.active,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function templateInsertPayload(data: Partial<ContractTemplate>) {
  return {
    name: data.name,
    content: data.content,
    active: data.active ?? true,
  };
}

export function templateUpdatePayload(data: Partial<ContractTemplate>) {
  return {
    ...(data.name !== undefined ? { name: data.name } : {}),
    ...(data.content !== undefined ? { content: data.content } : {}),
    ...(data.active !== undefined ? { active: data.active } : {}),
    updated_at: new Date().toISOString(),
  };
}

export function mapContractRow(row: ContractRow): Contract {
  return {
    id: row.id,
    title: row.title,
    status: row.status,
    content: row.content,
    signUrl: row.sign_url,
    externalId: row.external_id,
    sentAt: row.sent_at,
    signedAt: row.signed_at,
    storageLocation: row.storage_location,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    clientId: row.client_id,
    templateId: row.template_id,
    client: row.client ? mapClientRow(row.client) : undefined,
    template: row.template ? mapTemplateRow(row.template) : undefined,
  };
}

export function contractInsertPayload(data: {
  title: string;
  status?: Contract["status"];
  content: string;
  clientId: string;
  templateId?: string | null;
  signUrl?: string | null;
  externalId?: string | null;
  sentAt?: string | null;
  signedAt?: string | null;
  storageLocation?: string | null;
}) {
  return {
    title: data.title,
    status: data.status ?? "DRAFT",
    content: data.content,
    client_id: data.clientId,
    template_id: data.templateId ?? null,
    sign_url: data.signUrl ?? null,
    external_id: data.externalId ?? null,
    sent_at: data.sentAt ?? null,
    signed_at: data.signedAt ?? null,
    storage_location: data.storageLocation ?? null,
  };
}

export function contractUpdatePayload(data: Partial<Contract>) {
  return {
    ...(data.title !== undefined ? { title: data.title } : {}),
    ...(data.status !== undefined ? { status: data.status } : {}),
    ...(data.content !== undefined ? { content: data.content } : {}),
    ...(data.clientId !== undefined ? { client_id: data.clientId } : {}),
    ...(data.templateId !== undefined ? { template_id: data.templateId } : {}),
    ...(data.signUrl !== undefined ? { sign_url: data.signUrl } : {}),
    ...(data.externalId !== undefined ? { external_id: data.externalId } : {}),
    ...(data.sentAt !== undefined ? { sent_at: data.sentAt } : {}),
    ...(data.signedAt !== undefined ? { signed_at: data.signedAt } : {}),
    ...(data.storageLocation !== undefined ? { storage_location: data.storageLocation } : {}),
    updated_at: new Date().toISOString(),
  };
}

export function mapServiceRow(row: ServiceRow): Service {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    price: typeof row.price === "number" ? row.price : Number(row.price ?? 0),
    allowCustomPrice: Boolean(row.allow_custom_price),
    customPrice: null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function serviceInsertPayload(data: Partial<Service>) {
  return {
    name: data.name,
    description: data.description ?? null,
    price: data.price ?? 0,
    allow_custom_price: data.allowCustomPrice ?? false,
  };
}

export function serviceUpdatePayload(data: Partial<Service>) {
  return {
    ...(data.name !== undefined ? { name: data.name } : {}),
    ...(data.description !== undefined ? { description: data.description } : {}),
    ...(data.price !== undefined ? { price: data.price } : {}),
    ...(data.allowCustomPrice !== undefined ? { allow_custom_price: data.allowCustomPrice } : {}),
    updated_at: new Date().toISOString(),
  };
}

export function mapTVAccountRow(row: TVAccountRow): TVAccount {
  return {
    id: row.id,
    email: row.email,
    createdAt: row.created_at,
  };
}

export function mapTVSlotHistoryRow(row: TVSlotHistoryRow): TVSlotHistory {
  return {
    id: row.id,
    action: row.action,
    metadata: row.metadata,
    createdAt: row.created_at,
  };
}

export function mapTVSlotRow(row: TVSlotRow, history: TVSlotHistoryRow[] = []): TVSlot {
  return {
    id: row.id,
    tvAccountId: row.tv_account_id,
    slotNumber: row.slot_number,
    username: row.username,
    password: row.password,
    status: row.status as TVSlot["status"],
    clientId: row.client_id,
    soldBy: row.sold_by,
    soldAt: row.sold_at,
    startsAt: row.status === "ASSIGNED" ? row.starts_at : null,
    expiresAt: row.expires_at,
    notes: row.notes,
    planType: row.status === "ASSIGNED" ? (row.plan_type as TVSlot["planType"]) ?? null : null,
    hasTelephony: row.has_telephony ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    account: row.tv_accounts ? mapTVAccountRow(row.tv_accounts) : undefined,
  };
}

export function mapCloudAccessRow(row: CloudAccessRow): CloudAccess {
  return {
    id: row.id,
    clientId: row.client_id,
    serviceId: row.service_id,
    expiresAt: row.expires_at,
    isTest: row.is_test,
    notes: row.notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    service: row.service ? mapServiceRow(row.service) : undefined,
  };
}

export function mapClientTVAssignment(
  slotRow: TVSlotRow,
  historyRows: TVSlotHistoryRow[],
  profileLabel?: string | null,
): ClientTVAssignment {
  const mappedSlot = mapTVSlotRow(slotRow);
  return {
    slotId: mappedSlot.id,
    slotNumber: mappedSlot.slotNumber,
    username: mappedSlot.username,
    email: mappedSlot.account?.email ?? "",
    password: mappedSlot.password,
    status: mappedSlot.status,
    soldBy: mappedSlot.soldBy,
    soldAt: mappedSlot.soldAt,
    startsAt: mappedSlot.startsAt,
    expiresAt: mappedSlot.expiresAt,
    notes: mappedSlot.notes,
    planType: mappedSlot.planType,
    hasTelephony: mappedSlot.hasTelephony ?? null,
    history: historyRows.map(mapTVSlotHistoryRow),
    clientId: mappedSlot.clientId ?? null,
    profileLabel: profileLabel ?? null,
  };
}





