// Maintainer-only export of a reviewed, committed localization integration.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { ROOT, requireNode, git, hash, json, permitted, validateSourceLock } from "./artifacts.mjs";
import { validateReleaseChannel } from "./release-channel.mjs";
import { assertSafePath } from "./catalogs.mjs";

/** Preflight every fixed destination before creating directories or outputs. */
export async function writeFoundationOutputs({ root = ROOT, english, russian, patch, sourceLock }) {
  await assertSafePath(root, { directory: true });
  const entries = [["locales/en.json", english], ["locales/ru.json", russian],
    ["patches/foundation.patch", patch], ["source-lock.json", sourceLock]];
  const targets = [];
  for (const [name, bytes] of entries) {
    const filename = path.join(root, name);
    await assertSafePath(filename, { allowMissing: true, writable: true });
    let stat;
    try { stat = fs.lstatSync(filename); }
    catch (error) { if (error.code !== "ENOENT") throw error; }
    targets.push({ filename, name, bytes, stat });
  }
  const opened = [];
  try {
    for (const target of targets) {
      fs.mkdirSync(path.dirname(target.filename), { recursive: true });
      const flags = fs.constants.O_WRONLY | fs.constants.O_NOFOLLOW
        | (target.stat ? 0 : fs.constants.O_CREAT | fs.constants.O_EXCL);
      const fd = fs.openSync(target.filename, flags, 0o644);
      opened.push({ ...target, fd });
      const stat = fs.fstatSync(fd);
      if (!stat.isFile() || stat.nlink !== 1
        || (target.stat && (stat.dev !== target.stat.dev || stat.ino !== target.stat.ino))) {
        throw new Error(`Unsafe foundation output: ${target.name}`);
      }
    }
    // Recheck all opened identities before the first truncation. Like the
    // builder, this maintainer helper requires an idle, disposable checkout.
    for (const target of opened) {
      await assertSafePath(target.filename, { writable: true });
      const stat = fs.fstatSync(target.fd);
      const current = fs.lstatSync(target.filename);
      if (!current.isFile() || stat.nlink !== 1 || current.dev !== stat.dev || current.ino !== stat.ino) {
        throw new Error(`Foundation output changed during export: ${target.name}`);
      }
    }
    for (const { fd, bytes } of opened) {
      fs.ftruncateSync(fd, 0);
      fs.writeFileSync(fd, bytes);
    }
  } finally {
    for (const { fd } of opened) fs.closeSync(fd);
  }
}

export function parseExportArguments(args = process.argv.slice(2)) {
  const usage = "Usage: node scripts/export-foundation.mjs --source /absolute/reviewed-integration --base UPSTREAM_SHA --inherited PUBLIC_LOCALIZATION_SHA --tag vYYYY.M.D.N[-beta.N] --channel stable|beta --upstream-ref OFFICIAL_VERSION_TAG|master --runtime-profile pinned-en-ru|community-json";
  const fields = new Map([["--source", "source"], ["--base", "base"], ["--inherited", "inherited"], ["--tag", "releaseTag"],
    ["--channel", "releaseChannel"], ["--upstream-ref", "upstreamRef"], ["--runtime-profile", "runtimeProfile"]]);
  if (!Array.isArray(args) || args.length !== fields.size * 2 || args.some((arg) => typeof arg !== "string" || !arg || /[\u0000-\u001f\u007f]/.test(arg))) {
    throw new Error(usage);
  }
  const options = {};
  for (let index = 0; index < args.length; index += 2) {
    const field = fields.get(args[index]);
    if (!field || Object.hasOwn(options, field)) throw new Error(usage);
    options[field] = args[index + 1];
  }
  if (!path.isAbsolute(options.source) || ![options.base, options.inherited].every((value) => value.length === 40 && /^[0-9a-f]+$/.test(value))) {
    throw new Error(usage);
  }
  validateReleaseChannel(options);
  return options;
}

export async function exportFoundation(args = process.argv.slice(2)) {
  requireNode();
  const options = parseExportArguments(args);
  const { base, inherited, releaseTag, releaseChannel, upstreamRef, runtimeProfile } = options;
  const source = fs.realpathSync(options.source);
  if (git(source, ["status", "--porcelain=v1", "--untracked-files=all"]).length) throw new Error("Integration source must be clean and committed.");
  const head = git(source, ["rev-parse", "HEAD"]).toString().trim();
  git(source, ["merge-base", "--is-ancestor", base, head]);
  git(source, ["merge-base", "--is-ancestor", inherited, head]);
  const paths = git(source, ["diff", "--no-renames", "--name-only", "-z", base, head]).toString().split("\0").filter(Boolean);
  if (!paths.length || paths.some((name) => !permitted(name))) throw new Error("Integration changes files outside localization scope; do not export it.");
  git(source, ["diff", "--check", base, head]);
  const patch = git(source, ["diff", "--text", "--full-index", "--no-renames", "--no-ext-diff", "--no-textconv", "--src-prefix=a/", "--dst-prefix=b/", base, head, "--"]);
  new TextDecoder("utf-8", { fatal: true }).decode(patch);
  if (patch.includes(0)) throw new Error("Foundation must be a text-only patch.");
  const catalogs = ["en", "ru"].map((locale) => {
    const bytes = git(source, ["show", `${head}:ui/src/i18n/locales/${locale}.json`]);
    JSON.parse(bytes.toString("utf8"));
    return { locale, bytes };
  });
  const lock = validateSourceLock({
    schemaVersion: 1, releaseTag, releaseChannel, upstreamRef, runtimeProfile,
    upstreamRepository: "https://github.com/paperclipai/paperclip",
    upstreamCommit: base, localizationSourceRepository: "https://github.com/DrMaks22/paperclip",
    localizationSourceCommit: inherited, integrationCommit: head,
    integrationTree: git(source, ["rev-parse", `${head}^{tree}`]).toString().trim(),
    foundationSha256: hash(patch), foundationFiles: paths.length,
    provenance: "The inherited localization commit is public; the integration commit is a local provenance identifier. The complete integration is distributable and reproducible from the public pinned upstream revision and patches/foundation.patch; no local commit object is required to build.",
  });
  await writeFoundationOutputs({ english: catalogs[0].bytes, russian: catalogs[1].bytes, patch, sourceLock: json(lock) });
  return lock;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { console.log(json(await exportFoundation())); }
  catch (error) { console.error(error.message); process.exitCode = 1; }
}
