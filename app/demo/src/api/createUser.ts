import { z } from "zod";
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

export const input = z.object({
  name: z.string(),
  role: z.enum(['ADMIN', 'MEMBER']),
  email: z.string(),
  password: z.string(),
});

export const routePath = '/users';

export const method = 'POST';

export const response = z.object({
  user: z.object({
    id: z.string(),
    name: z.string(),
    email: z.string(),
  }),
});

export const handler = createUser;

async function createUser(params: { input: z.infer<typeof input> }) {
  const { name, email, password } = params.input;
  const user = await prisma.user.create({
    data: { name, email, password },
  });
  return { user };
}