/** Maintainer smoke check. Creates a temporary synthetic Arabic catalog only;
 * it is never placed in the distribution's locales/ or release artifacts.
 * Reuses the supplied checkout's installed dependencies without installation.
 */
import { cp, mkdir, mkdtemp, readFile, realpath, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { assertSafePath, loadCatalogs } from "../scripts/catalogs.mjs";
import { prepareLocales } from "../scripts/prepare-locales.mjs";
import { EXACT_EDITS, TEMPLATE_TARGETS } from "./overlays.mjs";
import { localeKeyReferences } from "./locale-validation.mjs";

function syntheticArabic(reference) {
  if (typeof reference === "string") return `[اختبار] ${reference}`;
  return Object.fromEntries([...localeKeyReferences(reference, "ar")]
    .map(([key, referenceKey]) => [key, syntheticArabic(reference[referenceKey])]));
}

const args = process.argv.slice(2);
if (args.length !== 2 || args[0] !== "--source" || !path.isAbsolute(args[1])) {
  console.error("Usage: node runtime/verify-three-locales.mjs --source ABSOLUTE_REVIEWED_CHECKOUT");
  process.exitCode = 1;
} else {
  const source = args[1];
  const fixture = await mkdtemp(path.join(await realpath(tmpdir()), "paperclip-three-locales-"));
  try {
    await assertSafePath(source, { directory: true });
    const checkout = path.join(fixture, "checkout");
    const catalogRoot = path.join(fixture, "catalogs");
    await mkdir(path.join(catalogRoot, "locales"), { recursive: true });
    const catalogs = await loadCatalogs();
    for (const entry of catalogs.filter(({ locale }) => ["en", "ru"].includes(locale))) {
      await writeFile(path.join(catalogRoot, "locales", `${entry.locale}.json`), JSON.stringify(entry.messages));
    }
    await writeFile(path.join(catalogRoot, "locales/ar.json"), JSON.stringify(syntheticArabic(catalogs[0].messages)));
    const files = [
      ...TEMPLATE_TARGETS.map(({ path }) => path), ...EXACT_EDITS.map(({ path }) => path),
      "ui/src/i18n/index.ts", "ui/src/i18n/locale-validation.ts", "ui/src/i18n/locale-structure.ts",
      "ui/src/lib/utils.ts", "ui/vitest.config.ts", "ui/vitest.setup.ts", "ui/package.json",
    ];
    for (const file of files) {
      const destination = path.join(checkout, file);
      await mkdir(path.dirname(destination), { recursive: true });
      await cp(path.join(source, file), destination);
    }
    // An incomplete upstream-style scaffold must survive preparation and stay
    // absent from both the explicit registry and i18next's loaded resources.
    const scaffold = path.join(checkout, "ui/src/i18n/locales/fr.json");
    await mkdir(path.dirname(scaffold), { recursive: true });
    await writeFile(scaffold, JSON.stringify({ scaffoldOnly: "Unreviewed fixture" }));
    await prepareLocales({ target: checkout, root: catalogRoot });
    if (JSON.parse(await readFile(scaffold, "utf8")).scaffoldOnly !== "Unreviewed fixture") {
      throw new Error("Preparation unexpectedly changed the unregistered scaffold fixture");
    }
    await writeFile(path.join(checkout, "package.json"), JSON.stringify({ private: true, type: "module" }));
    await symlink(path.join(source, "node_modules"), path.join(checkout, "node_modules"), "dir");
    await symlink(path.join(source, "ui/node_modules"), path.join(checkout, "ui/node_modules"), "dir");
    // Resolve the executable script through Node, without a shell or install.
    const vitestPackage = JSON.parse(await readFile(path.join(source, "node_modules/vitest/package.json"), "utf8"));
    const bin = typeof vitestPackage.bin === "string" ? vitestPackage.bin : vitestPackage.bin.vitest;
    const result = spawnSync(process.execPath, [path.join(source, "node_modules/vitest", bin), "run", "--config", "vitest.config.ts", "src/i18n/community-locales.test.tsx", "src/i18n/locale-sync.test.ts"], {
      cwd: path.join(checkout, "ui"), stdio: "inherit", timeout: 120_000,
    });
    if (result.error) throw result.error;
    process.exitCode = result.status ?? 1;
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  } finally {
    await rm(fixture, { recursive: true, force: true });
  }
}
