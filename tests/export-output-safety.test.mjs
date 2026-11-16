import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { writeFoundationOutputs } from "../scripts/export-foundation.mjs";
import { ROOT, git } from "../scripts/artifacts.mjs";

const outputs = ["locales/en.json", "locales/ru.json", "patches/foundation.patch", "source-lock.json"];
const payloads = ["new English\n", "новый русский\n", "new foundation\n", "new source lock\n"];
function fixture(t) {
  const root = fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()), "paperclip-export-output-test-"));
  t.after(() => fs.rmSync(root, { recursive: true, force: false }));
  const kit = path.join(root, "kit");
  fs.mkdirSync(kit);
  return { root, kit };
}
function put(filename, bytes) {
  fs.mkdirSync(path.dirname(filename), { recursive: true });
  fs.writeFileSync(filename, bytes);
}
function write(root) {
  return writeFoundationOutputs({ root, english: payloads[0], russian: payloads[1],
    patch: Buffer.from(payloads[2]), sourceLock: payloads[3] });
}
function snapshot(root) {
  const result = [];
  function visit(directory) {
    for (const name of fs.readdirSync(directory).sort()) {
      const filename = path.join(directory, name), stat = fs.lstatSync(filename);
      const relative = path.relative(root, filename);
      if (stat.isDirectory()) { result.push([relative, "directory", stat.mode]); visit(filename); }
      else result.push([relative, stat.mode, stat.nlink,
        stat.isSymbolicLink() ? `link:${fs.readlinkSync(filename)}` : fs.readFileSync(filename).toString("hex")]);
    }
  }
  visit(root);
  return result;
}

test("foundation exporter creates ordinary destinations and replaces complete existing outputs", async (t) => {
  const { kit } = fixture(t);
  await write(kit);
  for (const name of outputs) put(path.join(kit, name), "long old output that must be truncated\n");
  await write(kit);
  outputs.forEach((name, index) => assert.equal(fs.readFileSync(path.join(kit, name), "utf8"), payloads[index]));
});

for (const kind of ["symlink", "hardlink", "directory"]) {
  for (const name of outputs) {
    for (const existing of [false, true]) {
      test(`foundation exporter refuses ${kind} ${name} with ${existing ? "existing" : "missing"} other outputs before mutation`, async (t) => {
        const { root, kit } = fixture(t);
        const sentinel = path.join(root, "outside-sentinel.txt");
        put(sentinel, "preserve external bytes\n");
        if (existing) for (const output of outputs) if (output !== name) put(path.join(kit, output), "preserve old output\n");
        const unsafe = path.join(kit, name);
        fs.mkdirSync(path.dirname(unsafe), { recursive: true });
        if (kind === "symlink") fs.symlinkSync(sentinel, unsafe);
        else if (kind === "hardlink") fs.linkSync(sentinel, unsafe);
        else fs.mkdirSync(unsafe);
        const before = snapshot(root);
        await assert.rejects(write(kit), /Symlink|Hard-linked|regular file/);
        assert.equal(fs.readFileSync(sentinel, "utf8"), "preserve external bytes\n");
        assert.deepEqual(snapshot(root), before, "refusal must preserve external bytes and create or truncate no outputs");
      });
    }
  }
}

for (const parent of ["locales", "patches"]) {
  test(`foundation exporter refuses a symlinked ${parent} parent before any output mutation`, async (t) => {
    const { root, kit } = fixture(t);
    const outside = path.join(root, "outside");
    const leaf = parent === "locales" ? "en.json" : "foundation.patch";
    put(path.join(outside, leaf), "preserve external bytes\n");
    fs.symlinkSync(outside, path.join(kit, parent));
    for (const name of outputs) if (!name.startsWith(`${parent}/`)) put(path.join(kit, name), "preserve old output\n");
    const before = snapshot(root);
    await assert.rejects(write(kit), /Symlink/);
    assert.deepEqual(snapshot(root), before);
  });
}

test("foundation exporter refuses a symlinked root before creating output directories", async (t) => {
  const { root, kit } = fixture(t);
  const alias = path.join(root, "alias");
  fs.symlinkSync(kit, alias);
  const before = snapshot(root);
  await assert.rejects(write(alias), /Symlink/);
  assert.deepEqual(snapshot(root), before);
});

test("foundation export CLI refuses a linked final output without partially exporting a reviewed source", (t) => {
  const { root, kit } = fixture(t), source = path.join(root, "source");
  for (const directory of ["scripts", "runtime"]) fs.cpSync(path.join(ROOT, directory), path.join(kit, directory), { recursive: true });
  put(path.join(source, "ui/label.txt"), "Synthetic upstream\n");
  git(source, ["init", "--initial-branch=main"]);
  const commit = (message) => {
    git(source, ["add", "--all"]);
    git(source, ["-c", "user.name=Synthetic Export Test", "-c", "user.email=test@example.invalid", "commit", "-m", message]);
  };
  commit("Synthetic baseline");
  const base = git(source, ["rev-parse", "HEAD"]).toString().trim();
  put(path.join(source, "ui/src/i18n/locales/en.json"), '{"title":"Source"}\n');
  put(path.join(source, "ui/src/i18n/locales/ru.json"), '{"title":"Перевод"}\n');
  commit("Synthetic localization");
  const sentinel = path.join(root, "outside-source-lock.json");
  put(sentinel, "preserve external bytes\n");
  fs.linkSync(sentinel, path.join(kit, "source-lock.json"));
  const before = snapshot(root);
  const result = spawnSync(process.execPath, [path.join(kit, "scripts/export-foundation.mjs"),
    "--source", source, "--base", base, "--inherited", base,
    "--tag", "v2026.11.16.1-beta.1", "--channel", "beta", "--upstream-ref", "master", "--runtime-profile", "community-json"],
  { cwd: kit, encoding: "utf8", timeout: 120_000 });
  assert.equal(result.status, 1, result.stdout);
  assert.match(result.stderr, /Hard-linked/);
  assert.deepEqual(snapshot(root), before, "source metadata, external sentinel, and every output must stay unchanged");
});
