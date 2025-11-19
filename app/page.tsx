import { redirect } from "next/navigation";

// Forçar renderização dinâmica (não pré-renderizar)
export const dynamic = "force-dynamic";
export const revalidate = 0;

// Redirecionar para /clientes - o ProtectedRoute vai gerenciar a autenticação
// Se não autenticado, será redirecionado para /login
// Isso evita loops de redirecionamento entre / e /login
export default function HomePage() {
  redirect("/clientes");
}


