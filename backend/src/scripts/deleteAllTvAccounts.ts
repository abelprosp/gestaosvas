import "dotenv/config";
import supabase from "../supabaseClient";

async function deleteAllTvAccounts() {
  console.log("🚀 Iniciando remoção de todas as contas e slots de TV...\n");

  try {
    // Primeiro, verifica quantas contas existem
    const { data: accounts, error: countError } = await supabase
      .from("tv_accounts")
      .select("id, email", { count: "exact" });

    if (countError) {
      throw countError;
    }

    const accountCount = accounts?.length ?? 0;
    console.log(`📊 Total de contas de TV encontradas: ${accountCount}`);

    if (accountCount === 0) {
      console.log("✅ Nenhuma conta encontrada. Já está zerado!");
      return;
    }

    // Lista as contas que serão removidas
    console.log("\n📋 Contas que serão removidas:");
    accounts?.forEach((account, index) => {
      console.log(`  ${index + 1}. ${account.email}`);
    });

    // Verifica quantos slots existem antes de deletar
    const { data: slots, error: slotsError } = await supabase
      .from("tv_slots")
      .select("id", { count: "exact" });

    if (slotsError) {
      console.warn("⚠️  Aviso ao contar slots:", slotsError.message);
    } else {
      const slotCount = slots?.length ?? 0;
      console.log(`\n📊 Total de slots de TV encontrados: ${slotCount}`);
    }

    // Deleta todas as contas de TV
    // Como tv_slots tem on delete cascade, todos os slots serão deletados automaticamente
    // E como tv_slot_history tem on delete cascade de tv_slots, todo o histórico também será deletado
    console.log("\n🗑️  Removendo todas as contas de TV e dados relacionados...");
    const { error: deleteError } = await supabase.from("tv_accounts").delete().neq("id", "00000000-0000-0000-0000-000000000000"); // Deleta todas

    if (deleteError) {
      throw deleteError;
    }

    console.log(`\n✅ Sucesso! ${accountCount} conta(s) removida(s).`);
    console.log("\n📝 Dados removidos automaticamente (cascade):");
    console.log("   - Todas as contas de email de TV");
    console.log("   - Todos os slots de TV");
    console.log("   - Todo o histórico de slots");
    console.log("\n✨ Agora você pode começar do zero! Os emails serão criados conforme a necessidade.");
  } catch (error) {
    console.error("\n❌ Erro ao remover contas de TV:", error);
    process.exit(1);
  }
}

deleteAllTvAccounts()
  .then(() => {
    console.log("\n✨ Processo concluído!");
    process.exit(0);
  })
  .catch((error) => {
    console.error("\n💥 Erro fatal:", error);
    process.exit(1);
  });

