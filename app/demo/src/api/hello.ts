import { z } from "zod";

export const routePath = '/users/{user_id}/org/{org_id}';

export const method = 'GET';

export const response = z.object({
  message: z.string(),
  timestamp: z.string(),
});

export const handler = hello;

async function hello({ queryParams }: { queryParams: { user_id: string, org_id: string } }) {
  return { 
    message: `Hello from BENDF! User: ${queryParams.user_id}, Org: ${queryParams.org_id}`, 
    timestamp: new Date().toISOString() 
  };
}