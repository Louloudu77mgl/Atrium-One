import { spawn } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const projectRoot = process.cwd();
const localEnv = readLocalEnv(join(projectRoot, ".env.local"));
const environment = { ...process.env, ...localEnv };
const cronSecret = environment.CRON_SECRET;
const appOrigin = (environment.NEXT_PUBLIC_APP_URL_LOCAL || "http://localhost:3000").replace(/\/$/, "");
const nextBinary = join(projectRoot, "node_modules", "next", "dist", "bin", "next");
const nextProcess = spawn(process.execPath, [nextBinary, "dev"], {
  cwd: projectRoot,
  env: environment,
  stdio: "inherit"
});

let cronRunning = false;

async function triggerScheduledPublications() {
  if (!cronSecret || cronRunning) return;
  cronRunning = true;
  try {
    for (const endpoint of ["social-publish", "emailing-send"]) {
      const response = await fetch(`${appOrigin}/api/cron/${endpoint}`, {
        headers: { Authorization: `Bearer ${cronSecret}` },
        signal: AbortSignal.timeout(45_000)
      });
      const payload = await response.json();
      if (!response.ok) {
        console.error(`[local-cron:${endpoint}] ${response.status}: ${payload.error ?? "Erreur inconnue"}`);
      } else if (payload.processed > 0) {
        console.log(`[local-cron:${endpoint}] ${payload.processed} élément(s) planifié(s) traité(s).`);
      }
    }
  } catch (error) {
    if (nextProcess.exitCode === null && error instanceof Error && !error.message.includes("fetch failed")) {
      console.error(`[local-cron] ${error.message}`);
    }
  } finally {
    cronRunning = false;
  }
}

const startupTimer = setTimeout(() => void triggerScheduledPublications(), 2_000);
const cronTimer = setInterval(() => void triggerScheduledPublications(), 15_000);

function stop(signal) {
  clearTimeout(startupTimer);
  clearInterval(cronTimer);
  if (nextProcess.exitCode === null) nextProcess.kill(signal);
}

process.on("SIGINT", () => stop("SIGINT"));
process.on("SIGTERM", () => stop("SIGTERM"));
nextProcess.on("exit", (code) => {
  clearTimeout(startupTimer);
  clearInterval(cronTimer);
  process.exit(code ?? 0);
});

function readLocalEnv(path) {
  try {
    return Object.fromEntries(
      readFileSync(path, "utf8")
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter((line) => line && !line.startsWith("#"))
        .map((line) => {
          const separator = line.indexOf("=");
          if (separator < 0) return [line, ""];
          const key = line.slice(0, separator).trim();
          const value = line.slice(separator + 1).trim().replace(/^(['"])(.*)\1$/, "$2");
          return [key, value];
        })
    );
  } catch {
    return {};
  }
}
