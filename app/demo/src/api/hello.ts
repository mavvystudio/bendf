import { z } from "zod";

export const routePath = '/hello';

export const method = 'GET';

export const response = z.object({
  message: z.string(),
  timestamp: z.string(),
});

export const handler = hello;

async function hello() {
  return { 
    message: 'Hello from BENDF!', 
    timestamp: new Date().toISOString() 
  };
}