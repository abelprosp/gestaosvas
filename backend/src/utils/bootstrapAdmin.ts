import supabase from "../supabaseClient";

export async function ensureDefaultAdmin() {
  const email = process.env.DEFAULT_ADMIN_EMAIL;
  const password = process.env.DEFAULT_ADMIN_PASSWORD;

  if (!email || !password) {
    return;
  }

  try {
    const { data, error } = await supabase.auth.admin.listUsers({ page: 1, perPage: 200 });
    if (error) {
      console.error("Erro ao listar usuários do Supabase", error);
      return;
    }

    const exists = data.users.some((user) => user.email === email);
    if (!exists) {
      const { error: createError } = await supabase.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { role: "admin", name: "Admin" },
      });

      if (createError) {
        console.error("Erro ao criar usuário admin padrão", createError);
      } else {
        console.log("Usuário admin padrão criado com sucesso");
      }
    }
  } catch (error) {
    console.error("Falha ao garantir usuário admin", error);
  }
}

