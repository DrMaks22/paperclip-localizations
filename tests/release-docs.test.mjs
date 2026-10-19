import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { ROOT } from "../scripts/artifacts.mjs";
import { readChannels } from "../scripts/channels.mjs";

const read = (name) => fs.readFileSync(path.join(ROOT, name), "utf8");

test("both README agent tasks pin the indexed stable release and official base", () => {
  const stable = readChannels().stable;
  for (const name of ["README.md", "README.en.md"]) {
    const text = read(name);
    assert.ok(text.includes(stable.baseCommit), `${name}: exact base`);
    const tasks = [...text.matchAll(/```text\n([\s\S]*?)```/g)].map((match) => match[1]);
    assert.equal(tasks.length, 1, `${name}: one unambiguous default agent task`);
    assert.ok(tasks[0].includes(stable.upstreamRef), `${name}: official release`);
    assert.ok(tasks[0].includes(`/blob/${stable.releaseTag}/docs/AGENT-INSTALL.md`), `${name}: pinned instructions`);
    assert.ok(text.includes(`/releases/tag/${stable.releaseTag}`), `${name}: stable download`);
  }
});

test("manual installation in both languages clones the indexed immutable stable tag", () => {
  const stable = readChannels().stable;
  for (const name of ["docs/INSTALL.ru.md", "docs/INSTALL.en.md"]) {
    const text = read(name);
    const branches = [...text.matchAll(/^git clone --branch (\S+) --depth 1 https:\/\/github\.com\/DrMaks22\/paperclip-localizations\.git$/gm)].map((match) => match[1]);
    assert.deepEqual(branches, [stable.releaseTag], name);
    assert.ok(text.includes(stable.upstreamRef), `${name}: compatible official version`);
    assert.ok(text.includes("--reverse --check") && text.includes("--reverse --apply"), `${name}: reversible workflow`);
  }
});

test("stable verification links resolve to a report containing its exact release and base", () => {
  const stable = readChannels().stable;
  const report = `verification/${stable.releaseTag}.md`;
  const text = read(report);
  assert.ok(text.includes(stable.releaseTag));
  assert.ok(text.includes(stable.upstreamRef));
  assert.ok(text.includes(stable.baseCommit));
  for (const name of ["README.md", "README.en.md", "docs/INSTALL.ru.md", "docs/INSTALL.en.md", "docs/RELEASES.md"]) {
    assert.ok(read(name).includes(report), `${name}: current verification link`);
  }
});
