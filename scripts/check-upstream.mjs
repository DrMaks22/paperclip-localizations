import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { json } from "./artifacts.mjs";
import { readChannels } from "./channels.mjs";

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

export function summarizeStable(selected, release, commit) {
  if (release.prerelease !== false || release.draft !== false ||
      !/^v\d+\.\d+\.\d+$/.test(release.tag_name ?? "") || !/^[0-9a-f]{40}$/.test(commit.sha ?? "")) {
    throw new Error("GitHub did not return a valid official stable release and exact commit.");
  }
  return { supportedTag: selected.upstreamRef, latestTag: release.tag_name, base: selected.baseCommit, head: commit.sha,
    changed: selected.upstreamRef !== release.tag_name || selected.baseCommit !== commit.sha,
    releaseUrl: `https://github.com/${UPSTREAM}/releases/tag/${encodeURIComponent(release.tag_name)}` };
}

export async function checkUpstream({ issue = false } = {}) {
  if (issue && (process.env.GITHUB_REPOSITORY !== DESTINATION || process.env.GITHUB_REF !== "refs/heads/main" || !["schedule", "workflow_dispatch"].includes(process.env.GITHUB_EVENT_NAME))) {
    throw new Error("Issue updates are restricted to the canonical repository's scheduled/manual workflow.");
  }
  const channels = readChannels();
  const [headResponse, latestStable] = await Promise.all([
    api(`repos/${UPSTREAM}/commits/master`), api(`repos/${UPSTREAM}/releases/latest`),
  ]);
  if (!/^[0-9a-f]{40}$/.test(headResponse.sha ?? "")) throw new Error("GitHub did not return an exact commit ID.");
  if (typeof latestStable.tag_name !== "string") throw new Error("GitHub stable release has no tag.");
  const [comparison, stableCommit] = await Promise.all([
    headResponse.sha === channels.beta.baseCommit ? { status: "identical", files: [], ahead_by: 0 } :
      api(`repos/${UPSTREAM}/compare/${channels.beta.baseCommit}...${headResponse.sha}?per_page=1`),
    api(`repos/${UPSTREAM}/commits/${encodeURIComponent(latestStable.tag_name)}`),
  ]);
  const report = summarizeComparison(channels.beta.baseCommit, headResponse.sha, comparison);
  report.betaChanged = report.changed;
  report.stable = summarizeStable(channels.stable, latestStable, stableCommit);
  report.changed = report.betaChanged || report.stable.changed;
  report.action = report.changed ? "review-required" : "none";
  if (issue) {
    const existing = await findOwnedIssue();
    if (report.changed) {
      const body = `${MARKER}\n\nPaperclip has changes awaiting channel-specific review. This is a review queue, not a failed translation test or permission to force a patch.\n\n## Stable\n- Supported: \`${report.stable.supportedTag}\` at \`${report.stable.base}\`\n- [Latest official stable](${report.stable.releaseUrl}): \`${report.stable.latestTag}\` at \`${report.stable.head}\`\n- Review required: ${report.stable.changed}\n\n## Beta / master\n- Locked snapshot: \`${report.base}\`\n- Current master: \`${report.head}\`\n- Review required: ${report.betaChanged}\n- [Compare changes](${report.compareUrl})\n- File list may be truncated: ${report.fileListMayBeTruncated}\n\n@DrMaks22: follow [the maintenance procedure](https://github.com/${DESTINATION}/blob/main/docs/MAINTENANCE.md), inspect new UI/runtime text and dependencies, prepare separate stable/beta branches, and run the release gates. Never promote master to stable by relabeling it. Released patches remain pinned; no code or deployment was changed by this monitor.\n`;
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
    if (process.env.GITHUB_STEP_SUMMARY) fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, `## Upstream localization review\n\nStable review required: ${report.stable.changed}. Beta review required: ${report.betaChanged}. Compatibility has not been advanced.\n\n[Master comparison](${report.compareUrl}) · [Official stable](${report.stable.releaseUrl})\n`);
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
