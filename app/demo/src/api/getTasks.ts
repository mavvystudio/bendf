import { z } from "zod";
import { prisma } from "../lib/db";

export const roles = ['ADMIN', 'MEMBER'];

export const routePath = '/tasks';

export const method = 'GET';


export const response = z.object({
  tasks: z.array(z.object({
    id: z.string(),
    title: z.string(),
    description: z.string(),
    status: z.enum(['active', 'inactive']),
  })),
});

export const handler = getTasks;

async function getTasks() {
  const tasks = await prisma.task.findMany();
  return { tasks };
}