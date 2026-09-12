import fs from "node:fs";
import path from "node:path";
import { buildArtifact } from "./build.mjs";
import { ROOT, requireNode, readLock, parseUpstreamArgument, createScratchCheckout, git, command, hash, json, verifyChecksums } from "./artifacts.mjs";

function metadataSnapshot(directory, relative = "") {
  const rows = [];
  for (const name of fs.readdirSync(directory).sort()) {
    const filename = path.join(directory, name);
    const label = relative ? `${relative}/${name}` : name;
    const stat = fs.lstatSync(filename);
    if (stat.isDirectory()) {
      rows.push([label, "directory", stat.mode & 0o777]);
      rows.push(...metadataSnapshot(filename, label));
    } else if (stat.isFile()) rows.push([label, "file", stat.mode & 0o777, hash(fs.readFileSync(filename))]);
    else if (stat.isSymbolicLink()) rows.push([label, "symlink", fs.readlinkSync(filename)]);
    else throw new Error(`Unexpected Git metadata file type: ${label}`);
  }
  return rows;
}

try {
  requireNode();
  const { upstream } = parseUpstreamArgument();
  verifyChecksums();
  const reproducibility = await buildArtifact({ upstream, check: true });
  const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, "manifest.json"), "utf8"));
  const { scratch, checkout } = createScratchCheckout(upstream, readLock().upstreamCommit);
  try {
    const gitMetadata = () => hash(Buffer.from(json(metadataSnapshot(path.join(checkout, ".git")))));
    const before = gitMetadata();
    const run = (...args) => {
      const result = command(process.execPath, [path.join(ROOT, "apply.mjs"), "--repo", checkout, ...args], ROOT).toString().trim();
      if (before !== gitMetadata()) throw new Error(`Installer changed Git metadata during ${args.join(" ")}.`);
      return result;
    };
    const results = [run("--check"), run("--apply")];
    for (const [name, expected] of Object.entries(manifest.afterFiles)) {
      const filename = path.join(checkout, name);
      if (expected === null) { if (fs.existsSync(filename)) throw new Error(`Deleted path still exists: ${name}`); continue; }
      const stat = fs.lstatSync(filename);
      if (!stat.isFile() || hash(fs.readFileSync(filename)) !== expected.sha256 || (stat.mode & 0o111 ? "100755" : "100644") !== expected.mode) throw new Error(`Applied file differs from generated result: ${name}`);
    }
    results.push(run("--reverse", "--check"), run("--reverse", "--apply"));
    if (git(checkout, ["status", "--porcelain=v1", "--untracked-files=all"]).length) throw new Error("Reverse did not restore clean base.");
    if (before !== gitMetadata()) throw new Error("Installer changed Git metadata.");
    console.log(json({ ...reproducibility, roundTrip: "passed", metadataPreserved: true, steps: results }));
  } finally { fs.rmSync(scratch, { recursive: true, force: false }); }
} catch (error) { console.error(error.message); process.exitCode = 1; }
