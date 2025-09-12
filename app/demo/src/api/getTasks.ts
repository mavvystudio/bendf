import { z } from "zod";
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

export const roles = ['ADMIN', 'MEMBER'];

export const routePath = '/tasks';

export const method = 'GET';

export const queryParams = z.object({
  status: z.enum(['active', 'inactive']),
});

export const response = z.object({
  tasks: z.array(z.object({
    id: z.string(),
    title: z.string(),
    description: z.string(),
    status: z.enum(['active', 'inactive']),
  })),
});

export const handler = getTasks;

async function getTasks(params: { queryParams: z.infer<typeof queryParams> }) {
  const { status } = params.queryParams;
  const tasks = await prisma.task.findMany({
    where: { status },
  });
  return { tasks };
}