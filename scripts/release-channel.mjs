/** Shared release identity checks. A channel never widens commit compatibility. */
export function validateReleaseChannel(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Release metadata must be an object.");
  }
  for (const field of ["releaseChannel", "releaseTag", "upstreamRef", "runtimeProfile"]) {
    if (!Object.hasOwn(value, field) || typeof value[field] !== "string") {
      throw new Error(`Release metadata requires a string ${field}.`);
    }
  }
  const { releaseChannel, releaseTag, upstreamRef, runtimeProfile } = value;
  if (!["stable", "beta"].includes(releaseChannel)) throw new Error("releaseChannel must be stable or beta.");
  if (!["community-json", "pinned-en-ru"].includes(runtimeProfile)) throw new Error("Unknown runtimeProfile.");
  const tag = /^v(\d{4})\.([1-9]\d?)\.([1-9]\d?)\.([1-9]\d*)(?:-beta\.([1-9]\d*))?$/.exec(releaseTag);
  if (!tag || tag[0] !== releaseTag) throw new Error("Invalid releaseTag; expected vYYYY.M.D.N or vYYYY.M.D.N-beta.N.");
  const [, year, month, day, revision, betaRevision] = tag;
  const date = new Date(0);
  date.setUTCFullYear(Number(year), Number(month) - 1, Number(day));
  if (Number(year) < 1 || date.getUTCFullYear() !== Number(year) || date.getUTCMonth() !== Number(month) - 1 ||
      date.getUTCDate() !== Number(day) || !Number.isSafeInteger(Number(revision)) ||
      (betaRevision !== undefined && !Number.isSafeInteger(Number(betaRevision)))) {
    throw new Error("Invalid releaseTag date or revision.");
  }
  if ((releaseChannel === "beta") !== (betaRevision !== undefined)) {
    throw new Error("releaseChannel and releaseTag prerelease suffix disagree.");
  }
  const officialTag = /^v(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)$/.exec(upstreamRef);
  if (releaseChannel === "stable" ? !officialTag || officialTag[0] !== upstreamRef : upstreamRef !== "master") {
    throw new Error("Stable upstreamRef must be an official version tag; beta upstreamRef must be master.");
  }
  return value;
}
