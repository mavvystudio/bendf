#!/usr/bin/env node

import { spawn } from 'child_process';
import { resolve } from 'path';
import { existsSync, mkdirSync, writeFileSync } from 'fs';

function main() {
  const args = process.argv.slice(2);
  const command = args[0];

  if (command === 'dev') {
    console.log('🚀 Starting the BENDF development server...');
    
    const currentDir = process.cwd();
    const distDir = resolve(currentDir, 'dist');
    const serverEntryPoint = resolve(distDir, 'server.mjs');
    
    // Ensure dist directory exists
    if (!existsSync(distDir)) {
      mkdirSync(distDir, { recursive: true });
    }
    
    // Create the server entry point
    const serverCode = `import { createApp } from 'bendf';

const app = createApp();

app.listen(() => {
  console.log('Demo app started successfully!');
});
`;
    
    writeFileSync(serverEntryPoint, serverCode);
    console.log('📂 Created server entry point at dist/server.mjs');
    
    // Start the server in watch mode using tsx to handle TypeScript
    const child = spawn('npx', ['tsx', 'watch', serverEntryPoint], {
      cwd: currentDir,
      stdio: 'inherit',
      shell: true
    });
    
    child.on('close', (code: number | null) => {
      process.exit(code ?? 0);
    });
  } else {
    console.log('🔧 BENDF Framework CLI');
    console.log('');
    console.log('Usage: bendf <command>');
    console.log('');
    console.log('Commands:');
    console.log('  dev    Start the development server');
    console.log('');
    process.exit(1);
  }
}

main();