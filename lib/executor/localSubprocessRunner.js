const { spawn } = require('child_process');
const fs = require('fs').promises;
const path = require('path');

class LocalSubprocessRunner {
  constructor(options = {}) {
    this.pythonBinary = options.pythonBinary || process.env.PYTHON_PATH || (process.platform === 'win32' ? 'py' : 'python3');
  }

  async runCode(pythonCode, options = {}) {
    const cwd = process.cwd();
    const scratchDir = path.join(cwd, 'artifacts', 'scratch');
    await fs.mkdir(scratchDir, { recursive: true });

    const tempFile = path.join(scratchDir, `run_${Date.now()}_${Math.random().toString(36).substring(2, 7)}.py`);

    try {
      await fs.writeFile(tempFile, pythonCode, 'utf8');

      return await new Promise((resolve) => {
        const child = spawn(this.pythonBinary, [tempFile], {
          cwd,
          env: { ...process.env, PYTHONUNBUFFERED: '1' },
        });

        let stdout = '';
        let stderr = '';

        child.stdout.on('data', (chunk) => {
          stdout += chunk.toString();
        });

        child.stderr.on('data', (chunk) => {
          stderr += chunk.toString();
        });

        child.on('error', (err) => {
          resolve({
            ok: false,
            exitCode: -1,
            error: `Failed to spawn python process: ${err.message}. Ensure Python is installed and accessible in PATH.`,
            stdout,
            stderr: stderr + '\n' + err.message,
            output: null,
          });
        });

        child.on('close', (code) => {
          let output = null;
          try {
            const jsonMatch = stdout.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
              output = JSON.parse(jsonMatch[0]);
            }
          } catch {
            // output remains null
          }

          resolve({
            ok: code === 0,
            exitCode: code,
            stdout,
            stderr,
            output,
            error: code !== 0 ? (stderr.trim() || `Python process exited with code ${code}`) : null,
          });
        });
      });
    } finally {
      try {
        await fs.unlink(tempFile);
      } catch {
        // ignore cleanup error
      }
    }
  }
}

module.exports = LocalSubprocessRunner;
