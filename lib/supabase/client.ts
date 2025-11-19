"use client";

import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  const missingVars = [];
  if (!supabaseUrl) missingVars.push("NEXT_PUBLIC_SUPABASE_URL");
  if (!supabaseAnonKey) missingVars.push("NEXT_PUBLIC_SUPABASE_ANON_KEY");
  
  throw new Error(
    `Variáveis de ambiente não configuradas: ${missingVars.join(", ")}\n` +
    `Por favor, crie um arquivo .env.local na raiz do projeto com:\n` +
    `NEXT_PUBLIC_SUPABASE_URL=https://seu-projeto.supabase.co\n` +
    `NEXT_PUBLIC_SUPABASE_ANON_KEY=sua-chave-anon-aqui`
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});

