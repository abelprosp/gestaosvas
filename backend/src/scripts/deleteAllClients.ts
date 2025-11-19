import "dotenv/config";
import supabase from "../supabaseClient";

async function deleteAllClients() {
  console.log("🚀 Iniciando remoção de todos os clientes...\n");

  try {
    // Primeiro, vamos verificar quantos clientes existem
    const { data: clients, error: countError } = await supabase
      .from("clients")
      .select("id, name, document", { count: "exact" });

    if (countError) {
      throw countError;
    }

    const clientCount = clients?.length ?? 0;
    console.log(`📊 Total de clientes encontrados: ${clientCount}`);

    if (clientCount === 0) {
      console.log("✅ Nenhum cliente encontrado. Nada a fazer.");
      return;
    }

    // Lista os clientes que serão removidos
    console.log("\n📋 Clientes que serão removidos:");
    clients?.forEach((client, index) => {
      console.log(`  ${index + 1}. ${client.name} (${client.document})`);
    });

    // Libera os slots de TV associados (seta client_id para null)
    console.log("\n🔄 Liberando slots de TV associados...");
    const { error: slotsError } = await supabase
      .from("tv_slots")
      .update({ client_id: null })
      .not("client_id", "is", null);

    if (slotsError) {
      console.warn("⚠️  Aviso ao liberar slots:", slotsError.message);
    } else {
      console.log("✅ Slots de TV liberados com sucesso.");
    }

    // Deleta todos os clientes
    // Isso automaticamente deleta em cascade:
    // - contracts (on delete cascade)
    // - lines (on delete cascade)
    // - client_services (on delete cascade)
    // - cloud_accesses (on delete cascade)
    console.log("\n🗑️  Removendo clientes e dados relacionados...");
    const { error: deleteError } = await supabase.from("clients").delete().neq("id", "00000000-0000-0000-0000-000000000000"); // Deleta todos

    if (deleteError) {
      throw deleteError;
    }

    console.log(`\n✅ Sucesso! ${clientCount} cliente(s) removido(s) com todos os dados relacionados.`);
    console.log("\n📝 Dados removidos automaticamente:");
    console.log("   - Contratos associados");
    console.log("   - Linhas telefônicas");
    console.log("   - Relações clientes-serviços");
    console.log("   - Acessos Cloud");
    console.log("\n⚠️  Nota: Slots de TV foram liberados (client_id = null), mas não foram removidos.");
  } catch (error) {
    console.error("\n❌ Erro ao remover clientes:", error);
    process.exit(1);
  }
}

deleteAllClients()
  .then(() => {
    console.log("\n✨ Processo concluído!");
    process.exit(0);
  })
  .catch((error) => {
    console.error("\n💥 Erro fatal:", error);
    process.exit(1);
  });

