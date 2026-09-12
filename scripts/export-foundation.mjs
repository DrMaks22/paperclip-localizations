// Maintainer-only export of a reviewed, committed localization integration.
import fs from "node:fs";
import path from "node:path";
import { ROOT, requireNode, git, hash, json, permitted } from "./artifacts.mjs";

try {
  requireNode();
  const args = process.argv.slice(2);
  if (args.length !== 8 || args[0] !== "--source" || args[2] !== "--base" || args[4] !== "--inherited" || args[6] !== "--tag" || !path.isAbsolute(args[1]) ||
      !/^[0-9a-f]{40}$/.test(args[3]) || !/^[0-9a-f]{40}$/.test(args[5]) || !/^v\d{4}\.\d{1,2}\.\d{1,2}\.\d+$/.test(args[7])) {
    throw new Error("Usage: node scripts/export-foundation.mjs --source /absolute/reviewed-integration --base UPSTREAM_SHA --inherited PUBLIC_LOCALIZATION_SHA --tag vYYYY.M.D.N");
  }
  const source = fs.realpathSync(args[1]);
  const base = args[3];
  const inherited = args[5];
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
  for (const locale of ["en", "ru"]) {
    const bytes = git(source, ["show", `${head}:ui/src/i18n/locales/${locale}.json`]);
    JSON.parse(bytes.toString("utf8"));
    fs.writeFileSync(path.join(ROOT, "locales", `${locale}.json`), bytes);
  }
  fs.mkdirSync(path.join(ROOT, "patches"), { recursive: true });
  fs.writeFileSync(path.join(ROOT, "patches", "foundation.patch"), patch);
  const lock = {
    schemaVersion: 1, releaseTag: args[7], upstreamRepository: "https://github.com/paperclipai/paperclip",
    upstreamCommit: base, localizationSourceRepository: "https://github.com/DrMaks22/paperclip",
    localizationSourceCommit: inherited, integrationCommit: head,
    integrationTree: git(source, ["rev-parse", `${head}^{tree}`]).toString().trim(),
    foundationSha256: hash(patch), foundationFiles: paths.length,
    provenance: "The inherited localization commit is public; the integration commit is a local provenance identifier. The complete integration is distributable and reproducible from the public pinned upstream revision and patches/foundation.patch; no local commit object is required to build.",
  };
  fs.writeFileSync(path.join(ROOT, "source-lock.json"), json(lock));
  console.log(json(lock));
} catch (error) { console.error(error.message); process.exitCode = 1; }
