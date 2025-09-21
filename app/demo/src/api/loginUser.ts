import { z } from "zod";
import jwt from "jsonwebtoken";
import * as argon2 from "argon2";
import { prisma } from "../lib/db";

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
  const isValidPassword = await argon2.verify(user.password, password);
  if (!isValidPassword) {
    throw new Error('Invalid password');
  }
  if (!user.clientToken) {
    console.log('user', user);
    throw new Error('Client token not found');
  }
  const token = jwt.sign(
    { clientToken: user.clientToken },
    process.env.JWT_SECRET as string,
    { expiresIn: '24h' }
  );

  return { token };
}