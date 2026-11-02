import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { writeBuildOutputs } from "../scripts/build.mjs";

const outputs = ["paperclip-localizations.patch", "manifest.json", "SHA256SUMS"];
function fixture() {
  const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "paperclip-output-test-")));
  return { root, cleanup: () => fs.rmSync(root, { recursive: true, force: false }) };
}
function write(root) {
  return writeBuildOutputs({ root, patch: Buffer.from("new patch"), manifest: Buffer.from("new manifest"), checksums: () => {
    assert.equal(fs.readFileSync(path.join(root, outputs[0]), "utf8"), "new patch");
    assert.equal(fs.readFileSync(path.join(root, outputs[1]), "utf8"), "new manifest");
    return "new checksums";
  } });
}

test("builder creates and replaces ordinary outputs before calculating checksums", async () => {
  const { root, cleanup } = fixture();
  try {
    await write(root);
    await write(root);
    assert.equal(fs.readFileSync(path.join(root, "SHA256SUMS"), "utf8"), "new checksums");
  } finally { cleanup(); }
});

for (const kind of ["symlink", "hardlink", "directory"]) {
  for (const name of outputs) {
    test(`builder rejects ${kind} ${name} before changing any output`, async () => {
      const { root, cleanup } = fixture();
      try {
        const victim = path.join(root, "outside-output.txt");
        fs.writeFileSync(victim, "must remain intact");
        for (const output of outputs) if (output !== name) fs.writeFileSync(path.join(root, output), "old output");
        const unsafe = path.join(root, name);
        if (kind === "symlink") fs.symlinkSync(victim, unsafe);
        else if (kind === "hardlink") fs.linkSync(victim, unsafe);
        else fs.mkdirSync(unsafe);
        await assert.rejects(write(root), /Symlink|Hard-linked|regular file/);
        assert.equal(fs.readFileSync(victim, "utf8"), "must remain intact");
        for (const output of outputs) if (output !== name) assert.equal(fs.readFileSync(path.join(root, output), "utf8"), "old output");
      } finally { cleanup(); }
    });
  }
}

test("builder rejects a symlinked output directory", async () => {
  const { root, cleanup } = fixture();
  try {
    const target = path.join(root, "real"); fs.mkdirSync(target);
    const alias = path.join(root, "alias"); fs.symlinkSync(target, alias);
    await assert.rejects(write(alias), /Symlink/);
    assert.deepEqual(fs.readdirSync(target), []);
  } finally { cleanup(); }
});
