import { createServer, IncomingMessage, ServerResponse } from 'http';
import { parse } from 'url';
import { readdir, stat } from 'fs/promises';
import { join } from 'path';
import { pathToFileURL } from 'url';
import { z } from 'zod';

export interface UploadedFile {
  filename: string;
  mimetype: string;
  buffer: Buffer;
  size: number;
}

interface ApiRoute {
  method: string;
  routePath: string;
  handler: (params: any) => Promise<any>;
  input?: z.ZodSchema;
  response?: z.ZodSchema;
  roles?: string[];
}

export class BendfApp {
  private readonly port: number;
  private routes: Map<string, ApiRoute> = new Map();
  private dynamicRoutes: ApiRoute[] = [];
  private server?: any;
  private authorizer?: (context: { req: IncomingMessage, res: ServerResponse, roles: string[] }) => Promise<any>;

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
                response: module.response,
                roles: module.roles
              };
              
              if (route.routePath.includes('{')) {
                this.dynamicRoutes.push(route);
              } else {
                const key = `${route.method}:${route.routePath}`;
                this.routes.set(key, route);
              }
              
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
    let route = this.routes.get(routeKey);
    let pathParams: Record<string, string> = {};
    
    if (!route) {
      // Try to match dynamic routes
      const matchedRoute = this.findDynamicRoute(method, pathname);
      if (matchedRoute) {
        route = matchedRoute.route;
        pathParams = matchedRoute.params;
      }
    }
    
    if (!route) {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Route not found' }));
      return;
    }

    // Check authorization if route has roles and authorizer exists
    let authData: any = undefined;
    if (route.roles && route.roles.length > 0 && this.authorizer) {
      try {
        authData = await this.authorizer({ req, res, roles: route.roles });
        if (!authData) {
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
      
      const contentType = req.headers['content-type'] || '';
      
      if (method === 'POST' || method === 'PUT' || method === 'PATCH') {
        if (contentType.includes('multipart/form-data')) {
          const formData = await this.parseMultipartData(req);
          if (formData.fields && Object.keys(formData.fields).length > 0) {
            if (route.input) {
              requestData.input = route.input.parse(formData.fields);
            } else {
              requestData.input = formData.fields;
            }
          }
          if (formData.files && Object.keys(formData.files).length > 0) {
            requestData.files = formData.files;
          }
        } else {
          const body = await this.getRequestBody(req);
          if (route.input) {
            requestData.input = route.input.parse(JSON.parse(body));
          } else {
            requestData.input = JSON.parse(body);
          }
        }
      }
      
      if (Object.keys(pathParams).length > 0) {
        requestData.queryParams = pathParams;
      }

      if (authData !== undefined) {
        requestData.authData = authData;
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

  private parseMultipartData(req: IncomingMessage): Promise<{ fields: Record<string, any>, files: Record<string, UploadedFile | UploadedFile[]> }> {
    return new Promise((resolve, reject) => {
      const contentType = req.headers['content-type'] || '';
      const boundaryMatch = contentType.match(/boundary=(.+)$/);
      
      if (!boundaryMatch) {
        return reject(new Error('Missing boundary in multipart data'));
      }
      
      const boundary = '--' + boundaryMatch[1];
      const fields: Record<string, any> = {};
      const files: Record<string, UploadedFile | UploadedFile[]> = {};
      
      let buffer = Buffer.alloc(0);
      
      req.on('data', (chunk: Buffer) => {
        buffer = Buffer.concat([buffer, chunk]);
      });
      
      req.on('end', () => {
        try {
          this.processMultipartBuffer(buffer, boundary, fields, files);
          resolve({ fields, files });
        } catch (error) {
          reject(error);
        }
      });
      
      req.on('error', reject);
    });
  }

  private processMultipartBuffer(
    buffer: Buffer, 
    boundary: string, 
    fields: Record<string, any>, 
    files: Record<string, UploadedFile | UploadedFile[]>
  ): void {
    const parts = buffer.toString('binary').split(boundary);
    
    for (const part of parts) {
      if (part.trim() === '' || part.trim() === '--') continue;
      
      const [headers, ...bodyParts] = part.split('\r\n\r\n');
      if (!headers || bodyParts.length === 0) continue;
      
      const body = bodyParts.join('\r\n\r\n').replace(/\r\n$/, '');
      const headerLines = headers.split('\r\n');
      
      let name = '';
      let filename = '';
      let contentType = 'text/plain';
      
      for (const header of headerLines) {
        const dispositionMatch = header.match(/Content-Disposition: form-data; name="([^"]+)"(?:; filename="([^"]+)")?/);
        if (dispositionMatch) {
          name = dispositionMatch[1];
          filename = dispositionMatch[2] || '';
        }
        
        const typeMatch = header.match(/Content-Type: (.+)/);
        if (typeMatch) {
          contentType = typeMatch[1];
        }
      }
      
      if (!name) continue;
      
      if (filename) {
        // This is a file
        const fileBuffer = Buffer.from(body, 'binary');
        const file: UploadedFile = {
          filename,
          mimetype: contentType,
          buffer: fileBuffer,
          size: fileBuffer.length
        };
        
        if (files[name]) {
          // Multiple files with same name
          if (Array.isArray(files[name])) {
            (files[name] as UploadedFile[]).push(file);
          } else {
            files[name] = [files[name] as UploadedFile, file];
          }
        } else {
          files[name] = file;
        }
      } else {
        // This is a regular field
        try {
          // Try to parse as JSON first
          fields[name] = JSON.parse(body);
        } catch {
          // If not JSON, store as string
          fields[name] = body;
        }
      }
    }
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

  private findDynamicRoute(method: string, pathname: string): { route: ApiRoute, params: Record<string, string> } | null {
    for (const route of this.dynamicRoutes) {
      if (route.method.toUpperCase() !== method.toUpperCase()) continue;
      
      const match = this.matchPath(route.routePath, pathname);
      if (match) {
        return { route, params: match };
      }
    }
    return null;
  }

  private matchPath(pattern: string, path: string): Record<string, string> | null {
    const patternParts = pattern.split('/');
    const pathParts = path.split('/');
    
    if (patternParts.length !== pathParts.length) {
      return null;
    }
    
    const params: Record<string, string> = {};
    
    for (let i = 0; i < patternParts.length; i++) {
      const patternPart = patternParts[i];
      const pathPart = pathParts[i];
      
      if (patternPart.startsWith('{') && patternPart.endsWith('}')) {
        // Extract parameter name from {param_name}
        const paramName = patternPart.slice(1, -1);
        params[paramName] = pathPart;
      } else if (patternPart !== pathPart) {
        return null;
      }
    }
    
    return params;
  }
}

export function createApp(): BendfApp {
  return new BendfApp();
}

export const api = {};
