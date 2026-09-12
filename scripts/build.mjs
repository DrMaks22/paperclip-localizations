import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { assertSafePath, loadCatalogs } from "./catalogs.mjs";
import { prepareLocales } from "./prepare-locales.mjs";
import { ROOT, requireNode, readLock, parseUpstreamArgument, createScratchCheckout, git, hash, json, permitted, checksumText } from "./artifacts.mjs";

/** Preserve the committed two-language runtime; replace only its catalog bytes. */
export async function preparePinnedLocales({ target, root = ROOT }) {
  if (typeof target !== "string" || !path.isAbsolute(target) || typeof root !== "string" || !path.isAbsolute(root)) {
    throw new Error("Pinned locale paths must be absolute.");
  }
  target = path.resolve(target);
  root = path.resolve(root);
  if (target === root || target === path.parse(target).root || root.startsWith(target + path.sep)) {
    throw new Error("Target must be a separate disposable checkout.");
  }
  await assertSafePath(target, { directory: true });
  const catalogs = await loadCatalogs(root);
  if (catalogs.length !== 2 || catalogs[0].locale !== "en" || catalogs[1].locale !== "ru") {
    throw new Error("The pinned-en-ru runtimeProfile requires exactly the en and ru catalogs.");
  }
  const writes = [];
  for (const { locale } of catalogs) {
    const relative = `ui/src/i18n/locales/${locale}.json`;
    const destination = path.join(target, relative);
    await assertSafePath(destination, { writable: true });
    const stat = fs.lstatSync(destination);
    writes.push({ relative, destination, stat, bytes: fs.readFileSync(path.join(root, "locales", `${locale}.json`)) });
  }
  const opened = [];
  try {
    // Open every existing file without truncation, then verify its identity before
    // any write. No directories, runtime overlays, tests, or new files are created.
    for (const entry of writes) {
      const fd = fs.openSync(entry.destination, fs.constants.O_WRONLY | fs.constants.O_NOFOLLOW);
      opened.push({ ...entry, fd });
      const stat = fs.fstatSync(fd);
      if (!stat.isFile() || stat.nlink !== 1 || stat.dev !== entry.stat.dev || stat.ino !== entry.stat.ino) {
        throw new Error(`Unsafe pinned locale target: ${entry.relative}`);
      }
    }
    for (const { fd, bytes } of opened) {
      fs.ftruncateSync(fd, 0);
      fs.writeFileSync(fd, bytes);
    }
  } finally {
    for (const { fd } of opened) fs.closeSync(fd);
  }
  return { locales: catalogs.map(({ locale }) => locale), paths: writes.map(({ relative }) => relative) };
}

export async function buildArtifact({ upstream, check = false }) {
  requireNode();
  const lock = readLock();
  const foundationFile = path.join(ROOT, "patches", "foundation.patch");
  const foundation = fs.readFileSync(foundationFile);
  if (hash(foundation) !== lock.foundationSha256) throw new Error("Foundation patch SHA-256 mismatch.");
  const catalogs = await loadCatalogs(ROOT);
  const { scratch, checkout } = createScratchCheckout(upstream, lock.upstreamCommit);
  try {
    const foundationPaths = git(checkout, ["apply", "--numstat", "-z", foundationFile]).toString().split("\0").filter(Boolean).map((line) => {
      const match = /^\d+\t\d+\t(.+)$/.exec(line);
      if (!match || !permitted(match[1])) throw new Error("Foundation contains a binary, rename, or out-of-scope path.");
      return match[1];
    });
    if (new Set(foundationPaths).size !== foundationPaths.length || !foundationPaths.length) throw new Error("Invalid foundation path list.");
    git(checkout, ["apply", "--check", "--whitespace=nowarn", foundationFile]);
    git(checkout, ["apply", "--whitespace=nowarn", foundationFile]);
    if (lock.runtimeProfile === "pinned-en-ru") await preparePinnedLocales({ target: checkout, root: ROOT });
    else await prepareLocales({ target: checkout, root: ROOT });
    git(checkout, ["add", "--all"]);
    const paths = git(checkout, ["diff", "--cached", "--no-renames", "--name-only", "-z", lock.upstreamCommit]).toString().split("\0").filter(Boolean);
    if (!paths.length || paths.some((name) => !permitted(name))) throw new Error("Generated diff escaped localization scope.");
    git(checkout, ["diff", "--cached", "--check", lock.upstreamCommit]);
    const patch = git(checkout, ["diff", "--cached", "--text", "--full-index", "--no-renames", "--no-ext-diff", "--no-textconv", "--src-prefix=a/", "--dst-prefix=b/", lock.upstreamCommit, "--"]);
    new TextDecoder("utf-8", { fatal: true }).decode(patch);
    if (patch.includes(0)) throw new Error("A text localization patch cannot contain NUL bytes.");
    const afterFiles = Object.fromEntries(paths.map((name) => {
      const filename = path.join(checkout, name);
      if (!fs.existsSync(filename)) return [name, null];
      const stat = fs.lstatSync(filename);
      if (!stat.isFile() || stat.nlink !== 1) throw new Error(`Unsafe generated path: ${name}`);
      return [name, { sha256: hash(fs.readFileSync(filename)), mode: stat.mode & 0o111 ? "100755" : "100644" }];
    }));
    const count = (value) => typeof value === "string" ? 1 : Object.values(value).reduce((n, child) => n + count(child), 0);
    const manifest = {
      schemaVersion: 1, ready: true, kitVersion: lock.releaseTag,
      releaseChannel: lock.releaseChannel, upstreamRef: lock.upstreamRef, runtimeProfile: lock.runtimeProfile,
      baseCommit: lock.upstreamCommit, sourceCommit: lock.localizationSourceCommit,
      patchFile: "paperclip-localizations.patch", patchSha256: hash(patch),
      allowedPaths: paths, afterFiles,
      resultTree: git(checkout, ["write-tree"]).toString().trim(),
      sourceLockSha256: hash(fs.readFileSync(path.join(ROOT, "source-lock.json"))),
      foundationSha256: lock.foundationSha256,
      locales: catalogs.map(({ locale, messages }) => ({ locale, strings: count(messages), sha256: hash(fs.readFileSync(path.join(ROOT, "locales", `${locale}.json`))) })),
      upstreamRepository: "https://github.com/paperclipai/paperclip",
      localizationRepository: "https://github.com/DrMaks22/paperclip-localizations",
      pullRequest: "https://github.com/paperclipai/paperclip/pull/12989",
      requirements: { node: "24.x", cleanGitCheckout: true, exactBaseCommit: true, rebuildAfterApply: true },
      note: "Independent community source patch. ready means the artifact is finalized, not universal compatibility or linguistic certification. See verification/ for actual checks. No dependencies, database, deployment, or runtime provider content are modified by the installer.",
    };
    const output = [["paperclip-localizations.patch", patch], ["manifest.json", Buffer.from(json(manifest))]];
    for (const [name, bytes] of output) {
      const filename = path.join(ROOT, name);
      if (check) {
        if (!fs.readFileSync(filename).equals(bytes)) throw new Error(`${name} is not reproducible from current source-lock, foundation, runtime, and catalogs.`);
      } else fs.writeFileSync(filename, bytes);
    }
    if (!check) fs.writeFileSync(path.join(ROOT, "SHA256SUMS"), checksumText());
    return { baseCommit: lock.upstreamCommit, files: paths.length, patchSha256: manifest.patchSha256, locales: manifest.locales.map(({ locale, strings }) => ({ locale, strings })), reproducible: check };
  } finally {
    fs.rmSync(scratch, { recursive: true, force: false });
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { console.log(json(await buildArtifact(parseUpstreamArgument()))); }
  catch (error) { console.error(error.message); process.exitCode = 1; }
}
