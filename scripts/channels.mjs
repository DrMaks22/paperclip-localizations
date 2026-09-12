import fs from "node:fs";
import path from "node:path";
import { ROOT } from "./artifacts.mjs";
import { validateReleaseChannel } from "./release-channel.mjs";

export function validateChannels(value) {
  if (!value || value.schemaVersion !== 1 || Object.keys(value).sort().join() !== "beta,schemaVersion,stable") {
    throw new Error("Invalid channel index schema.");
  }
  for (const name of ["stable", "beta"]) {
    const entry = value[name];
    validateReleaseChannel(entry);
    if (entry.releaseChannel !== name || !/^[0-9a-f]{40}$/.test(entry.baseCommit ?? "")) {
      throw new Error("Channel index requires matching channel names and exact base commits.");
    }
  }
  if (value.stable.releaseTag === value.beta.releaseTag) {
    throw new Error("Stable and beta require distinct localization releases.");
  }
  return value;
}

export function readChannels(root = ROOT) {
  return validateChannels(JSON.parse(fs.readFileSync(path.join(root, "channels.json"), "utf8")));
}
