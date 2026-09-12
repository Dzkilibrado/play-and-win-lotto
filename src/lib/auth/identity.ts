import { z } from "zod";

export const MINIMUM_AGE = 18;

export function digitsOnly(value: string) {
  return value.replace(/\D/g, "").slice(0, 11);
}

export function formatBrazilianPhone(value: string) {
  const digits = digitsOnly(value.replace(/^55(?=\d{10,11}$)/, ""));
  if (digits.length <= 2) return digits ? `(${digits}` : "";
  if (digits.length <= 6) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  if (digits.length <= 10) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  }
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
}

export function normalizeBrazilianPhone(value: string) {
  const digits = digitsOnly(value.replace(/^55(?=\d{10,11}$)/, ""));
  return digits.length === 10 || digits.length === 11 ? `+55${digits}` : null;
}

export function isAdult(birthDate: string, reference = new Date()) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(birthDate)) return false;
  const [year, month, day] = birthDate.split("-").map(Number);
  if (!year || !month || !day) return false;
  const born = new Date(Date.UTC(year, month - 1, day));
  if (born.getUTCFullYear() !== year || born.getUTCMonth() !== month - 1 || born.getUTCDate() !== day) return false;
  const cutoff = new Date(Date.UTC(reference.getUTCFullYear() - MINIMUM_AGE, reference.getUTCMonth(), reference.getUTCDate()));
  return born <= cutoff;
}

export function maximumBirthDate(reference = new Date()) {
  const cutoff = new Date(Date.UTC(reference.getUTCFullYear() - MINIMUM_AGE, reference.getUTCMonth(), reference.getUTCDate()));
  return cutoff.toISOString().slice(0, 10);
}

const phoneSchema = z.string().transform(normalizeBrazilianPhone).refine(Boolean, "Informe um telefone brasileiro válido");

export const signupSchema = z.object({
  name: z.string().trim().min(3, "Informe seu nome completo").max(120),
  birthDate: z.string().refine((value) => isAdult(value), "O Gestor da Sorte é destinado a usuários maiores de 18 anos."),
  phone: phoneSchema,
  email: z.string().trim().email("Informe um e-mail válido").max(255),
  password: z.string().min(8, "Use pelo menos 8 caracteres").max(72),
  confirmPassword: z.string(),
  accepted: z.literal(true, { errorMap: () => ({ message: "Aceite os Termos de Uso e a Política de Privacidade" }) }),
}).refine((data) => data.password === data.confirmPassword, { path: ["confirmPassword"], message: "As senhas não conferem" });

export const profileSchema = z.object({
  name: z.string().trim().min(3, "Informe seu nome completo").max(120),
  birthDate: z.string().refine((value) => isAdult(value), "O Gestor da Sorte é destinado a usuários maiores de 18 anos."),
  phone: phoneSchema,
  acceptedDocumentIds: z.array(z.string().uuid()).max(10),
});

export const passwordSchema = z.object({
  password: z.string().min(8, "Use pelo menos 8 caracteres").max(72),
  confirmation: z.string(),
}).refine((data) => data.password === data.confirmation, { path: ["confirmation"], message: "As senhas não conferem" });
