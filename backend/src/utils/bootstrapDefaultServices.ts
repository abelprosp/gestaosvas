import supabase from "../supabaseClient";

interface DefaultServiceDefinition {
  name: string;
  description?: string;
  price: number;
  allowCustomPrice?: boolean;
}

const DEFAULT_SERVICES: DefaultServiceDefinition[] = [
  {
    name: "TV",
    description: "Serviço de TV com geração automática de e-mail (até 8 acessos).",
    price: 37.99,
    allowCustomPrice: true,
  },
  {
    name: "Telemedicina e Telepet",
    description: "Cobertura de telemedicina humana e pet.",
    price: 8.35,
    allowCustomPrice: false,
  },
  {
    name: "Cloud 150GB",
    description: "Armazenamento em nuvem de 150 GB.",
    price: 4.99,
    allowCustomPrice: false,
  },
  {
    name: "HubPlay Premium",
    description: "Plataforma HubPlay Premium.",
    price: 39.99,
    allowCustomPrice: false,
  },
];

export async function bootstrapDefaultServices() {
  try {
    const { data, error } = await supabase.from("services").select("id, name");

    if (error) {
      console.error("[bootstrapDefaultServices] Falha ao buscar serviços existentes.", error);
      return;
    }

    const existingByName = new Map<string, { id: string; name: string }>();
    (data ?? []).forEach((service) => {
      if (service?.name) {
        existingByName.set(service.name.toLowerCase(), service as { id: string; name: string });
      }
    });

    const baseTv =
      existingByName.get("tv") ?? existingByName.get("tv essencial") ?? existingByName.get("tv premium") ?? null;

    if (!existingByName.get("tv")) {
      if (baseTv && baseTv.name.toLowerCase() !== "tv") {
        const { error: renameError } = await supabase
          .from("services")
          .update({
            name: "TV",
            description: DEFAULT_SERVICES[0].description ?? null,
            price: DEFAULT_SERVICES[0].price,
            allow_custom_price: DEFAULT_SERVICES[0].allowCustomPrice ?? false,
          })
          .eq("id", baseTv.id);

        if (renameError) {
          console.error("[bootstrapDefaultServices] Falha ao renomear serviço de TV existente.", renameError);
        } else {
          existingByName.set("tv", { id: baseTv.id, name: "TV" });
        }
      } else if (!baseTv) {
        const { error: insertTvError, data: insertTvData } = await supabase
          .from("services")
          .insert({
            name: "TV",
            description: DEFAULT_SERVICES[0].description ?? null,
            price: DEFAULT_SERVICES[0].price,
            allow_custom_price: DEFAULT_SERVICES[0].allowCustomPrice ?? false,
          })
          .select("id")
          .maybeSingle();

        if (insertTvError) {
          console.error("[bootstrapDefaultServices] Não foi possível criar o serviço TV.", insertTvError);
        } else if (insertTvData) {
          existingByName.set("tv", { id: insertTvData.id, name: "TV" });
        }
      }
    } else {
      const tvRecord = existingByName.get("tv")!;
      const { error: updateTvError } = await supabase
        .from("services")
        .update({
          description: DEFAULT_SERVICES[0].description ?? null,
          price: DEFAULT_SERVICES[0].price,
          allow_custom_price: DEFAULT_SERVICES[0].allowCustomPrice ?? false,
        })
        .eq("id", tvRecord.id);
      if (updateTvError) {
        console.error("[bootstrapDefaultServices] Falha ao atualizar serviço TV padrão.", updateTvError);
      }
    }

    for (const definition of DEFAULT_SERVICES.slice(1)) {
      const key = definition.name.toLowerCase();
      const record = existingByName.get(key);

      if (record) {
        const { error: updateError } = await supabase
          .from("services")
          .update({
            description: definition.description ?? null,
            price: definition.price,
            allow_custom_price: definition.allowCustomPrice ?? false,
          })
          .eq("id", record.id);

        if (updateError) {
          console.error(`[bootstrapDefaultServices] Não foi possível atualizar o serviço ${definition.name}.`, updateError);
        }
      } else {
        const { error: insertError } = await supabase.from("services").insert({
          name: definition.name,
          description: definition.description ?? null,
          price: definition.price,
          allow_custom_price: definition.allowCustomPrice ?? false,
        });

        if (insertError) {
          console.error(`[bootstrapDefaultServices] Não foi possível criar o serviço ${definition.name}.`, insertError);
        }
      }
    }

    const tvRecord = existingByName.get("tv");

    for (const legacyName of ["tv essencial", "tv premium"]) {
      const legacy = existingByName.get(legacyName);
      if (legacy && tvRecord && legacy.id !== tvRecord.id) {
        const { error: migrateError } = await supabase
          .from("client_services")
          .update({ service_id: tvRecord.id })
          .eq("service_id", legacy.id);

        if (migrateError) {
          console.warn(
            `[bootstrapDefaultServices] Não foi possível migrar clientes do serviço legado ${legacy.name}.`,
            migrateError,
          );
          continue;
        }

        const { error: deleteError } = await supabase.from("services").delete().eq("id", legacy.id);
        if (deleteError) {
          console.warn(
            `[bootstrapDefaultServices] Não foi possível remover o serviço legado ${legacy.name}. Remova manualmente.`,
            deleteError,
          );
        } else {
          console.log(`[bootstrapDefaultServices] Serviço legado ${legacy.name} removido.`);
        }
      }
    }
  } catch (error) {
    console.error("[bootstrapDefaultServices] Erro inesperado ao inicializar serviços padrão.", error);
  }
}


