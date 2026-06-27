import { z } from "zod";
import { validarCpf } from "@/shared/utils/cpf";

export const cpfSchema = z
  .string()
  .min(11)
  .max(14)
  .refine((value) => validarCpf(value), { message: "CPF invalido." });
