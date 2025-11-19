import "dotenv/config";
import supabase from "../supabaseClient";

function randomInt(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomFutureDate() {
  const baseDate = new Date();
  const offset = randomInt(-10, 90); // alguns vencidos, outros nos próximos 3 meses
  baseDate.setDate(baseDate.getDate() + offset);
  return baseDate.toISOString().slice(0, 10);
}

async function main() {
  console.log("> Iniciando backfill de acessos Cloud...");

  const { data: services, error: servicesError } = await supabase
    .from("services")
    .select("id, name")
    .ilike("name", "%cloud%");

  if (servicesError) {
    throw servicesError;
  }

  if (!services || services.length === 0) {
    console.log("Nenhum serviço Cloud encontrado. Finalizando.");
    return;
  }

  const serviceIds = services.map((service) => service.id);

  const { data: relations, error: relationsError } = await supabase
    .from("client_services")
    .select("client_id, service_id")
    .in("service_id", serviceIds);

  if (relationsError) {
    throw relationsError;
  }

  if (!relations || relations.length === 0) {
    console.log("Nenhum cliente com serviço Cloud encontrado.");
    return;
  }

  let created = 0;
  for (const relation of relations) {
    const { client_id: clientId, service_id: serviceId } = relation;
    if (!clientId || !serviceId) {
      continue;
    }

    const expiresAt = randomFutureDate();
    const isTest = Math.random() < 0.15;

    const { error: upsertError } = await supabase
      .from("cloud_accesses")
      .upsert(
        {
          client_id: clientId,
          service_id: serviceId,
          expires_at: expiresAt,
          is_test: isTest,
          notes: isTest ? "Acesso de teste criado via backfill." : "Migrado automaticamente.",
        },
        { onConflict: "client_id,service_id" },
      );

    if (upsertError) {
      console.error(`Falha ao criar acesso Cloud para cliente ${clientId}:`, upsertError.message);
      continue;
    }

    created += 1;
  }

  console.log(`Backfill concluído. ${created} acessos Cloud atualizados/criados.`);
}

main()
  .catch((error) => {
    console.error("Erro ao executar backfillCloudAccesses:", error);
    process.exit(1);
  })
  .finally(() => {
    process.exit(0);
  });







