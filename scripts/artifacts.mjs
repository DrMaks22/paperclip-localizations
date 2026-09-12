import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

export const ROOT = fs.realpathSync(fileURLToPath(new URL("../", import.meta.url)));
export const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");
export const json = (value) => JSON.stringify(value, null, 2) + "\n";
const MAX_BUFFER = 256 * 1024 * 1024;
const commandEnv = Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.startsWith("GIT_")));
Object.assign(commandEnv, {
  GIT_CONFIG_NOSYSTEM: "1", GIT_CONFIG_GLOBAL: os.devNull,
  GIT_NO_REPLACE_OBJECTS: "1", GIT_NO_LAZY_FETCH: "1", GIT_TERMINAL_PROMPT: "0",
  GIT_ATTR_NOSYSTEM: "1", GIT_OPTIONAL_LOCKS: "0",
});

export function command(executable, args, cwd, input) {
  const result = spawnSync(executable, args, {
    cwd, env: commandEnv, input, encoding: null, maxBuffer: MAX_BUFFER, timeout: 120_000,
  });
  if (result.error || result.status !== 0) {
    throw new Error(`${executable} failed: ${result.error?.message ?? result.stderr?.toString().trim() ?? result.status}`);
  }
  return result.stdout;
}

export function git(cwd, args) {
  return command("git", [
    "-c", `core.hooksPath=${os.devNull}`, "-c", "core.fsmonitor=false",
    "-c", "core.autocrlf=false", "-c", "color.ui=false", "-c", "core.quotePath=true",
    "-c", `core.attributesFile=${os.devNull}`, "-c", "diff.algorithm=myers",
    "-C", cwd, ...args,
  ], ROOT);
}

export function parseUpstreamArgument(args = process.argv.slice(2)) {
  const check = args.includes("--check");
  const rest = args.filter((arg) => arg !== "--check");
  if (args.filter((arg) => arg === "--check").length > 1 || rest.length !== 2 || rest[0] !== "--upstream" || !path.isAbsolute(rest[1])) {
    throw new Error("Usage: node scripts/{build,verify}.mjs --upstream /absolute/Paperclip/repository [--check]");
  }
  return { upstream: fs.realpathSync(rest[1]), check };
}

export function requireNode() {
  if (process.versions.node.split(".")[0] !== "24") throw new Error("Node.js 24.x is required.");
}

export function readLock() {
  const lock = JSON.parse(fs.readFileSync(path.join(ROOT, "source-lock.json"), "utf8"));
  if (lock.schemaVersion !== 1 || !/^[0-9a-f]{40}$/.test(lock.upstreamCommit ?? "") ||
      !/^[0-9a-f]{40}$/.test(lock.localizationSourceCommit ?? "") || !/^[0-9a-f]{64}$/.test(lock.foundationSha256 ?? "") ||
      !/^v\d{4}\.\d{1,2}\.\d{1,2}\.\d+$/.test(lock.releaseTag ?? "")) {
    throw new Error("Invalid source-lock.json. Explicit reviewed revisions, release tag and foundation hash are required.");
  }
  return lock;
}

export function permitted(name) {
  const forbidden = ["package.json", "package-lock.json", "npm-shrinkwrap.json", "pnpm-lock.yaml", "yarn.lock", "bun.lock", "bun.lockb", "pnpm-workspace.yaml"];
  return /^[A-Za-z0-9_.@+/-]+$/.test(name) && !name.split("/").some((part) => ["", ".", "..", ".git"].includes(part.toLowerCase())) &&
    !forbidden.includes(path.posix.basename(name).toLowerCase()) &&
    ((name.startsWith("ui/")) ||
      ["scripts/locale-changes.mjs", "scripts/locale-changes.d.mts", "scripts/sync-locales.mjs"].includes(name));
}

export function createScratchCheckout(upstream, commit) {
  const resolved = git(upstream, ["rev-parse", "--verify", "--end-of-options", `${commit}^{commit}`]).toString().trim();
  if (resolved !== commit) throw new Error("Upstream commit did not resolve exactly.");
  const temporaryRoot = fs.realpathSync(os.tmpdir());
  for (const protectedRoot of [ROOT, fs.realpathSync(upstream)]) {
    if (temporaryRoot === protectedRoot || temporaryRoot.startsWith(protectedRoot + path.sep)) {
      throw new Error("Temporary build root must be outside the localization and upstream repositories.");
    }
  }
  const scratch = fs.mkdtempSync(path.join(temporaryRoot, "paperclip-localizations-"));
  try {
    const checkout = path.join(scratch, "checkout");
    // A new clone has no source checkout configuration, hooks or worktree state.
    git(ROOT, ["clone", "--shared", "--no-checkout", "--", upstream, checkout]);
    git(checkout, ["checkout", "--detach", commit]);
    // Some Git versions report success even when a missing blob leaves a file
    // absent. Never build from an incomplete or modified baseline.
    if (git(checkout, ["status", "--porcelain=v1", "--untracked-files=all"]).length) {
      throw new Error("Scratch checkout is incomplete or dirty; refusing to build.");
    }
    return { scratch, checkout };
  } catch (error) {
    fs.rmSync(scratch, { recursive: true, force: false });
    throw error;
  }
}

export function releaseFiles(directory = ROOT, relative = "") {
  const files = [];
  for (const entry of fs.readdirSync(directory, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name, "en"))) {
    if ([".git", "node_modules", "tmp", "coverage", ".DS_Store", "SHA256SUMS"].includes(entry.name) || /\.(?:zip|tgz|log)$/.test(entry.name)) continue;
    const name = relative ? `${relative}/${entry.name}` : entry.name;
    if (entry.isSymbolicLink()) throw new Error(`Release cannot contain symlinks: ${name}`);
    if (entry.isDirectory()) files.push(...releaseFiles(path.join(directory, entry.name), name));
    else if (entry.isFile()) files.push(name);
    else throw new Error(`Release cannot contain a special file: ${name}`);
  }
  return files;
}

export function checksumText() {
  return releaseFiles().sort().map((name) => `${hash(fs.readFileSync(path.join(ROOT, name)))}  ${name}\n`).join("");
}

export function verifyChecksums() {
  const expected = fs.readFileSync(path.join(ROOT, "SHA256SUMS"), "utf8");
  if (expected !== checksumText()) throw new Error("Release file hashes differ from SHA256SUMS; rebuild the reviewed release.");
}
