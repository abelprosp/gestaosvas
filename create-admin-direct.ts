import { createClient } from "@supabase/supabase-js";

// Use este script passando os valores diretamente
// Exemplo: 
// SUPABASE_URL=https://xxx.supabase.co SUPABASE_SERVICE_KEY=xxx npx tsx create-admin-direct.ts

const supabaseUrl = process.env.SUPABASE_URL || process.argv[2];
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_KEY || process.argv[3];

if (!supabaseUrl || !supabaseServiceRoleKey) {
  console.error("❌ Erro: Preciso dos valores do Supabase!");
  console.error("");
  console.error("USO:");
  console.error("  SUPABASE_URL=https://xxx.supabase.co SUPABASE_SERVICE_KEY=xxx npx tsx create-admin-direct.ts");
  console.error("");
  console.error("OU:");
  console.error("  npx tsx create-admin-direct.ts <SUPABASE_URL> <SERVICE_ROLE_KEY>");
  console.error("");
  console.error("Para obter os valores:");
  console.error("1. Acesse: https://app.supabase.com");
  console.error("2. Selecione seu projeto");
  console.error("3. Vá em Settings → API");
  console.error("4. Copie Project URL e service_role key");
  console.error("");
  process.exit(1);
}

// ⚠️ IMPORTANTE: Use variáveis de ambiente para credenciais
// Configure no .env.local ou passe como variáveis de ambiente:
// DEFAULT_ADMIN_EMAIL=seu-email@exemplo.com
// DEFAULT_ADMIN_PASSWORD=sua-senha-segura
const email = process.env.DEFAULT_ADMIN_EMAIL || process.argv[4];
const password = process.env.DEFAULT_ADMIN_PASSWORD || process.argv[5];

if (!email || !password) {
  console.error("❌ Erro: Credenciais não configuradas!");
  console.error("");
  console.error("USO:");
  console.error("  SUPABASE_URL=xxx SUPABASE_SERVICE_KEY=xxx DEFAULT_ADMIN_EMAIL=email DEFAULT_ADMIN_PASSWORD=senha npx tsx create-admin-direct.ts");
  console.error("");
  console.error("OU:");
  console.error("  npx tsx create-admin-direct.ts <SUPABASE_URL> <SERVICE_KEY> <EMAIL> <PASSWORD>");
  console.error("");
  console.error("Configure no .env.local:");
  console.error("  DEFAULT_ADMIN_EMAIL=seu-email@exemplo.com");
  console.error("  DEFAULT_ADMIN_PASSWORD=sua-senha-segura");
  console.error("");
  process.exit(1);
}

async function createAdmin() {
  try {
    console.log("🔄 Conectando ao Supabase...");
    
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
      console.error("");
      console.error("Verifique se a SERVICE_ROLE_KEY está correta!");
      return;
    }

    const existingUser = existingUsers.users.find((user) => user.email === email);

    if (existingUser) {
      console.log("⚠️  Usuário já existe!");
      console.log("   ID:", existingUser.id);
      console.log("   Email:", existingUser.email);
      
      const currentRole = (existingUser.user_metadata as { role?: string })?.role ?? "user";
      console.log("   Role atual:", currentRole);
      
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

        console.log("✅ Usuário atualizado para admin!");
      } else {
        console.log("✅ Usuário já é admin!");
      }

      // Atualiza a senha
      console.log("🔄 Atualizando senha...");
      const { error: passwordError } = await supabase.auth.admin.updateUserById(existingUser.id, {
        password: password,
      });

      if (passwordError) {
        console.error("⚠️  Aviso ao atualizar senha:", passwordError.message);
      } else {
        console.log("✅ Senha atualizada!");
      }

      console.log("");
      console.log("📧 Credenciais:");
      console.log("   Email:", email);
      console.log("   Senha: [CONFIGURADA]");
      console.log("   Role: admin");
      
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
        console.error("");
        console.error("   O usuário já existe. Execute o script novamente para atualizar.");
      }
      return;
    }

    console.log("");
    console.log("✅ Usuário admin criado com sucesso!");
    console.log("");
    console.log("📧 Email:", email);
    console.log("🔑 Senha: [CONFIGURADA - Verifique as variáveis de ambiente]");
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





