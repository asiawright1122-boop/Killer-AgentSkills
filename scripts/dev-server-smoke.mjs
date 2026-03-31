import { setTimeout as delay } from 'node:timers/promises';
import { spawn } from 'node:child_process';

const HOST = process.env.DEV_SMOKE_HOST ?? '127.0.0.1';
const PORT = Number.parseInt(process.env.DEV_SMOKE_PORT ?? '0', 10);
const STARTUP_TIMEOUT_MS = Number.parseInt(process.env.DEV_SMOKE_TIMEOUT_MS ?? '45000', 10);
const SHUTDOWN_TIMEOUT_MS = 5000;
const READY_PATHS = ['/en', '/'];
const LOCAL_URL_PATTERN = /https?:\/\/[^\s/]+:(\d+)\//i;

const child = spawn('npm', ['run', 'dev', '--', '--host', HOST, '--port', String(PORT)], {
  cwd: process.cwd(),
  env: process.env,
  stdio: ['ignore', 'pipe', 'pipe'],
});

let childExited = false;
let childExitCode = null;
let childSignal = null;
let outputTail = '';
let activePort = Number.isFinite(PORT) && PORT > 0 ? PORT : null;

const rememberOutput = (chunk) => {
  outputTail = `${outputTail}${chunk}`.slice(-6000);
};

const detectPort = () => {
  const match = outputTail.match(LOCAL_URL_PATTERN);
  if (match) {
    activePort = Number.parseInt(match[1], 10);
  }
};

const writeOutput = (chunk, stream) => {
  const text = chunk.toString();
  rememberOutput(text);
  detectPort();
  stream.write(text);
};

child.stdout.on('data', (chunk) => writeOutput(chunk, process.stdout));
child.stderr.on('data', (chunk) => writeOutput(chunk, process.stderr));
child.on('exit', (code, signal) => {
  childExited = true;
  childExitCode = code;
  childSignal = signal;
});

async function isReady() {
  if (!activePort) {
    return { ready: false };
  }

  for (const path of READY_PATHS) {
    try {
      const response = await fetch(`http://${HOST}:${activePort}${path}`, {
        redirect: 'manual',
        signal: AbortSignal.timeout(1500),
      });
      if (response.status >= 200 && response.status < 400) {
        return { ready: true, path, status: response.status };
      }
    } catch {
      // Server is not ready yet.
    }
  }

  return { ready: false };
}

async function shutdownChild() {
  if (childExited) {
    return;
  }

  child.kill('SIGTERM');
  const deadline = Date.now() + SHUTDOWN_TIMEOUT_MS;
  while (!childExited && Date.now() < deadline) {
    await delay(100);
  }

  if (!childExited) {
    child.kill('SIGKILL');
  }
}

const cleanupAndExit = async (code) => {
  await shutdownChild();
  process.exit(code);
};

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, async () => {
    await cleanupAndExit(1);
  });
}

const startedAt = Date.now();

while (Date.now() - startedAt < STARTUP_TIMEOUT_MS) {
  if (childExited) {
    console.error(
      `Dev server exited before becoming ready (code=${childExitCode ?? 'null'}, signal=${childSignal ?? 'null'}).`,
    );
    if (outputTail.trim()) {
      console.error(outputTail.trim());
    }
    await cleanupAndExit(1);
  }

  const readiness = await isReady();
  if (readiness.ready) {
    console.log(
      `Dev server is reachable at http://${HOST}:${activePort}${readiness.path} (status ${readiness.status}). Shutting down smoke process.`,
    );
    await cleanupAndExit(0);
  }

  await delay(500);
}

console.error(
  `Timed out after ${STARTUP_TIMEOUT_MS}ms waiting for Astro dev server readiness on ${HOST}:${activePort ?? 'unknown'}.`,
);
if (outputTail.trim()) {
  console.error(outputTail.trim());
}
await cleanupAndExit(1);
