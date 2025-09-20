import { z } from "zod";
import { PrismaClient } from '@prisma/client'
import { UploadedFile } from "bendf";

const prisma = new PrismaClient()

export const input = z.object({
  name: z.string(),
  role: z.enum(['ADMIN', 'MEMBER']),
  email: z.string(),
  password: z.string(),
});

export const routePath = '/users';

export const method = 'POST';

export const response = z.object({
  user: z.object({
    id: z.string(),
    name: z.string(),
    email: z.string(),
  }),
  profilePicture: z.string().optional(),
});

export const handler = createUser;

async function createUser(params: { 
  input: z.infer<typeof input>,
  files?: Record<string, UploadedFile | UploadedFile[]>
}) {
  const { name, email, password } = params.input;
  
  let profilePicture: string | undefined;
  
  // Handle optional profile picture upload
  if (params.files?.profilePicture && !Array.isArray(params.files.profilePicture)) {
    const file = params.files.profilePicture;
    console.log(`Profile picture uploaded: ${file.filename} (${file.size} bytes)`);
    // Here you would typically save the file and store the path/URL
    profilePicture = `uploads/${file.filename}`;
  }
  
  const user = await prisma.user.create({
    data: { name, email, password },
  });
  
  return { user, profilePicture };
}