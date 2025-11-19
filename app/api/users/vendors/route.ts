import { NextRequest, NextResponse } from "next/server";
import { createApiHandler } from "@/lib/utils/apiHandler";
import { createServerClient } from "@/lib/supabase/server";

export const GET = createApiHandler(async (req) => {
  const supabase = createServerClient();
  const { data, error } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 });
  if (error) {
    throw error;
  }

  const vendors = data.users.map((user) => ({
    id: user.id,
    email: user.email,
    name: (user.user_metadata as { name?: string } | undefined)?.name ?? null,
    role: (user.user_metadata as { role?: string } | undefined)?.role ?? "user",
  }));

  return NextResponse.json(vendors);
});





