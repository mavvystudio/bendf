import { z } from "zod";
import { prisma } from "../lib/db";

export const input = z.object({
  title: z.string(),
  description: z.string(),
  status: z.enum(['active', 'inactive']).default('active'),
});

export const roles = ['ADMIN'];

export const routePath = '/tasks';

export const method = 'POST';

export const response = z.object({
  task: z.object({
    id: z.string(),
    title: z.string(),
    description: z.string(),
    status: z.enum(['active', 'inactive']),
  }),
});

export const handler = createTask;

async function createTask(params: {
  input: z.infer<typeof input>,
  authData: { id: string, role: string, name: string, email: string }
}) {
  const { title, description, status } = params.input;
  console.log('authData', params.authData);

  const task = await prisma.task.create({
    data: { title, description, status },
  });

  return { task };
}