import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { ROOT, git, hash, validateSourceLock } from "../scripts/artifacts.mjs";
import { validateReleaseChannel } from "../scripts/release-channel.mjs";
import { parseExportArguments } from "../scripts/export-foundation.mjs";
import { preparePinnedLocales } from "../scripts/build.mjs";

const stable = { releaseChannel: "stable", releaseTag: "v2026.9.13.1", upstreamRef: "v2026.831.1", runtimeProfile: "pinned-en-ru" };
const beta = { releaseChannel: "beta", releaseTag: "v2026.9.13.1-beta.1", upstreamRef: "master", runtimeProfile: "community-json" };
const objectId = "a".repeat(40);
const lock = {
  schemaVersion: 1, ...stable, upstreamRepository: "https://github.com/paperclipai/paperclip", upstreamCommit: objectId,
  localizationSourceRepository: "https://github.com/DrMaks22/paperclip", localizationSourceCommit: "b".repeat(40),
  integrationCommit: "c".repeat(40), integrationTree: "d".repeat(40), foundationSha256: "e".repeat(64),
  foundationFiles: 3, provenance: "Synthetic reviewed integration.",
};

function write(root, relative, bytes) {
  const filename = path.join(root, relative);
  fs.mkdirSync(path.dirname(filename), { recursive: true });
  fs.writeFileSync(filename, bytes);
}

function temporary(t) {
  const root = fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()), "release-channel-test-"));
  t.after(() => fs.rmSync(root, { recursive: true, force: false }));
  return root;
}

function snapshot(root) {
  const rows = [];
  function walk(directory) {
    for (const name of fs.readdirSync(directory).sort()) {
      const filename = path.join(directory, name), stat = fs.lstatSync(filename);
      const relative = path.relative(root, filename);
      if (stat.isDirectory()) { rows.push([relative, "directory", stat.mode]); walk(filename); }
      else rows.push([relative, stat.mode, stat.nlink, stat.isSymbolicLink() ? `link:${fs.readlinkSync(filename)}` : hash(fs.readFileSync(filename))]);
    }
  }
  walk(root);
  return rows;
}

function options(metadata = stable, source = "/synthetic/reviewed-integration") {
  return ["--source", source, "--base", objectId, "--inherited", "b".repeat(40), "--tag", metadata.releaseTag,
    "--channel", metadata.releaseChannel, "--upstream-ref", metadata.upstreamRef, "--runtime-profile", metadata.runtimeProfile];
}

function fixture(t) {
  const root = temporary(t), target = path.join(root, "checkout");
  write(root, "locales/en.json", '{ "title" : "Source {{name}}" }\n');
  write(root, "locales/ru.json", '{"title":"Перевод {{name}}"}\n\n');
  write(target, "ui/src/i18n/locales/en.json", '{"title":"Historical source {{name}}"}\n');
  write(target, "ui/src/i18n/locales/ru.json", '{"title":"Исходный перевод {{name}}"}\n');
  write(target, "ui/src/i18n/locales/fr.json", '{"draft":"Unreviewed scaffold"}\n');
  write(target, "ui/src/i18n/locales.ts", "// Preserve the historical committed registry.\n");
  write(target, "ui/src/i18n/index.ts", "// Preserve the historical committed runtime.\n");
  write(target, "unrelated.txt", "Unchanged synthetic file.\n");
  return { root, target };
}

test("release identity accepts stable and beta with either explicit runtime profile", () => {
  for (const metadata of [stable, beta]) {
    for (const runtimeProfile of ["pinned-en-ru", "community-json"]) {
      const candidate = { ...metadata, runtimeProfile, baseCommit: objectId };
      assert.equal(validateReleaseChannel(candidate), candidate);
    }
  }
  assert.doesNotThrow(() => validateReleaseChannel({ ...stable, releaseTag: "v2024.2.29.2", upstreamRef: "v2027.105.0" }));
});

test("release identity rejects channel/tag/ref mismatches and unknown profiles", () => {
  for (const candidate of [
    { ...stable, releaseTag: beta.releaseTag }, { ...beta, releaseTag: stable.releaseTag },
    { ...stable, upstreamRef: "master" }, { ...beta, upstreamRef: stable.upstreamRef },
    { ...stable, releaseChannel: "latest" }, { ...stable, runtimeProfile: "automatic" },
  ]) assert.throws(() => validateReleaseChannel(candidate));
  for (const upstreamRef of ["main", "HEAD", "refs/tags/v2026.831.1", "v2026.831.1-beta.1", "--help", "../master", "v2026.831.1\n", "v2026.0831.1"]) {
    assert.throws(() => validateReleaseChannel({ ...stable, upstreamRef }), undefined, upstreamRef);
  }
});

test("release identity requires own string fields without coercion", () => {
  for (const candidate of [null, [], "stable", true, 1, undefined, Object.create(stable)]) {
    assert.throws(() => validateReleaseChannel(candidate));
  }
  for (const field of Object.keys(stable)) {
    const missing = { ...stable };
    delete missing[field];
    assert.throws(() => validateReleaseChannel(missing), undefined, field);
    for (const value of [null, undefined, true, 1, [stable[field]], { toString: () => stable[field] }]) {
      assert.throws(() => validateReleaseChannel({ ...stable, [field]: value }), undefined, field);
    }
  }
});

test("release tags reject malformed dates, counters, unsafe suffixes and trailing newlines", () => {
  for (const releaseTag of ["v2026.2.29.1", "v2026.4.31.1", "v2026.13.1.1", "v2026.0.1.1", "v2026.9.0.1", "v0000.1.1.1",
    "v2026.09.13.1", "v2026.9.13.0", "v2026.9.13.01", "v2026.9.13.9007199254740992", "v2026.9.13.1\n",
    "v2026.9.13.1-rc.1", "v2026.9.13.1+build", "v2026.9.13.1;echo unsafe", "v2026.9.13.1-beta.0", "v2026.9.13.1-beta.01"]) {
    assert.throws(() => validateReleaseChannel({ ...stable, releaseTag }), undefined, releaseTag);
  }
});

test("source locks require channel metadata and strict reviewed metadata types", () => {
  assert.equal(validateSourceLock(lock), lock);
  assert.doesNotThrow(() => validateSourceLock({ ...lock, ...beta }));
  for (const field of Object.keys(lock)) {
    const missing = { ...lock };
    delete missing[field];
    assert.throws(() => validateSourceLock(missing), undefined, field);
  }
  for (const field of ["upstreamCommit", "localizationSourceCommit", "integrationCommit", "integrationTree", "foundationSha256"]) {
    for (const value of [[lock[field]], lock[field].toUpperCase(), lock[field] + "\n", true, null]) {
      assert.throws(() => validateSourceLock({ ...lock, [field]: value }), undefined, field);
    }
  }
  for (const candidate of [{ schemaVersion: "1" }, { foundationFiles: "3" }, { foundationFiles: 0 }, { foundationFiles: 1.5 },
    { foundationFiles: Infinity }, { provenance: "" }, { provenance: "unsafe\0provenance" },
    { upstreamRepository: "https://example.invalid/paperclip" }, { localizationSourceRepository: [lock.localizationSourceRepository] }]) {
    assert.throws(() => validateSourceLock({ ...lock, ...candidate }));
  }
});

test("foundation export requires all seven options explicitly and accepts either order", () => {
  for (const metadata of [stable, beta]) {
    const args = options(metadata);
    const expected = { source: args[1], base: objectId, inherited: "b".repeat(40), ...metadata };
    assert.deepEqual(parseExportArguments(args), expected);
    assert.deepEqual(parseExportArguments(Array.from({ length: args.length / 2 }, (_, index) => args.slice(index * 2, index * 2 + 2)).reverse().flat()), expected);
    for (let index = 0; index < args.length; index += 2) {
      assert.throws(() => parseExportArguments([...args.slice(0, index), ...args.slice(index + 2)]), /Usage/);
    }
  }
});

test("foundation export rejects implicit channels, duplicates, unsafe values and mismatches", () => {
  const args = options();
  for (const candidate of [[], args.slice(0, 8), [...args, "--force"], [...args, "--channel", "stable"],
    ["--unknown", ...args.slice(1)], ["--tag", ...args.slice(1)], options(stable, "relative"),
    options(stable, "/unsafe\0path"), options({ ...stable, releaseChannel: "beta" }),
    options({ ...stable, upstreamRef: "master" }), options({ ...stable, runtimeProfile: "auto" }),
    args.map((arg, index) => index === 3 ? "HEAD" : arg), args.map((arg, index) => index === 5 ? [arg] : arg)]) {
    assert.throws(() => parseExportArguments(candidate));
  }
});

test("pinned profile copies exact en/ru catalog bytes and preserves the committed runtime and scaffolds", async (t) => {
  const { root, target } = fixture(t), before = snapshot(target);
  const paths = ["ui/src/i18n/locales/en.json", "ui/src/i18n/locales/ru.json"];
  const result = await preparePinnedLocales({ root, target });
  assert.deepEqual(result, { locales: ["en", "ru"], paths });
  for (const locale of result.locales) {
    assert.deepEqual(fs.readFileSync(path.join(target, `ui/src/i18n/locales/${locale}.json`)), fs.readFileSync(path.join(root, `locales/${locale}.json`)));
  }
  assert.deepEqual(snapshot(target).filter(([name]) => !paths.includes(name)), before.filter(([name]) => !paths.includes(name)));
  assert.equal(fs.existsSync(path.join(target, "ui/src/i18n/community-locales.test.tsx")), false);
});

test("pinned profile refuses missing, extra, or invalid canonical catalogs before mutation", async (t) => {
  for (const change of [
    ({ root }) => fs.unlinkSync(path.join(root, "locales/ru.json")),
    ({ root }) => write(root, "locales/de.json", '{"title":"Quelle {{name}}"}\n'),
    ({ root }) => write(root, "locales/ru.json", '{"title":"Missing placeholder"}\n'),
  ]) {
    const f = fixture(t);
    change(f);
    const before = snapshot(f.root);
    await assert.rejects(preparePinnedLocales(f));
    assert.deepEqual(snapshot(f.root), before);
  }
});

test("pinned profile preflights both existing targets and ancestors without incidental writes", async (t) => {
  for (const kind of ["missing", "directory", "symlink", "hardlink", "ancestor-symlink"]) {
    const f = fixture(t), destination = path.join(f.target, "ui/src/i18n/locales/ru.json");
    const outside = path.join(f.root, "outside.json");
    write(f.root, "outside.json", '{"title":"Untouched outside file"}\n');
    if (kind === "ancestor-symlink") {
      const directory = path.dirname(destination), moved = path.join(f.root, "moved-locales");
      fs.renameSync(directory, moved);
      fs.symlinkSync(moved, directory);
    } else {
      fs.unlinkSync(destination);
      if (kind === "directory") fs.mkdirSync(destination);
      else if (kind === "symlink") fs.symlinkSync(outside, destination);
      else if (kind === "hardlink") fs.linkSync(outside, destination);
    }
    const before = snapshot(f.root);
    await assert.rejects(preparePinnedLocales(f), undefined, kind);
    assert.deepEqual(snapshot(f.root), before, kind);
  }
});

test("pinned profile rejects unsafe checkout and source roots without writing", async (t) => {
  const f = fixture(t), alias = path.join(f.root, "target-alias");
  fs.symlinkSync(f.target, alias);
  const before = snapshot(f.root);
  for (const target of [f.root, path.parse(f.root).root, "relative", alias, null, [f.target]]) {
    await assert.rejects(preparePinnedLocales({ root: f.root, target }));
  }
  await assert.rejects(preparePinnedLocales({ target: f.target, root: "relative" }));
  assert.deepEqual(snapshot(f.root), before);
});

function releaseFixture(t) {
  const root = temporary(t), kit = path.join(root, "kit"), source = path.join(root, "source");
  for (const directory of ["scripts", "runtime"]) fs.cpSync(path.join(ROOT, directory), path.join(kit, directory), { recursive: true });
  fs.mkdirSync(path.join(kit, "locales"));
  fs.mkdirSync(source);
  git(source, ["init", "--initial-branch=main"]);
  write(source, "ui/synthetic.ts", "// Synthetic upstream baseline.\n");
  git(source, ["add", "--all"]);
  const commit = (message) => git(source, ["-c", "user.name=Synthetic Release Test", "-c", "user.email=test@example.invalid", "commit", "-m", message]);
  commit("Synthetic upstream");
  const base = git(source, ["rev-parse", "HEAD"]).toString().trim();
  write(source, "ui/src/i18n/locales/en.json", '{"title":"Source"}\n');
  write(source, "ui/src/i18n/locales/ru.json", '{"title":"Перевод"}\n');
  write(source, "ui/src/i18n/locales.ts", "// Preserved historical registry.\n");
  git(source, ["add", "--all"]);
  commit("Synthetic historical localization");
  return { root, kit, source, base };
}

function cli(kit, script, args) {
  return spawnSync(process.execPath, [path.join(kit, "scripts", script), ...args], { cwd: kit, encoding: "utf8", timeout: 120_000 });
}

test("export CLI rejects a missing channel before reading source or changing release files", (t) => {
  const f = releaseFixture(t), before = snapshot(f.kit);
  const result = cli(f.kit, "export-foundation.mjs", options(stable, path.join(f.root, "nonexistent")).slice(0, 8));
  assert.equal(result.status, 1);
  assert.match(result.stderr, /Usage:.*--channel/);
  assert.doesNotMatch(result.stderr, /ENOENT/);
  assert.deepEqual(snapshot(f.kit), before);
});

test("export and build CLIs carry channel identity into reproducible manifests while preserving pinned runtime", (t) => {
  for (const metadata of [stable, { ...beta, runtimeProfile: "pinned-en-ru" }]) {
    const f = releaseFixture(t), sourceBefore = snapshot(f.source);
    const args = options(metadata, f.source).map((arg, index) => index === 3 || index === 5 ? f.base : arg);
    let result = cli(f.kit, "export-foundation.mjs", args);
    assert.equal(result.status, 0, result.stderr);
    const exported = JSON.parse(fs.readFileSync(path.join(f.kit, "source-lock.json"), "utf8"));
    for (const [field, value] of Object.entries(metadata)) assert.equal(exported[field], value);
    write(f.kit, "locales/ru.json", '{ "title" : "Проверенный перевод" }\n');
    result = cli(f.kit, "build.mjs", ["--upstream", f.source]);
    assert.equal(result.status, 0, result.stderr);
    const manifest = JSON.parse(fs.readFileSync(path.join(f.kit, "manifest.json"), "utf8"));
    assert.equal(manifest.kitVersion, metadata.releaseTag);
    for (const field of ["releaseChannel", "upstreamRef", "runtimeProfile"]) assert.equal(manifest[field], metadata[field]);
    assert.equal(manifest.baseCommit, f.base);
    assert.deepEqual(manifest.allowedPaths, ["ui/src/i18n/locales.ts", "ui/src/i18n/locales/en.json", "ui/src/i18n/locales/ru.json"]);
    assert.equal(manifest.afterFiles["ui/src/i18n/locales.ts"].sha256, hash(fs.readFileSync(path.join(f.source, "ui/src/i18n/locales.ts"))));
    assert.equal(manifest.afterFiles["ui/src/i18n/locales/ru.json"].sha256, hash(fs.readFileSync(path.join(f.kit, "locales/ru.json"))));
    const kitBefore = snapshot(f.kit);
    result = cli(f.kit, "build.mjs", ["--upstream", f.source, "--check"]);
    assert.equal(result.status, 0, result.stderr);
    assert.deepEqual(snapshot(f.kit), kitBefore);
    assert.deepEqual(snapshot(f.source), sourceBefore);
  }
});

test("community profile retains its overlay preflight and refuses incompatible historical sources", (t) => {
  const f = releaseFixture(t);
  const args = options(beta, f.source).map((arg, index) => index === 3 || index === 5 ? f.base : arg);
  let result = cli(f.kit, "export-foundation.mjs", args);
  assert.equal(result.status, 0, result.stderr);
  const before = snapshot(f.kit);
  result = cli(f.kit, "build.mjs", ["--upstream", f.source]);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /source differs/);
  assert.deepEqual(snapshot(f.kit), before);
});
