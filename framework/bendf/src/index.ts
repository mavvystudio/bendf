import { createServer, IncomingMessage, ServerResponse } from 'http';
import { parse } from 'url';
import { readdir, stat } from 'fs/promises';
import { join } from 'path';
import { pathToFileURL } from 'url';
import { z } from 'zod';

interface ApiRoute {
  method: string;
  routePath: string;
  handler: (params: any) => Promise<any>;
  input?: z.ZodSchema;
  queryParams?: z.ZodSchema;
  response?: z.ZodSchema;
  roles?: string[];
}

export class BendfApp {
  private readonly port: number;
  private routes: Map<string, ApiRoute> = new Map();
  private server?: any;
  private authorizer?: (context: { req: IncomingMessage, res: ServerResponse, roles: string[] }) => Promise<boolean>;

  constructor() {
    const envPort = (globalThis as any)?.process?.env?.PORT;
    const parsed = Number(envPort);
    this.port = Number.isFinite(parsed) && parsed > 0 ? parsed : 8000;
  }

  private async loadAuthorizer(srcDir: string): Promise<void> {
    try {
      const authorizerPath = join(srcDir, '_authorizer.ts');
      const authorizerUrl = pathToFileURL(authorizerPath).href;
      
      try {
        await stat(authorizerPath);
        const authorizerModule = await import(authorizerUrl);
        
        if (authorizerModule.default && typeof authorizerModule.default === 'function') {
          this.authorizer = authorizerModule.default;
          console.log('Loaded authorizer from src/_authorizer.ts');
        } else if (authorizerModule.authorize && typeof authorizerModule.authorize === 'function') {
          this.authorizer = authorizerModule.authorize;
          console.log('Loaded authorizer from src/_authorizer.ts');
        } else {
          console.warn('_authorizer.ts must export default function or authorize function');
        }
      } catch (error) {
        // Authorizer file doesn't exist or failed to load, continue without authorization
      }
    } catch (error) {
      // Ignore errors - authorization is optional
    }
  }

  private async loadApiRoutes(apiDir: string): Promise<void> {
    try {
      const files = await readdir(apiDir);
      
      for (const file of files) {
        if (file.endsWith('.ts') || file.endsWith('.js')) {
          const filePath = join(apiDir, file);
          const fileUrl = pathToFileURL(filePath).href;
          
          try {
            const module = await import(fileUrl);
            
            if (module.handler && module.method && module.routePath) {
              const route: ApiRoute = {
                method: module.method.toUpperCase(),
                routePath: module.routePath,
                handler: module.handler,
                input: module.input,
                queryParams: module.queryParams,
                response: module.response,
                roles: module.roles
              };
              
              const key = `${route.method}:${route.routePath}`;
              this.routes.set(key, route);
              
              const roleInfo = route.roles ? ` (roles: ${route.roles.join(', ')})` : '';
              console.log(`Loaded route: ${route.method} ${route.routePath}${roleInfo}`);
            }
          } catch (error) {
            console.warn(`Failed to load API file ${file}:`, error);
          }
        }
      }
    } catch (error) {
      console.warn(`Failed to read API directory ${apiDir}:`, error);
    }
  }

  private async handleRequest(req: IncomingMessage, res: ServerResponse): Promise<void> {
    const url = parse(req.url || '', true);
    const method = req.method?.toUpperCase() || 'GET';
    const pathname = url.pathname || '/';
    
    const routeKey = `${method}:${pathname}`;
    const route = this.routes.get(routeKey);
    
    if (!route) {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Route not found' }));
      return;
    }

    // Check authorization if route has roles and authorizer exists
    if (route.roles && route.roles.length > 0 && this.authorizer) {
      try {
        const isAuthorized = await this.authorizer({ req, res, roles: route.roles });
        if (!isAuthorized) {
          res.writeHead(403, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Forbidden', message: 'Insufficient permissions' }));
          return;
        }
      } catch (authError) {
        console.error('Authorization error:', authError);
        res.writeHead(403, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Authorization failed' }));
        return;
      }
    }

    try {
      let requestData: any = {};
      
      if (method === 'POST' || method === 'PUT' || method === 'PATCH') {
        const body = await this.getRequestBody(req);
        if (route.input) {
          requestData.input = route.input.parse(JSON.parse(body));
        } else {
          requestData.input = JSON.parse(body);
        }
      }
      
      if (route.queryParams && Object.keys(url.query).length > 0) {
        requestData.queryParams = route.queryParams.parse(url.query);
      }
      
      const result = await route.handler(requestData);
      
      if (route.response) {
        route.response.parse(result);
      }
      
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(result));
      
    } catch (error) {
      console.error('Route handler error:', error);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Internal server error' 
      }));
    }
  }

  private getRequestBody(req: IncomingMessage): Promise<string> {
    return new Promise((resolve, reject) => {
      let body = '';
      req.on('data', (chunk: Buffer) => {
        body += chunk.toString();
      });
      req.on('end', () => resolve(body));
      req.on('error', reject);
    });
  }

  async listen(callback?: () => void): Promise<void> {
    const srcDir = process.cwd() + '/src';
    const apiDir = join(srcDir, 'api');
    
    // Load authorizer first
    await this.loadAuthorizer(srcDir);
    
    try {
      const apiStat = await stat(apiDir);
      if (apiStat.isDirectory()) {
        await this.loadApiRoutes(apiDir);
      }
    } catch (error) {
      console.warn('No API directory found or error loading routes:', error);
    }
    
    this.server = createServer((req: IncomingMessage, res: ServerResponse) => {
      this.handleRequest(req, res).catch(error => {
        console.error('Request handling error:', error);
        if (!res.headersSent) {
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Internal server error' }));
        }
      });
    });

    this.server.listen(this.port, () => {
      console.log(`Bendf server listening on port ${this.port}`);
      if (callback) callback();
    });
  }

  close(): void {
    if (this.server) {
      this.server.close();
    }
  }
}

export function createApp(): BendfApp {
  return new BendfApp();
}

export const api = {};
