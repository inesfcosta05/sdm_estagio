const { execSync, spawn } = require('child_process');
const path = require('path');

const port = Number(process.env.PORT || 3001);

function killProcessListeningOnPort(targetPort) {
  try {
    const output = execSync(`netstat -ano -p tcp`, { encoding: 'utf8' });
    const lines = output.split(/\r?\n/);
    const match = lines.find((line) => line.includes(`:${targetPort}`) && /LISTENING/i.test(line));

    if (!match) {
      return false;
    }

    const parts = match.trim().split(/\s+/);
    const pid = Number(parts[parts.length - 1]);

    if (!Number.isInteger(pid) || pid <= 0) {
      return false;
    }

    try {
      execSync(`taskkill /PID ${pid} /F`, { stdio: 'ignore' });
      console.log(`🧹 Processo anterior na porta ${targetPort} terminado (PID ${pid}).`);
      return true;
    } catch (error) {
      console.log(`⚠️  Não foi possível terminar o PID ${pid} na porta ${targetPort}.`);
      return false;
    }
  } catch {
    return false;
  }
}

killProcessListeningOnPort(port);

const serverPath = path.resolve(__dirname, '..', 'server.js');
const child = spawn(process.execPath, [serverPath], {
  stdio: 'inherit',
  env: process.env
});

child.on('exit', (code, signal) => {
  if (signal) {
    process.exit(1);
  }

  process.exit(code || 0);
});

process.on('SIGINT', () => child.kill('SIGINT'));
process.on('SIGTERM', () => child.kill('SIGTERM'));