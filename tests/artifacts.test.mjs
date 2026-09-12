import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createScratchCheckout, git, hash, parseUpstreamArgument, permitted, releaseFiles } from "../scripts/artifacts.mjs";

function write(root, name, content) {
  const filename = path.join(root, name);
  fs.mkdirSync(path.dirname(filename), { recursive: true });
  fs.writeFileSync(filename, content);
}

function snapshot(root) {
  const entries = [];
  function walk(directory) {
    for (const name of fs.readdirSync(directory).sort()) {
      const filename = path.join(directory, name), stat = fs.lstatSync(filename);
      if (stat.isDirectory()) walk(filename);
      else entries.push([path.relative(root, filename), stat.mode & 0o777, stat.nlink,
        stat.isSymbolicLink() ? `link:${fs.readlinkSync(filename)}` : hash(fs.readFileSync(filename))]);
    }
  }
  walk(root);
  return entries;
}

function fixture(t) {
  const root = fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()), "artifact-safety-test-"));
  t.after(() => fs.rmSync(root, { recursive: true, force: false }));
  const upstream = path.join(root, "upstream");
  fs.mkdirSync(upstream);
  git(upstream, ["init", "--initial-branch=main"]);
  write(upstream, "ui/example.txt", "Synthetic base\n");
  write(upstream, ".gitattributes", "*.txt filter=synthetic\n");
  git(upstream, ["add", "--all"]);
  git(upstream, ["-c", "user.name=Synthetic Artifact Test", "-c", "user.email=test@example.invalid", "commit", "-m", "Synthetic base"]);
  const commit = git(upstream, ["rev-parse", "HEAD"]).toString().trim();
  return { root, upstream, commit };
}

function withTemporaryRoot(directory, callback) {
  const saved = Object.fromEntries(["TMPDIR", "TMP", "TEMP"].map((name) => [name, process.env[name]]));
  try {
    for (const name of Object.keys(saved)) process.env[name] = directory;
    return callback();
  } finally {
    for (const [name, value] of Object.entries(saved)) {
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    }
  }
}

test("artifact scope includes only UI and three exact locale scripts", () => {
  for (const name of ["ui/src/App.tsx", "ui/src/i18n/locales/ru.json", "scripts/locale-changes.mjs", "scripts/locale-changes.d.mts", "scripts/sync-locales.mjs"]) {
    assert.equal(permitted(name), true, name);
  }
  for (const name of ["server/main.ts", "scripts/locale-other.mjs", "scripts/nested/locale-changes.mjs", "package.json", "ui/package.json", "pnpm-lock.yaml", "ui/pnpm-lock.yaml", "ui/pnpm-workspace.yaml", "ui/yarn.lock", "ui/bun.lock", "ui/package-lock.json", "ui/../escape", "ui/.GIT/config", "ui//path", "/ui/path", "ui/a b", "ui/file:stream"]) {
    assert.equal(permitted(name), false, name);
  }
});

test("upstream arguments require an explicit absolute path and one optional check", (t) => {
  const f = fixture(t);
  assert.deepEqual(parseUpstreamArgument(["--upstream", f.upstream]), { upstream: f.upstream, check: false });
  assert.deepEqual(parseUpstreamArgument(["--upstream", f.upstream, "--check"]), { upstream: f.upstream, check: true });
  for (const args of [[], ["--upstream", "relative"], ["--upstream"], ["--upstream", f.upstream, "--check", "--check"], ["--upstream", f.upstream, "--force"]]) {
    assert.throws(() => parseUpstreamArgument(args), /Usage/);
  }
});

test("disposable clone checks out exact commit and leaves source files and Git metadata unchanged", (t) => {
  const f = fixture(t), before = snapshot(f.upstream);
  const { scratch, checkout } = createScratchCheckout(f.upstream, f.commit);
  try {
    assert.equal(git(checkout, ["rev-parse", "HEAD"]).toString().trim(), f.commit);
    assert.equal(git(checkout, ["status", "--porcelain=v1"]).length, 0);
    assert.deepEqual(snapshot(f.upstream), before);
    write(checkout, "ui/example.txt", "Change only scratch\n");
    assert.deepEqual(snapshot(f.upstream), before);
  } finally { fs.rmSync(scratch, { recursive: true, force: false }); }
});

test("disposable clone does not inherit source executable filters or hooks", (t) => {
  const f = fixture(t), marker = path.join(f.root, "helper-ran.txt");
  const script = path.join(f.root, "helper.mjs");
  write(f.root, "helper.mjs", `import fs from "node:fs"; fs.writeFileSync(${JSON.stringify(marker)}, "ran"); process.stdout.write(fs.readFileSync(0));`);
  const helper = `'${process.execPath.replaceAll("'", "'\\''")}' '${script.replaceAll("'", "'\\''")}'`;
  git(f.upstream, ["config", "filter.synthetic.clean", helper]);
  git(f.upstream, ["config", "filter.synthetic.smudge", helper]);
  write(f.upstream, ".git/hooks/post-checkout", `#!/bin/sh\n${helper}\n`);
  fs.chmodSync(path.join(f.upstream, ".git/hooks/post-checkout"), 0o755);
  const before = snapshot(f.upstream);
  const { scratch, checkout } = createScratchCheckout(f.upstream, f.commit);
  try {
    assert.equal(fs.existsSync(marker), false);
    assert.equal(fs.readFileSync(path.join(checkout, "ui/example.txt"), "utf8"), "Synthetic base\n");
    assert.deepEqual(snapshot(f.upstream), before);
  } finally { fs.rmSync(scratch, { recursive: true, force: false }); }
});

test("scratch creation rejects temporary directories inside the upstream checkout", (t) => {
  const f = fixture(t), nested = path.join(f.upstream, "nested-temp");
  fs.mkdirSync(nested);
  for (const directory of [f.upstream, nested]) {
    withTemporaryRoot(directory, () => {
      let created;
      try {
        assert.throws(() => { created = createScratchCheckout(f.upstream, f.commit); }, /outside|temporary/i);
      } finally { if (created) fs.rmSync(created.scratch, { recursive: true, force: false }); }
    });
  }
});

test("failed scratch checkout removes its own directory and preserves source state", (t) => {
  const f = fixture(t), temporary = path.join(f.root, "temporary");
  fs.mkdirSync(temporary);
  const blob = git(f.upstream, ["rev-parse", "HEAD:ui/example.txt"]).toString().trim();
  fs.unlinkSync(path.join(f.upstream, ".git", "objects", blob.slice(0, 2), blob.slice(2)));
  const before = snapshot(f.upstream);
  withTemporaryRoot(temporary, () => assert.throws(() => createScratchCheckout(f.upstream, f.commit), /failed|missing|unable|object|clean|incomplete/i));
  assert.deepEqual(fs.readdirSync(temporary), []);
  assert.deepEqual(snapshot(f.upstream), before);
});

test("a non-commit object cannot become an artifact checkout", (t) => {
  const f = fixture(t), before = snapshot(f.upstream);
  const tree = git(f.upstream, ["rev-parse", "HEAD^{tree}"]).toString().trim();
  assert.throws(() => createScratchCheckout(f.upstream, tree), /failed|commit/i);
  assert.deepEqual(snapshot(f.upstream), before);
});

test("release enumeration covers hidden source files and rejects symlinks", (t) => {
  const f = fixture(t), release = path.join(f.root, "release");
  write(release, "apply.mjs", "// synthetic installer\n");
  write(release, ".github/workflows/ci.yml", "name: Synthetic\n");
  write(release, "SHA256SUMS", "excluded generated checksum list\n");
  write(release, "tmp/build.txt", "excluded temporary output\n");
  assert.deepEqual(releaseFiles(release).sort(), [".github/workflows/ci.yml", "apply.mjs"]);
  fs.symlinkSync(path.join(release, "apply.mjs"), path.join(release, "linked.mjs"));
  assert.throws(() => releaseFiles(release), /symlink/i);
});
