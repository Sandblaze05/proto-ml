const { spawn } = require('child_process');
const http = require('http');

/**
 * Checks if a port is already in use.
 */
function isPortInUse(port) {
  return new Promise((resolve) => {
    const server = http.createServer().listen(port, () => {
      server.close();
      resolve(false);
    });
    server.on('error', () => resolve(true));
  });
}

function log(source, data, isError = false) {
  const prefix = source === 'jupyter' ? '\x1b[35m[Jupyter]\x1b[0m' : '\x1b[36m[Next.js]\x1b[0m';
  const lines = data.toString().trim().split('\n');
  lines.forEach(line => {
    if (isError) {
      console.error(`${prefix} ${line}`);
    } else {
      console.log(`${prefix} ${line}`);
    }
  });
}

async function start() {
  console.log('\x1b[32m[Proto-ML Runner] Starting dev environment...\x1b[0m');

  // 1. Check/Start Jupyter on 8888
  const jupyterInUse = await isPortInUse(8888);
  let jupyterProcess = null;

  if (jupyterInUse) {
    console.log('\x1b[33m[Proto-ML Runner] Port 8888 is already in use. Assuming Jupyter is already running.\x1b[0m');
  } else {
    console.log('\x1b[32m[Proto-ML Runner] Launching Jupyter on port 8888...\x1b[0m');
    jupyterProcess = spawn('python', [
      '-m', 'jupyter', 'notebook',
      '--NotebookApp.allow_origin=\'*\'',
      '--NotebookApp.token=\'\'',
      '--NotebookApp.password=\'\'',
      '--NotebookApp.disable_check_xsrf=True',
      '--port', '8888',
      '--no-browser'
    ], { shell: true });

    jupyterProcess.stdout.on('data', (d) => log('jupyter', d));
    jupyterProcess.stderr.on('data', (d) => log('jupyter', d));
    
    jupyterProcess.on('error', (err) => {
      console.error('\x1b[31m[Proto-ML Runner] Failed to start Jupyter process:\x1b[0m', err.message);
    });
  }

  // 2. Start Next.js
  console.log('\x1b[32m[Proto-ML Runner] Launching Next.js...\x1b[0m');
  const nextProcess = spawn('npx', ['next', 'dev'], { shell: true });

  nextProcess.stdout.on('data', (d) => log('next', d));
  nextProcess.stderr.on('data', (d) => log('next', d));

  // 3. Cleanup on exit
  const cleanup = () => {
    console.log('\n\x1b[32m[Proto-ML Runner] Shutting down...\x1b[0m');
    if (jupyterProcess) {
      // On Windows, taskkill might be cleaner
      if (process.platform === 'win32') {
        spawn('taskkill', ['/pid', jupyterProcess.pid, '/f', '/t'], { shell: true });
      } else {
        jupyterProcess.kill();
      }
    }
    nextProcess.kill();
    process.exit();
  };

  process.on('SIGINT', cleanup);
  process.on('SIGTERM', cleanup);
}

start();
