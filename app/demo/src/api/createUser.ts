import { z } from "zod";
import * as argon2 from "argon2";
import { prisma } from "../lib/db";

export const input = z.object({
  name: z.string(),
  role: z.enum(['ADMIN', 'MEMBER']),
  email: z.string(),
  password: z.string(),
});
export const routePath = '/users';

export const method = 'POST';

export const handler = createUser;

async function createUser(params: { 
  input: z.infer<typeof input>,
}) {
  const { name, email, password } = params.input;

  const hashedPassword = await argon2.hash(password);

  await prisma.user.create({
    data: { name, email, password: hashedPassword },
  });
  
  return {success: true};
}