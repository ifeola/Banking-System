import { z } from "zod";

export const userSchema = z.object({
  first_name: z.string().min(1).max(100),
  last_name: z.string().min(1).max(100),
  email: z.string().email().max(255),
  phone: z.string().min(7).max(20),
  password: z.string().min(6).max(128),
});

export type User = z.infer<typeof userSchema>;

export const loginSchema = z.object({
  phone: z.string().min(1),
  password: z.string().min(1),
});

export type LoginInput = z.infer<typeof loginSchema>;
