import { redirect } from "next/navigation";

// Forçar renderização dinâmica (não pré-renderizar)
export const dynamic = "force-dynamic";
export const revalidate = 0;

// Redirecionar para /login - o ProtectedRoute vai gerenciar o redirecionamento de volta
// Isso evita problemas de SSR e garante que a página sempre funcione
export default function HomePage() {
  redirect("/login");
}


