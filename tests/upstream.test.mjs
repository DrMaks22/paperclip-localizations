import { test } from "node:test";
import assert from "node:assert/strict";
import { summarizeComparison, checkUpstream } from "../scripts/check-upstream.mjs";
const base = "a".repeat(40);
const head = "b".repeat(40);

test("unchanged snapshot requires no action", () => {
  assert.equal(summarizeComparison(base, base, { status: "identical", files: [] }).action, "none");
});
test("every changed snapshot requires review even without UI files", () => {
  const result = summarizeComparison(base, head, { status: "ahead", files: [{ filename: "doc/RELEASE.md", status: "modified" }] });
  assert.equal(result.action, "review-required");
  assert.equal(result.relevantFiles.length, 0);
});
test("comparison truncation cannot be treated as a safe update", () => {
  const result = summarizeComparison(base, head, { files: Array.from({ length: 300 }, (_, i) => ({ filename: `docs/${i}.md`, status: "modified" })) });
  assert.equal(result.fileListMayBeTruncated, true);
  assert.equal(result.action, "review-required");
});
test("runtime metadata and dependency changes enter review", () => {
  const names = ["ui/src/App.tsx", "server/src/catalog.ts", "packages/shared/src/app-definitions/foo.json", "pnpm-lock.yaml"];
  assert.equal(summarizeComparison(base, head, { files: names.map((filename) => ({ filename })) }).relevantFiles.length, 4);
});
test("malformed IDs and issue writes outside a trusted workflow refuse", async () => {
  assert.throws(() => summarizeComparison("master", head, {}), /revision/);
  const saved = process.env.GITHUB_EVENT_NAME;
  try {
    process.env.GITHUB_EVENT_NAME = "pull_request";
    await assert.rejects(checkUpstream({ issue: true }), /restricted/);
  } finally {
    if (saved === undefined) delete process.env.GITHUB_EVENT_NAME;
    else process.env.GITHUB_EVENT_NAME = saved;
  }
});
test("manual dispatch from a non-main branch refuses before network access", async () => {
  const values = { GITHUB_REPOSITORY: "DrMaks22/paperclip-localizations", GITHUB_REF: "refs/heads/feature", GITHUB_EVENT_NAME: "workflow_dispatch" };
  const saved = Object.fromEntries(Object.keys(values).map((key) => [key, process.env[key]]));
  try {
    Object.assign(process.env, values);
    await assert.rejects(checkUpstream({ issue: true }), /restricted/);
  } finally {
    for (const [key, value] of Object.entries(saved)) {
      if (value === undefined) delete process.env[key]; else process.env[key] = value;
    }
  }
});
