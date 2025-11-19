import { config } from "dotenv";
import { resolve } from "path";
import { createClient } from "@supabase/supabase-js";

// Carrega .env.local explicitamente
config({ path: resolve(process.cwd(), ".env.local") });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceRoleKey || supabaseUrl.includes("seu-projeto") || supabaseServiceRoleKey.includes("sua-")) {
  console.error("❌ Erro: Variáveis de ambiente não configuradas corretamente!");
  console.error("");
  console.error("O arquivo .env.local ainda contém valores de exemplo.");
  console.error("");
  console.error("Para obter os valores reais do Supabase:");
  console.error("1. Acesse: https://app.supabase.com");
  console.error("2. Selecione seu projeto");
  console.error("3. Vá em Settings → API");
  console.error("4. Copie:");
  console.error("   - Project URL → NEXT_PUBLIC_SUPABASE_URL");
  console.error("   - service_role (secret) → SUPABASE_SERVICE_ROLE_KEY");
  console.error("");
  console.error("Valores atuais encontrados:");
  console.error(`  NEXT_PUBLIC_SUPABASE_URL=${supabaseUrl ? "***" : "NÃO CONFIGURADO"}`);
  console.error(`  SUPABASE_SERVICE_ROLE_KEY=${supabaseServiceRoleKey ? "***" : "NÃO CONFIGURADO"}`);
  console.error("");
  process.exit(1);
}

// ⚠️ IMPORTANTE: Use variáveis de ambiente para credenciais
// Configure no .env.local ou passe como variáveis de ambiente:
// DEFAULT_ADMIN_EMAIL=seu-email@exemplo.com
// DEFAULT_ADMIN_PASSWORD=sua-senha-segura
const email = process.env.DEFAULT_ADMIN_EMAIL;
const password = process.env.DEFAULT_ADMIN_PASSWORD;

if (!email || !password) {
  console.error("❌ Erro: Credenciais não configuradas!");
  console.error("");
  console.error("Configure no .env.local ou como variáveis de ambiente:");
  console.error("  DEFAULT_ADMIN_EMAIL=seu-email@exemplo.com");
  console.error("  DEFAULT_ADMIN_PASSWORD=sua-senha-segura");
  console.error("");
  console.error("OU passe diretamente:");
  console.error("  DEFAULT_ADMIN_EMAIL=email DEFAULT_ADMIN_PASSWORD=senha npx tsx create-admin.ts");
  console.error("");
  process.exit(1);
}

async function createAdmin() {
  try {
    // Usa Service Role Key para ter acesso admin
    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    console.log("🔄 Verificando se o usuário já existe...");

    // Verifica se o usuário já existe
    const { data: existingUsers, error: listError } = await supabase.auth.admin.listUsers({
      page: 1,
      perPage: 1000,
    });

    if (listError) {
      console.error("❌ Erro ao listar usuários:", listError.message);
      return;
    }

    const existingUser = existingUsers.users.find((user) => user.email === email);

    if (existingUser) {
      console.log("⚠️  Usuário já existe!");
      console.log("   ID:", existingUser.id);
      console.log("   Email:", existingUser.email);
      console.log("   Role atual:", (existingUser.user_metadata as { role?: string })?.role ?? "user");
      
      // Atualiza para admin se não for
      const currentRole = (existingUser.user_metadata as { role?: string })?.role ?? "user";
      if (currentRole !== "admin") {
        console.log("🔄 Atualizando role para admin...");
        const { error: updateError } = await supabase.auth.admin.updateUserById(existingUser.id, {
          user_metadata: {
            ...existingUser.user_metadata,
            role: "admin",
            name: "Thomas Bugs",
          },
        });

        if (updateError) {
          console.error("❌ Erro ao atualizar usuário:", updateError.message);
          return;
        }

        console.log("✅ Usuário atualizado para admin com sucesso!");
        console.log("   Email:", email);
        console.log("   Senha: [CONFIGURADA]");
      } else {
        console.log("✅ Usuário já é admin!");
        console.log("   Email:", email);
        console.log("   Senha: [CONFIGURADA]");
      }

      // Atualiza a senha também
      console.log("🔄 Atualizando senha...");
      const { error: passwordError } = await supabase.auth.admin.updateUserById(existingUser.id, {
        password: password,
      });

      if (passwordError) {
        console.error("⚠️  Aviso ao atualizar senha:", passwordError.message);
      } else {
        console.log("✅ Senha atualizada com sucesso!");
      }

      return;
    }

    console.log("🔄 Criando novo usuário admin...");

    // Cria o usuário admin
    const { data, error } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        role: "admin",
        name: "Thomas Bugs",
      },
    });

    if (error) {
      console.error("❌ Erro ao criar usuário:", error.message);
      if (error.message.includes("already registered") || error.message.includes("already exists")) {
        console.error("   O usuário já existe. Tente atualizar ao invés de criar.");
      }
      return;
    }

    console.log("✅ Usuário admin criado com sucesso!");
    console.log("");
    console.log("📧 Email:", email);
    console.log("🔑 Senha: [CONFIGURADA - Verifique o .env.local]");
    console.log("👤 Role: admin");
    console.log("🆔 ID:", data.user?.id);
    console.log("");
    console.log("🚀 Agora você pode fazer login no sistema!");
  } catch (error: any) {
    console.error("❌ Erro inesperado:", error.message);
    console.error(error);
  }

  process.exit(0);
}

createAdmin();

