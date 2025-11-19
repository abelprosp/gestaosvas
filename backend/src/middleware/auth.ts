import { NextFunction, Request, Response } from "express";
import supabase from "../supabaseClient";
import { HttpError } from "../utils/httpError";

declare module "express-serve-static-core" {
  interface Request {
    user?: {
      id: string;
      email?: string;
      role?: string;
    };
  }
}

export async function requireAuth(req: Request, _res: Response, next: NextFunction) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      throw new HttpError(401, "Token de acesso ausente");
    }

    const token = authHeader.replace(/^Bearer\s+/i, "").trim();
    if (!token) {
      throw new HttpError(401, "Token de acesso inválido");
    }

    const { data, error } = await supabase.auth.getUser(token);

    if (error || !data.user) {
      throw new HttpError(401, "Sessão inválida");
    }

    req.user = {
      id: data.user.id,
      email: data.user.email ?? undefined,
      role: (data.user.user_metadata as { role?: string } | undefined)?.role ?? "user",
    };

    next();
  } catch (error) {
    next(error);
  }
}

export function requireAdmin(req: Request, _res: Response, next: NextFunction) {
  if (!req.user || req.user.role !== "admin") {
    return next(new HttpError(403, "Permissão negada"));
  }
  return next();
}










