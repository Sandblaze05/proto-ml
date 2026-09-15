const { spawn } = require('child_process');

class LocalSubprocessRunner {
  constructor(options = {}) {
    this.pythonBinary = options.pythonBinary || process.env.PYTHON_PATH || (process.platform === 'win32' ? 'py' : 'python3');
  }

  async runCode(pythonCode, options = {}) {
    const cwd = process.cwd();
    return new Promise((resolve) => {
      const child = spawn(this.pythonBinary, ['-'], {
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

      child.stdin.end(pythonCode);

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
          if (jsonMatch) output = JSON.parse(jsonMatch[0]);
        } catch {
          // Output remains null when the process did not print JSON.
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
  }
}

module.exports = LocalSubprocessRunner;
