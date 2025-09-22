import { z } from "zod";
import { prisma } from "../lib/db";
import type { Task } from "@prisma/client";

export const input = z.object({
  title: z.string(),
  description: z.string(),
  status: z.enum(['active', 'inactive']).default('active'),
});

export const roles = ['ADMIN', 'MEMBER'];

export const routePath = '/tasks';

export const method = 'POST';

export const response = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string(),
  status: z.string(),
  userId: z.string().nullable(),
  createdAt: z.date(),
  updatedAt: z.date(),
});


export const handler = createTask;

async function createTask(params: {
  input: z.infer<typeof input>,
  authData: { id: string, role: string, name: string, email: string }
}): Promise<z.infer<typeof response>> {
  const { title, description, status } = params.input;
  console.log('authData', params.authData);

  const task = await prisma.task.create({
    data: { title, description, status },
  });

  return task;
}