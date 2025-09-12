import { z } from "zod";
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

export const input = z.object({
  email: z.string(),
  password: z.string(),
});

export const routePath = '/login';

export const method = 'POST';

export const response = z.object({
  token: z.string(),
});

export const handler = loginUser;

async function loginUser(params: { input: z.infer<typeof input> }) {
  const { email, password } = params.input;
  const user = await prisma.user.findUnique({
    where: { email },
  });
  if (!user) {
    throw new Error('User not found');
  }
  if (user.password !== password) {
    throw new Error('Invalid password');
  }
  return { token: '1234567890' };
}