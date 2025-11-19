import { NextFunction, Request, Response } from "express";
import { HttpError } from "../utils/httpError";

export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction,
) {
  if (err instanceof HttpError) {
    return res.status(err.status).json({
      message: err.message,
      details: err.details,
    });
  }

  console.error("Unhandled error", err);
  return res.status(500).json({ message: "Erro interno do servidor" });
}










