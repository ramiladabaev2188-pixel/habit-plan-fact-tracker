import { spawn } from "node:child_process";
import { setTimeout as delay } from "node:timers/promises";

const isWindows = process.platform === "win32";
const baseURL = process.env.E2E_BASE_URL ?? "http://127.0.0.1:3000";
const shouldStartServer = !process.env.E2E_BASE_URL;
let serverProcess = null;
let exitCode = 0;

try {
  if (shouldStartServer) {
    serverProcess = spawnCommand(nextBinary(), ["dev", "--hostname", "127.0.0.1"], {
      cwd: process.cwd(),
      env: process.env,
      stdio: ["ignore", "pipe", "pipe"]
    });

    serverProcess.stdout.on("data", (chunk) => process.stdout.write(`[e2e-server] ${chunk}`));
    serverProcess.stderr.on("data", (chunk) => process.stderr.write(`[e2e-server] ${chunk}`));
    await waitForServer(baseURL);
  }

  const result = await runPlaywright(baseURL);
  exitCode = result;
} catch (error) {
  console.error(error);
  exitCode = 1;
} finally {
  if (serverProcess) {
    await stopProcessTree(serverProcess.pid);
  }
  process.exit(exitCode);
}

function nextBinary() {
  return isWindows ? "node_modules\\.bin\\next.cmd" : "node_modules/.bin/next";
}

function playwrightBinary() {
  return isWindows ? "node_modules\\.bin\\playwright.cmd" : "node_modules/.bin/playwright";
}

async function waitForServer(url) {
  const deadline = Date.now() + 120_000;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(url);
      if (response.status < 500) {
        return;
      }
    } catch {
      // Server is still starting.
    }
    await delay(1000);
  }

  throw new Error(`E2E server did not become ready at ${url}`);
}

function runPlaywright(url) {
  return new Promise((resolve) => {
    const child = spawnCommand(playwrightBinary(), ["test"], {
      cwd: process.cwd(),
      env: { ...process.env, E2E_BASE_URL: url },
      stdio: ["ignore", "pipe", "pipe"]
    });
    let settled = false;
    let output = "";

    const finish = async (code) => {
      if (settled) {
        return;
      }
      settled = true;
      await stopProcessTree(child.pid);
      resolve(code);
    };

    const handleOutput = (chunk, target) => {
      const text = chunk.toString();
      output += text;
      target.write(text);

      if (/\bpassed\b/i.test(output) && !/\bfailed\b/i.test(output)) {
        setTimeout(() => void finish(0), 1000);
      }
      if (/\bfailed\b/i.test(output)) {
        setTimeout(() => void finish(1), 1000);
      }
    };

    child.stdout.on("data", (chunk) => handleOutput(chunk, process.stdout));
    child.stderr.on("data", (chunk) => handleOutput(chunk, process.stderr));

    child.on("close", (code) => void finish(code ?? 1));
    child.on("error", () => void finish(1));
  });
}

function spawnCommand(command, args, options) {
  if (!isWindows) {
    return spawn(command, args, { ...options, shell: false });
  }

  return spawn("cmd.exe", ["/d", "/s", "/c", command, ...args], { ...options, shell: false });
}

function stopProcessTree(pid) {
  return new Promise((resolve) => {
    if (!pid) {
      resolve();
      return;
    }

    if (isWindows) {
      const killer = spawn("taskkill", ["/pid", String(pid), "/t", "/f"], { stdio: "ignore" });
      killer.on("exit", () => resolve());
      killer.on("error", () => resolve());
      return;
    }

    try {
      process.kill(-pid, "SIGTERM");
    } catch {
      try {
        process.kill(pid, "SIGTERM");
      } catch {
        // Already stopped.
      }
    }
    resolve();
  });
}
