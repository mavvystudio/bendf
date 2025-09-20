import { z } from "zod";
import { UploadedFile } from "bendf";

export const routePath = '/upload';

export const method = 'POST';

export const input = z.object({
  description: z.string().optional(),
});

export const response = z.object({
  message: z.string(),
  files: z.array(z.object({
    filename: z.string(),
    mimetype: z.string(),
    size: z.number(),
  })),
});

export const handler = uploadFile;

async function uploadFile(params: { 
  input?: z.infer<typeof input>,
  files?: Record<string, UploadedFile | UploadedFile[]>
}) {
  const { input, files } = params;
  
  if (!files || Object.keys(files).length === 0) {
    throw new Error('No files uploaded');
  }

  const fileInfos = [];
  
  for (const [fieldName, file] of Object.entries(files)) {
    if (Array.isArray(file)) {
      // Multiple files with same field name
      for (const f of file) {
        console.log(`Received file: ${f.filename} (${f.size} bytes, ${f.mimetype})`);
        // Here you would typically save the file to disk or cloud storage
        // For now, just collect the info
        fileInfos.push({
          filename: f.filename,
          mimetype: f.mimetype,
          size: f.size,
        });
      }
    } else {
      // Single file
      console.log(`Received file: ${file.filename} (${file.size} bytes, ${file.mimetype})`);
      fileInfos.push({
        filename: file.filename,
        mimetype: file.mimetype,
        size: file.size,
      });
    }
  }

  return {
    message: `Successfully uploaded ${fileInfos.length} file(s)${input?.description ? `. Description: ${input.description}` : ''}`,
    files: fileInfos,
  };
}