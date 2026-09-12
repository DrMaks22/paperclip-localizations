// Read-only release gate. Publication remains an explicit maintainer operation.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { ROOT, readLock, verifyChecksums, git, json } from "./artifacts.mjs";
import { readChannels } from "./channels.mjs";
import { validateReleaseChannel } from "./release-channel.mjs";

const UPSTREAM = "paperclipai/paperclip";
const DESTINATION = "DrMaks22/paperclip-localizations";

export function validatePreparedRelease(lock, manifest, channels) {
  validateReleaseChannel(lock);
  const selected = channels[lock.releaseChannel];
  if (!selected || manifest.kitVersion !== lock.releaseTag || manifest.ready !== true ||
      manifest.baseCommit !== lock.upstreamCommit || selected.baseCommit !== lock.upstreamCommit) {
    throw new Error("Manifest, source lock and selected channel disagree.");
  }
  for (const field of ["releaseChannel", "upstreamRef", "runtimeProfile"]) {
    if (manifest[field] !== lock[field] || selected[field] !== lock[field]) {
      throw new Error(`Release ${field} does not match the selected channel.`);
    }
  }
  if (selected.releaseTag !== lock.releaseTag) throw new Error("The selected release tag differs from source-lock.");
}

export function validateOfficialStable(release, resolvedCommit, lock) {
  if (release.tag_name !== lock.upstreamRef || release.prerelease !== false || release.draft !== false ||
      resolvedCommit !== lock.upstreamCommit) {
    throw new Error("Stable must resolve to the exact official non-prerelease Paperclip tag.");
  }
}

export function validatePublishedRelease(release, latest, lock) {
  if (release.tag_name !== lock.releaseTag || release.draft !== false ||
      release.prerelease !== (lock.releaseChannel === "beta")) {
    throw new Error("Published tag/draft/prerelease metadata disagrees with the release channel.");
  }
  if (lock.releaseChannel === "stable" && latest?.tag_name !== lock.releaseTag) {
    throw new Error("The selected stable release is not GitHub Latest.");
  }
  if (lock.releaseChannel === "beta" && latest?.tag_name === lock.releaseTag) {
    throw new Error("Beta must never be GitHub Latest.");
  }
}

async function github(resource, { optional = false } = {}) {
  const response = await fetch(`https://api.github.com/${resource}`, {
    redirect: "error", signal: AbortSignal.timeout(30_000),
    headers: { Accept: "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28",
      ...(process.env.GH_TOKEN ? { Authorization: `Bearer ${process.env.GH_TOKEN}` } : {}) },
  });
  if (optional && response.status === 404) return null;
  if (!response.ok) throw new Error(`Read-only GitHub release check failed (${response.status}).`);
  return response.json();
}

export async function checkRelease({ published = false } = {}) {
  verifyChecksums();
  const lock = readLock();
  const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, "manifest.json"), "utf8"));
  validatePreparedRelease(lock, manifest, readChannels());
  if (lock.releaseChannel === "stable") {
    const [release, commit] = await Promise.all([
      github(`repos/${UPSTREAM}/releases/tags/${encodeURIComponent(lock.upstreamRef)}`),
      github(`repos/${UPSTREAM}/commits/${encodeURIComponent(lock.upstreamRef)}`),
    ]);
    validateOfficialStable(release, commit.sha, lock);
  } else {
    const comparison = await github(`repos/${UPSTREAM}/compare/${lock.upstreamCommit}...master?per_page=1`);
    if (comparison.merge_base_commit?.sha !== lock.upstreamCommit || !["identical", "ahead"].includes(comparison.status)) {
      throw new Error("The beta base is not a verified ancestor of current upstream master.");
    }
  }
  if (published) {
    if (git(ROOT, ["status", "--porcelain=v1", "--untracked-files=all"]).length) {
      throw new Error("Published release verification requires a clean tagged checkout.");
    }
    const [release, latest, tagCommit] = await Promise.all([
      github(`repos/${DESTINATION}/releases/tags/${encodeURIComponent(lock.releaseTag)}`),
      github(`repos/${DESTINATION}/releases/latest`, { optional: true }),
      github(`repos/${DESTINATION}/commits/${encodeURIComponent(lock.releaseTag)}`),
    ]);
    validatePublishedRelease(release, latest, lock);
    if (tagCommit.sha !== git(ROOT, ["rev-parse", "HEAD"]).toString().trim()) {
      throw new Error("Run the published release check from its exact tagged checkout.");
    }
  }
  return { channel: lock.releaseChannel, tag: lock.releaseTag, upstreamRef: lock.upstreamRef,
    baseCommit: lock.upstreamCommit, publishedMetadataVerified: published, writes: false };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const args = process.argv.slice(2);
    if (args.length > 1 || (args.length && args[0] !== "--published")) throw new Error("Usage: node scripts/check-release.mjs [--published]");
    console.log(json(await checkRelease({ published: args[0] === "--published" })));
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
