import { z } from "zod";

export const groupIdsSchema = z
  .array(z.string().trim().min(1, "Grupo inválido"))
  .max(100, "Demasiados grupos seleccionados")
  .default([]);

export const studentCreateSchema = z.object({
  nombre: z
    .string()
    .trim()
    .min(1, "El nombre es obligatorio")
    .max(120, "El nombre es demasiado largo"),
  email: z
    .string()
    .trim()
    .min(1, "El email es obligatorio")
    .email("El email no es válido")
    .transform((value) => value.toLowerCase()),
  password: z
    .string()
    .min(8, "La contraseña debe tener al menos 8 caracteres")
    .max(128, "La contraseña es demasiado larga"),
  groupIds: groupIdsSchema,
});

export const studentUpdateSchema = z.object({
  nombre: z
    .string()
    .trim()
    .min(1, "El nombre es obligatorio")
    .max(120, "El nombre es demasiado largo"),
  email: z
    .string()
    .trim()
    .min(1, "El email es obligatorio")
    .email("El email no es válido")
    .transform((value) => value.toLowerCase()),
  groupIds: groupIdsSchema,
});

export const teacherCreateSchema = z.object({
  nombre: z
    .string()
    .trim()
    .min(1, "El nombre es obligatorio")
    .max(120, "El nombre es demasiado largo"),
  email: z
    .string()
    .trim()
    .min(1, "El email es obligatorio")
    .email("El email no es válido")
    .transform((value) => value.toLowerCase()),
  password: z
    .string()
    .min(8, "La contraseña debe tener al menos 8 caracteres")
    .max(128, "La contraseña es demasiado larga"),
});

export const teacherUpdateSchema = z.object({
  nombre: z
    .string()
    .trim()
    .min(1, "El nombre es obligatorio")
    .max(120, "El nombre es demasiado largo"),
  email: z
    .string()
    .trim()
    .min(1, "El email es obligatorio")
    .email("El email no es válido")
    .transform((value) => value.toLowerCase()),
});

export const passwordResetSchema = z.object({
  password: z
    .string()
    .min(8, "La contraseña debe tener al menos 8 caracteres")
    .max(128, "La contraseña es demasiado larga"),
});

export const groupSchema = z.object({
  nombre: z
    .string()
    .trim()
    .min(1, "El nombre del grupo es obligatorio")
    .max(100, "El nombre del grupo es demasiado largo"),
});
