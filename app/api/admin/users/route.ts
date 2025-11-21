import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createApiHandler } from "@/lib/utils/apiHandler";
import { createServerClient } from "@/lib/supabase/server";
import { HttpError } from "@/lib/utils/httpError";

const createUserSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  role: z.string().default("user"),
  name: z.string().min(1).optional(),
});

const updateUserSchema = z
  .object({
    email: z.string().email().optional(),
    password: z.string().min(6).optional(),
    role: z.string().optional(),
    name: z.union([z.string().min(1), z.literal("")]).optional(),
  })
  .superRefine((value, ctx) => {
    if (!value.email && !value.password && !value.role && value.name === undefined) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Nenhuma alteração fornecida" });
    }
  });

export const GET = createApiHandler(
  async (req) => {
    // Verificar se a Service Role Key está configurada ANTES de tentar criar cliente
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!serviceRoleKey) {
      console.error("[GET /admin/users] SUPABASE_SERVICE_ROLE_KEY não está configurada no ambiente");
      throw new HttpError(
        500,
        "Configuração de servidor incompleta. Service Role Key não encontrada. Configure SUPABASE_SERVICE_ROLE_KEY no Vercel (Settings > Environment Variables).",
        { 
          missingEnvVar: "SUPABASE_SERVICE_ROLE_KEY",
          hint: "Esta variável é necessária para operações administrativas do Supabase Auth"
        }
      );
    }

    let supabase;
    try {
      console.log("[GET /admin/users] Criando cliente Supabase com Service Role Key...");
      supabase = createServerClient(true); // Requer Service Role Key
      if (!supabase) {
        throw new Error("Cliente Supabase retornou null/undefined");
      }
    } catch (clientError) {
      console.error("[GET /admin/users] Erro ao criar cliente Supabase:", clientError);
      const errorMsg = clientError instanceof Error ? clientError.message : String(clientError);
      throw new HttpError(
        500,
        `Erro ao inicializar cliente Supabase: ${errorMsg}`,
        { originalError: clientError }
      );
    }
    
    try {
      console.log("[GET /admin/users] Tentando listar usuários do Supabase Auth...");
      const { data, error } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 });
      
      if (error) {
        console.error("[GET /admin/users] Erro do Supabase ao listar usuários:", {
          message: error.message,
          status: (error as any)?.status,
          name: error.name,
          code: (error as any)?.code,
        });
        
        // Se for erro de autenticação/autorização
        if ((error as any)?.status === 401 || (error as any)?.status === 403) {
          throw new HttpError(
            403,
            "Sem permissão para acessar usuários. Verifique se a Service Role Key está correta.",
            { supabaseError: error }
          );
        }
        
        throw new HttpError(
          500,
          `Erro ao listar usuários do Supabase: ${error.message}`,
          { 
            originalError: error,
            supabaseStatus: (error as any)?.status,
            supabaseCode: (error as any)?.code,
          }
        );
      }

      if (!data) {
        console.warn("[GET /admin/users] Resposta do Supabase sem data");
        return NextResponse.json([]);
      }

      if (!data.users) {
        console.warn("[GET /admin/users] Resposta do Supabase sem users array");
        return NextResponse.json([]);
      }

      const users = data.users.map((user) => ({
        id: user.id,
        email: user.email,
        role: (user.user_metadata as { role?: string } | undefined)?.role ?? "user",
        name: (user.user_metadata as { name?: string } | undefined)?.name ?? null,
        createdAt: user.created_at,
        lastSignInAt: user.last_sign_in_at,
      }));

      console.log(`[GET /admin/users] ✅ Listados ${users.length} usuários com sucesso`);
      return NextResponse.json(users);
    } catch (handlerError) {
      console.error("[GET /admin/users] Erro no handler:", handlerError);
      // Se já é HttpError, re-lançar
      if (handlerError instanceof HttpError) {
        throw handlerError;
      }
      // Se for erro do Supabase, tratar
      if (handlerError && typeof handlerError === "object" && "message" in handlerError) {
        throw new HttpError(
          500,
          `Erro do Supabase: ${(handlerError as { message?: string }).message || "Erro desconhecido"}`,
          { originalError: handlerError }
        );
      }
      // Erro genérico
      throw new HttpError(
        500,
        `Erro inesperado: ${handlerError instanceof Error ? handlerError.message : String(handlerError)}`,
        { originalError: handlerError }
      );
    }
  },
  { requireAdmin: true }
);

export const POST = createApiHandler(
  async (req) => {
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
      throw new HttpError(
        500,
        "Configuração de servidor incompleta. Service Role Key não encontrada. Configure SUPABASE_SERVICE_ROLE_KEY no Vercel."
      );
    }

    const supabase = createServerClient(true); // Requer Service Role Key
    const body = await req.json();
    const payload = createUserSchema.parse(body);
    const { data, error } = await supabase.auth.admin.createUser({
      email: payload.email,
      password: payload.password,
      email_confirm: true,
      user_metadata: { role: payload.role, ...(payload.name ? { name: payload.name } : {}) },
    });

    if ((error as any)?.status === 422) {
      throw new HttpError(409, "Usuário já existe");
    }

    if (error) {
      throw error;
    }

    return NextResponse.json(
      {
        id: data.user?.id,
        email: data.user?.email,
        role: (data.user?.user_metadata as { role?: string } | undefined)?.role ?? payload.role,
        name: (data.user?.user_metadata as { name?: string } | undefined)?.name ?? payload.name ?? null,
      },
      { status: 201 }
    );
  },
  { requireAdmin: true }
);





