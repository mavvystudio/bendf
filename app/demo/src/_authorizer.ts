import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export default async function({ req, roles }: { 
  req: any, 
  res: any, 
  roles: string[] 
}) {
  try {
    // Get Authorization header
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return false;
    }

    // Extract token
    const token = authHeader.replace('Bearer ', '');
    
    console.log('token', token);
    // Decode JWT (without verification for now - you can add JWT_SECRET later)
    const decoded = jwt.decode(token) as { clientToken?: string };
    console.log('decoded', decoded);
    if (!decoded || !decoded.clientToken) {
      return false;
    }

    // Query user by clientToken
    const user = await prisma.user.findUnique({
      where: {
        clientToken: decoded.clientToken
      },
      select: {
        id: true,
        role: true,
        name: true,
        email: true
      }
    });
    console.log('user', user);

    if (!user) {
      return false;
    }

    // Check if user has any of the required roles
    const hasRequiredRole = roles.includes(user.role);
    console.log('hasRequiredRole', hasRequiredRole);

    if (hasRequiredRole) {
      console.log('user', user);
      return user;
    }

    return false;
    
  } catch (error) {
    console.error('Authorization error:', error);
    return false;
  }
};