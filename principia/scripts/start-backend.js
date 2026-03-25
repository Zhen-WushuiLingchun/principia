#!/usr/bin/env node
const { spawn, execSync } = require('child_process');
const { join } = require('path');

const projectRoot = join(__dirname, '..');

function detectPython() {
  const commands = ['python3', 'python', 'py'];
  
  for (const cmd of commands) {
    try {
      execSync(`${cmd} --version`, { stdio: 'ignore' });
      return cmd;
    } catch {
      continue;
    }
  }
  
  return null;
}

function main() {
  const pythonCmd = detectPython();
  
  if (!pythonCmd) {
    console.error('Error: No Python command found. Please install Python.');
    process.exit(1);
  }
  
  console.log(`Using Python command: ${pythonCmd}`);
  
  const child = spawn(pythonCmd, ['app.py'], {
    cwd: projectRoot,
    stdio: 'inherit',
    shell: true
  });
  
  child.on('error', (err) => {
    console.error('Failed to start backend:', err);
    process.exit(1);
  });
  
  child.on('exit', (code) => {
    process.exit(code);
  });
}

main();
