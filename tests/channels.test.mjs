import { test } from "node:test";
import assert from "node:assert/strict";
import { readChannels, validateChannels } from "../scripts/channels.mjs";
import { validatePreparedRelease, validateOfficialStable, validatePublishedRelease } from "../scripts/check-release.mjs";

const index = () => ({ schemaVersion: 1,
  stable: { releaseChannel: "stable", releaseTag: "v2026.9.13.1", upstreamRef: "v2026.831.1", baseCommit: "a".repeat(40), runtimeProfile: "pinned-en-ru" },
  beta: { releaseChannel: "beta", releaseTag: "v2026.9.13.1-beta.1", upstreamRef: "master", baseCommit: "b".repeat(40), runtimeProfile: "community-json" },
});
const lockFor = (name) => ({ ...index()[name], upstreamCommit: index()[name].baseCommit });
const manifestFor = (lock) => ({ ...lock, kitVersion: lock.releaseTag, baseCommit: lock.upstreamCommit, ready: true });

test("checked-in channel index distinguishes stable and beta", () => {
  assert.equal(readChannels().stable.releaseChannel, "stable");
  assert.equal(readChannels().beta.releaseChannel, "beta");
});
test("channel index rejects unknown schema, malformed commits and crossed channels", () => {
  for (const mutate of [v => v.schemaVersion = 2, v => v.extra = {}, v => v.stable.baseCommit = "master",
    v => v.stable.releaseChannel = "beta", v => v.stable.upstreamRef = "master",
    v => v.beta.releaseTag = v.stable.releaseTag]) {
    const value = index(); mutate(value); assert.throws(() => validateChannels(value));
  }
});
test("prepared release must match manifest and selected channel exactly", () => {
  for (const name of ["stable", "beta"]) {
    const lock = lockFor(name); const manifest = manifestFor(lock);
    assert.doesNotThrow(() => validatePreparedRelease(lock, manifest, index()));
    for (const [field, value] of [["baseCommit", "c".repeat(40)], ["kitVersion", "wrong"], ["ready", false],
      ["releaseChannel", "other"], ["runtimeProfile", "other"], ["upstreamRef", "other"]]) {
      assert.throws(() => validatePreparedRelease(lock, { ...manifest, [field]: value }, index()));
    }
  }
});
test("official stable cannot be a prerelease, draft, different tag or retargeted commit", () => {
  const lock = lockFor("stable"); const release = { tag_name: lock.upstreamRef, prerelease: false, draft: false };
  assert.doesNotThrow(() => validateOfficialStable(release, lock.upstreamCommit, lock));
  for (const changed of [{ prerelease: true }, { draft: true }, { tag_name: "master" }]) {
    assert.throws(() => validateOfficialStable({ ...release, ...changed }, lock.upstreamCommit, lock));
  }
  assert.throws(() => validateOfficialStable(release, "c".repeat(40), lock));
});
test("GitHub beta flag and Latest selection cannot contradict channel", () => {
  const stable = lockFor("stable"); const beta = lockFor("beta");
  const release = (lock) => ({ tag_name: lock.releaseTag, prerelease: lock.releaseChannel === "beta", draft: false });
  assert.doesNotThrow(() => validatePublishedRelease(release(stable), release(stable), stable));
  assert.doesNotThrow(() => validatePublishedRelease(release(beta), release(stable), beta));
  assert.throws(() => validatePublishedRelease(release(beta), release(beta), beta));
  assert.throws(() => validatePublishedRelease(release(stable), release(beta), stable));
  assert.throws(() => validatePublishedRelease({ ...release(beta), prerelease: false }, release(stable), beta));
  assert.throws(() => validatePublishedRelease({ ...release(stable), draft: true }, release(stable), stable));
});
