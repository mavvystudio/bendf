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
  } else if (command === 'build') {
    console.log('🔨 Building the BENDF application...');

    const currentDir = process.cwd();

    // Run TypeScript compiler
    const child = spawn('npx', ['tsc'], {
      cwd: currentDir,
      stdio: 'inherit',
      shell: true
    });

    child.on('close', (code: number | null) => {
      if (code === 0) {
        console.log('✅ Build completed successfully!');

        // Create the production server entry point
        const distDir = resolve(currentDir, 'dist');
        const serverEntryPoint = resolve(distDir, 'server.js');

        const serverCode = `const { createApp } = require('bendf');

const app = createApp();

app.listen(() => {
  console.log('Production server started successfully!');
});
`;

        writeFileSync(serverEntryPoint, serverCode);
        console.log('📂 Created production server entry point at dist/server.js');
      } else {
        console.error('❌ Build failed!');
        process.exit(code ?? 1);
      }
    });
  } else if (command === 'start') {
    console.log('🚀 Starting the BENDF production server...');

    const currentDir = process.cwd();
    const serverEntryPoint = resolve(currentDir, 'dist', 'server.js');

    if (!existsSync(serverEntryPoint)) {
      console.error('❌ No built server found. Please run "bendf build" first.');
      process.exit(1);
    }

    // Start the production server
    const child = spawn('node', [serverEntryPoint], {
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
    console.log('  dev      Start the development server');
    console.log('  build    Build the application for production');
    console.log('  start    Start the production server');
    console.log('');
    process.exit(1);
  }
}

main();