// app/validations/auth.js
import { z } from 'zod';

export const signupSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(50),
  storeName: z.string().min(2).max(100)
});

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8)
});