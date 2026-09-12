import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadCatalogs } from "./catalogs.mjs";
import { prepareLocales } from "./prepare-locales.mjs";
import { ROOT, requireNode, readLock, parseUpstreamArgument, createScratchCheckout, git, hash, json, permitted, checksumText } from "./artifacts.mjs";

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
    await prepareLocales({ target: checkout, root: ROOT });
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
