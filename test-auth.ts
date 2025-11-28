/**
 * Script de teste para diagnosticar problemas de autenticação
 * Execute: npx tsx test-auth.ts
 */

import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error("❌ Variáveis de ambiente não configuradas:");
  console.error("   NEXT_PUBLIC_SUPABASE_URL:", supabaseUrl ? "✅" : "❌");
  console.error("   NEXT_PUBLIC_SUPABASE_ANON_KEY:", supabaseAnonKey ? "✅" : "❌");
  process.exit(1);
}

console.log("🔍 Testando autenticação Supabase...\n");

// Criar cliente
const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: false,
  },
});

// Teste 1: Verificar se o cliente foi criado
console.log("✅ Cliente Supabase criado");

// Teste 2: Tentar validar um token (precisa de um token real)
// Para testar, você precisa passar um token como argumento
const testToken = process.argv[2];

if (testToken) {
  console.log(`\n🔐 Testando validação de token...`);
  console.log(`   Token (primeiros 20 chars): ${testToken.substring(0, 20)}...`);
  
  supabase.auth.getUser(testToken)
    .then(({ data, error }) => {
      if (error) {
        console.error("❌ Erro ao validar token:");
        console.error("   Mensagem:", error.message);
        console.error("   Status:", (error as any)?.status);
        console.error("   Code:", (error as any)?.code);
        console.error("   Name:", error.name);
        console.error("   Error completo:", JSON.stringify(error, null, 2));
      } else if (data?.user) {
        console.log("✅ Token válido!");
        console.log("   User ID:", data.user.id);
        console.log("   Email:", data.user.email);
        console.log("   Role:", (data.user.user_metadata as any)?.role || "não definido");
        console.log("   Metadata:", JSON.stringify(data.user.user_metadata, null, 2));
      } else {
        console.error("❌ Token válido mas sem dados de usuário");
      }
    })
    .catch((err) => {
      console.error("❌ Erro inesperado:", err);
    });
} else {
  console.log("\n💡 Para testar um token, execute:");
  console.log("   npx tsx test-auth.ts SEU_TOKEN_AQUI");
  console.log("\n💡 Para obter um token, faça login no site e execute no console do navegador:");
  console.log("   const { data } = await supabase.auth.getSession();");
  console.log("   console.log(data.session?.access_token);");
}

