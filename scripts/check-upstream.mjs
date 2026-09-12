import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { ROOT, readLock, json } from "./artifacts.mjs";

const UPSTREAM = "paperclipai/paperclip";
const DESTINATION = "DrMaks22/paperclip-localizations";
const TITLE = "Upstream changes awaiting localization review";
const MARKER = "<!-- paperclip-localizations-upstream-monitor:v1 -->";

async function api(resource, { method = "GET", body } = {}) {
  const response = await fetch(`https://api.github.com/${resource}`, {
    method, redirect: "error", signal: AbortSignal.timeout(30_000),
    headers: { Accept: "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28",
      ...(process.env.GH_TOKEN ? { Authorization: `Bearer ${process.env.GH_TOKEN}` } : {}),
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  if (!response.ok) throw new Error(`GitHub ${method} request failed (${response.status}); no compatibility state changed.`);
  return response.json();
}

export function summarizeComparison(base, head, comparison) {
  if (!/^[0-9a-f]{40}$/.test(base) || !/^[0-9a-f]{40}$/.test(head)) throw new Error("Invalid upstream revision.");
  const files = (comparison.files ?? []).map(({ filename, status }) => ({ path: filename, status }));
  const relevantFiles = files.filter(({ path: name }) => name.startsWith("ui/") ||
    name.startsWith("packages/shared/src/app-definitions") || name.startsWith("server/src/") ||
    ["package.json", "pnpm-lock.yaml", "pnpm-workspace.yaml"].includes(name));
  return {
    base, head, changed: base !== head, status: comparison.status,
    aheadBy: comparison.ahead_by ?? null, files, relevantFiles,
    // GitHub's comparison file list is capped. Never infer safety from truncation.
    fileListMayBeTruncated: files.length >= 300,
    action: base === head ? "none" : "review-required",
    compareUrl: `https://github.com/${UPSTREAM}/compare/${base}...${head}`,
  };
}

async function findOwnedIssue() {
  for (let page = 1; page <= 10; page++) {
    const issues = await api(`repos/${DESTINATION}/issues?state=open&per_page=100&page=${page}`);
    const found = issues.find((issue) => !issue.pull_request && issue.title === TITLE && issue.body?.includes(MARKER) && issue.user?.login === "github-actions[bot]");
    if (found) return found;
    if (issues.length < 100) return null;
  }
  throw new Error("Issue lookup pagination limit reached; refusing to create a possible duplicate.");
}

export async function checkUpstream({ issue = false } = {}) {
  if (issue && (process.env.GITHUB_REPOSITORY !== DESTINATION || process.env.GITHUB_REF !== "refs/heads/main" || !["schedule", "workflow_dispatch"].includes(process.env.GITHUB_EVENT_NAME))) {
    throw new Error("Issue updates are restricted to the canonical repository's scheduled/manual workflow.");
  }
  const lock = readLock();
  const headResponse = await api(`repos/${UPSTREAM}/commits/master`);
  if (!/^[0-9a-f]{40}$/.test(headResponse.sha ?? "")) throw new Error("GitHub did not return an exact commit ID.");
  const comparison = headResponse.sha === lock.upstreamCommit ? { status: "identical", files: [], ahead_by: 0 } :
    await api(`repos/${UPSTREAM}/compare/${lock.upstreamCommit}...${headResponse.sha}?per_page=1`);
  const report = summarizeComparison(lock.upstreamCommit, headResponse.sha, comparison);
  if (issue) {
    const existing = await findOwnedIssue();
    if (report.changed) {
      const body = `${MARKER}\n\nPaperclip master has changed since the locked localization base. This is a review queue, not a failed translation test or permission to force a patch.\n\n- Locked base: \`${report.base}\`\n- Current master: \`${report.head}\`\n- [Compare changes](${report.compareUrl})\n- File list may be truncated: ${report.fileListMayBeTruncated}\n\n@DrMaks22: follow [the maintenance procedure](https://github.com/${DESTINATION}/blob/main/docs/MAINTENANCE.md), inspect new UI/runtime text and dependencies, prepare isolated updates, and run the release gates. The released patch remains pinned; no code or deployment was changed by this monitor.\n`;
      if (!existing) await api(`repos/${DESTINATION}/issues`, { method: "POST", body: { title: TITLE, body } });
      else if (existing.body !== body) await api(`repos/${DESTINATION}/issues/${existing.number}`, { method: "PATCH", body: { body } });
    } else if (existing) await api(`repos/${DESTINATION}/issues/${existing.number}`, { method: "PATCH", body: { state: "closed", state_reason: "completed" } });
  }
  return report;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const args = process.argv.slice(2);
    if (args.length > 1 || (args.length === 1 && args[0] !== "--issue")) throw new Error("Usage: node scripts/check-upstream.mjs [--issue]");
    const report = await checkUpstream({ issue: args[0] === "--issue" });
    console.log(json(report));
    if (process.env.GITHUB_STEP_SUMMARY) fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, `## Upstream localization review\n\n${report.changed ? "Review required; compatibility has not been advanced." : "The locked revision matches upstream master."}\n\n[Compare](${report.compareUrl})\n`);
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
