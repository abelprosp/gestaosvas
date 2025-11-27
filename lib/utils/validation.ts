import { z } from "zod";
import { HttpError } from "./httpError";

/**
 * Schema para validar UUIDs
 */
export const uuidSchema = z.string().uuid("ID inválido. Esperado formato UUID.");

/**
 * Valida se uma string é um UUID válido
 */
export function validateUUID(id: string): string {
  try {
    return uuidSchema.parse(id);
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new HttpError(400, "ID inválido. Formato esperado: UUID.");
    }
    throw error;
  }
}

/**
 * Valida e retorna o UUID de um parâmetro de rota
 */
export function validateRouteParamUUID(param: string | undefined, paramName: string = "id"): string {
  if (!param) {
    throw new HttpError(400, `${paramName} é obrigatório.`);
  }
  return validateUUID(param);
}

/**
 * Valida um array de UUIDs
 */
export function validateUUIDs(ids: string[]): string[] {
  if (!Array.isArray(ids)) {
    throw new HttpError(400, "IDs devem ser um array.");
  }
  
  const validIds: string[] = [];
  const invalidIds: string[] = [];
  
  ids.forEach((id, index) => {
    try {
      validIds.push(validateUUID(id));
    } catch {
      invalidIds.push(`Índice ${index}: ${id}`);
    }
  });
  
  if (invalidIds.length > 0) {
    throw new HttpError(400, `IDs inválidos encontrados: ${invalidIds.join(", ")}`);
  }
  
  return validIds;
}

/**
 * Valida dígitos verificadores de CNPJ
 * Retorna true se o CNPJ é válido (incluindo dígitos verificadores)
 */
export function validateCnpjChecksum(cnpj: string): boolean {
  // Remove caracteres não numéricos
  const digits = cnpj.replace(/\D/g, "");
  
  // Deve ter exatamente 14 dígitos
  if (digits.length !== 14) {
    return false;
  }
  
  // Verifica se todos os dígitos são iguais (CNPJs inválidos)
  if (/^(\d)\1+$/.test(digits)) {
    return false;
  }
  
  // Valida primeiro dígito verificador
  let length = 12;
  let numbers = digits.substring(0, length);
  let sum = 0;
  let pos = length - 7;
  
  for (let i = length; i >= 1; i--) {
    sum += parseInt(numbers.charAt(length - i)) * pos--;
    if (pos < 2) pos = 9;
  }
  
  let result = sum % 11 < 2 ? 0 : 11 - (sum % 11);
  if (result !== parseInt(digits.charAt(12))) {
    return false;
  }
  
  // Valida segundo dígito verificador
  length = 13;
  numbers = digits.substring(0, length);
  sum = 0;
  pos = length - 7;
  
  for (let i = length; i >= 1; i--) {
    sum += parseInt(numbers.charAt(length - i)) * pos--;
    if (pos < 2) pos = 9;
  }
  
  result = sum % 11 < 2 ? 0 : 11 - (sum % 11);
  if (result !== parseInt(digits.charAt(13))) {
    return false;
  }
  
  return true;
}

/**
 * Valida e sanitiza um CNPJ, incluindo validação de dígitos verificadores
 */
export function validateAndSanitizeCnpj(cnpj: string): string {
  const digits = cnpj.replace(/\D/g, "");
  
  if (digits.length !== 14) {
    throw new HttpError(400, "CNPJ deve conter exatamente 14 dígitos.");
  }
  
  if (!validateCnpjChecksum(digits)) {
    throw new HttpError(400, "CNPJ inválido. Os dígitos verificadores não conferem.");
  }
  
  return digits;
}

