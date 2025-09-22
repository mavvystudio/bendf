# Bendf Framework

A lightweight, TypeScript-first web framework for building type-safe APIs with automatic validation and documentation generation.

## Features

- 🚀 **Zero-config setup** - Start building APIs immediately
- 📝 **Type-safe** - Full TypeScript support with Zod schema validation
- 🔐 **Built-in authentication** - Role-based authorization with JWT support
- 📚 **Auto-generated docs** - Beautiful HTML documentation at `/docs`
- 📁 **File uploads** - Multipart form data support
- 🛣️ **Dynamic routing** - Path parameters with `{param}` syntax
- ⚡ **Fast development** - Hot reload and minimal boilerplate

## Quick Start

### Installation

```bash
npm install bendf
```

### Basic Usage

```typescript
// src/index.ts
import { createApp } from 'bendf';

const app = createApp();
app.listen(() => {
  console.log('Server running on port 8000');
});
```

### Creating API Routes

Create files in `src/api/` directory:

```typescript
// src/api/hello.ts
import { z } from 'zod';

export const routePath = '/hello';
export const method = 'GET';

export const response = z.object({
  message: z.string(),
  timestamp: z.string(),
});

export const handler = async () => {
  return {
    message: 'Hello from Bendf!',
    timestamp: new Date().toISOString()
  };
};
```

### POST Endpoints with Validation

```typescript
// src/api/createUser.ts
import { z } from 'zod';

export const input = z.object({
  name: z.string(),
  email: z.string().email(),
  age: z.number().min(18),
});

export const routePath = '/users';
export const method = 'POST';

export const response = z.object({
  id: z.string(),
  name: z.string(),
  email: z.string(),
});

export const handler = async (params: { input: z.infer<typeof input> }) => {
  const { name, email, age } = params.input;

  // Your logic here
  return {
    id: '123',
    name,
    email
  };
};
```

### Dynamic Routes

```typescript
// src/api/getUser.ts
export const routePath = '/users/{id}';
export const method = 'GET';

export const handler = async ({ queryParams }: {
  queryParams: { id: string }
}) => {
  return { user: { id: queryParams.id } };
};
```

### Authentication & Authorization

Create an authorizer:

```typescript
// src/_authorizer.ts
import jwt from 'jsonwebtoken';

export default async function({ req, roles }: {
  req: any,
  roles: string[]
}) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return false;
  }

  const token = authHeader.replace('Bearer ', '');
  const decoded = jwt.verify(token, process.env.JWT_SECRET) as any;

  // Return user data that will be passed to handlers as authData
  return {
    id: decoded.userId,
    role: decoded.role,
    email: decoded.email
  };
}
```

Protected routes:

```typescript
// src/api/protectedRoute.ts
export const roles = ['ADMIN', 'USER'];

export const handler = async (params: {
  authData: { id: string, role: string, email: string }
}) => {
  // Access authenticated user data
  console.log('User:', params.authData);
  return { success: true };
};
```

### File Uploads

```typescript
// src/api/upload.ts
import { UploadedFile } from 'bendf';

export const method = 'POST';
export const routePath = '/upload';

export const handler = async (params: {
  files?: Record<string, UploadedFile | UploadedFile[]>
}) => {
  const file = params.files?.profilePicture as UploadedFile;

  return {
    filename: file.filename,
    size: file.size,
    mimetype: file.mimetype
  };
};
```

## API Documentation

Bendf automatically generates beautiful API documentation. Visit `/docs` to see:

- All available endpoints
- HTTP methods and paths
- Required roles/permissions
- Request/response schemas
- Input validation rules

## Environment Variables

```bash
PORT=8000              # Server port (default: 8000)
JWT_SECRET=your-secret # For JWT token verification
```

## Project Structure

```
src/
├── api/              # API route files
│   ├── hello.ts
│   ├── createUser.ts
│   └── getUser.ts
├── _authorizer.ts    # Authentication logic (optional)
└── index.ts         # Server entry point
```

## Route File Format

Each route file must export:

- `routePath` - URL path (supports `{param}` syntax)
- `method` - HTTP method ('GET', 'POST', 'PUT', 'DELETE')
- `handler` - Async function that handles the request
- `input` - Zod schema for request validation (optional)
- `response` - Zod schema for response validation (optional)
- `roles` - Array of required roles for authorization (optional)

## Advanced Features

### Custom Validation

```typescript
export const input = z.object({
  email: z.string().email(),
  password: z.string().min(8).regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/),
  age: z.number().min(18).max(120),
  preferences: z.array(z.enum(['email', 'sms', 'push'])).optional()
});
```

### Error Handling

Bendf automatically handles:
- Validation errors (400 Bad Request)
- Authorization errors (403 Forbidden)
- Route not found (404 Not Found)
- Internal server errors (500 Internal Server Error)

### TypeScript Support

Full type inference from Zod schemas:

```typescript
export const handler = async (params: {
  input: z.infer<typeof input>,
  authData?: { id: string, role: string },
  queryParams?: Record<string, string>,
  files?: Record<string, UploadedFile | UploadedFile[]>
}) => {
  // params.input is fully typed based on your schema
};
```

## Contributing

1. Fork the repository
2. Create your feature branch
3. Commit your changes
4. Push to the branch
5. Create a Pull Request

## License

MIT License - see LICENSE file for details.