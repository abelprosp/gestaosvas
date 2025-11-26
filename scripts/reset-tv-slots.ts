/**
 * Script para resetar todos os slots TV e começar do 1a8
 * Execute: npx tsx scripts/reset-tv-slots.ts
 * 
 * Requer variáveis de ambiente:
 * - NEXT_PUBLIC_SUPABASE_URL
 * - SUPABASE_SERVICE_ROLE_KEY
 */

// Carregar variáveis de ambiente PRIMEIRO
import dotenv from "dotenv";
import { resolve } from "path";

const envPath = resolve(process.cwd(), ".env.local");
const result = dotenv.config({ path: envPath });

if (result.error) {
  console.warn(`⚠️  Aviso: Não foi possível carregar .env.local: ${result.error.message}`);
}

// Verificar se as variáveis foram carregadas
if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
  console.error("❌ Erro: NEXT_PUBLIC_SUPABASE_URL não encontrado");
  console.error(`   Verifique se o arquivo .env.local existe em: ${envPath}`);
  console.error("   Ou defina a variável: export NEXT_PUBLIC_SUPABASE_URL=...");
  process.exit(1);
}

if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
  console.error("❌ Erro: SUPABASE_SERVICE_ROLE_KEY não encontrado");
  console.error("   Defina a variável: export SUPABASE_SERVICE_ROLE_KEY=...");
  process.exit(1);
}

console.log("✅ Variáveis de ambiente carregadas");

// Importar DEPOIS de carregar as variáveis
async function runReset() {
  const { resetTvSlotsToStart } = await import("../lib/services/tvAssignments");
  
  try {
    console.log("🔄 Iniciando limpeza de slots TV...");
    const result = await resetTvSlotsToStart();
    console.log("✅ Limpeza concluída com sucesso!");
    console.log(`   Slots resetados: ${result.slotsReset}`);
    console.log("   Sistema pronto para começar do 1a8");
    process.exit(0);
  } catch (error) {
    console.error("❌ Erro ao executar limpeza:", error);
    process.exit(1);
  }
}

runReset();
