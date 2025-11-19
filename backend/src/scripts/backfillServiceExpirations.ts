import "dotenv/config";
import supabase from "../supabaseClient";

const TARGET_SERVICES = [
  { name: "HubPlay Premium", key: "hubplay premium" },
  { name: "Telemedicina e Telepet", key: "telemedicina e telepet" },
];

function randomExpiration() {
  const base = new Date();
  const diff = Math.floor(Math.random() * 120) - 10;
  base.setDate(base.getDate() + diff);
  return base.toISOString().slice(0, 10);
}

async function main() {
  console.log("> Preenchendo vencimentos fictícios para serviços especiais...");

  const { data: services, error: servicesError } = await supabase.from("services").select("id, name");
  if (servicesError) {
    throw servicesError;
  }

  const servicesByKey = new Map<string, string>();
  services?.forEach((service) => {
    if (!service?.name) return;
    const lower = service.name.toLowerCase();
    TARGET_SERVICES.forEach((target) => {
      if (lower.includes(target.key)) {
        servicesByKey.set(target.key, service.id);
      }
    });
  });

  const { data: clients, error: clientsError } = await supabase.from("clients").select("id, name");
  if (clientsError) {
    throw clientsError;
  }

  let created = 0;
  for (const client of clients ?? []) {
    if (!client?.id) continue;

    for (const target of TARGET_SERVICES) {
      const serviceId = servicesByKey.get(target.key);
      if (!serviceId) continue;

      const shouldAssign = Math.random() < 0.35;
      if (!shouldAssign) continue;

      const expiresAt = randomExpiration();
      const isTest = Math.random() < 0.2;

      const { error } = await supabase
        .from("cloud_accesses")
        .upsert(
          {
            client_id: client.id,
            service_id: serviceId,
            expires_at: expiresAt,
            is_test: isTest,
            notes: `${target.name} migrado automaticamente`,
          },
          { onConflict: "client_id,service_id" },
        );

      if (error) {
        console.error(`[backfillServiceExpirations] Falha ao registrar ${target.name} para ${client.name}`, error);
        continue;
      }

      created += 1;
    }
  }

  console.log(`Backfill concluído. ${created} acessos registrados para serviços especiais.`);
}

main()
  .catch((error) => {
    console.error("Erro ao executar backfillServiceExpirations:", error);
    process.exit(1);
  })
  .finally(() => {
    process.exit(0);
  });


