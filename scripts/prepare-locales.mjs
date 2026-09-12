import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { assertSafePath, loadCatalogs, REPOSITORY_ROOT } from "./catalogs.mjs";
import {
  applyExactOverlay, assertSourceHash, EXACT_EDITS, GENERATED_TEST_TARGET,
  RUNTIME_OVERLAY_PATHS, TEMPLATE_TARGETS,
} from "../runtime/overlays.mjs";

export { RUNTIME_OVERLAY_PATHS };

export function renderLocaleRegistry(template, catalogs) {
  const imports = catalogs.map(({ locale }, index) => `import catalog${index} from "./locales/${locale}.json";`).join("\n");
  const entries = catalogs.map(({ locale }, index) => `${JSON.stringify(locale)}: catalog${index}`).join(", ");
  return template.replace("/* CATALOG_IMPORTS */", imports)
    .replace("/* SUPPORTED_LOCALES */", JSON.stringify(catalogs.map(({ locale }) => locale)))
    .replace("/* CATALOG_ENTRIES */", entries);
}

/** Stage only in the builder's disposable, already-localized checkout.
 * Preflight ALL reads, source hashes and paths before performing any writes.
 * Never enumerate or delete the target's scaffold catalog folder.
 */
export async function prepareLocales({ target, root = REPOSITORY_ROOT }) {
  if (!target || !path.isAbsolute(target)) throw new Error("--target must be an absolute disposable checkout path");
  target = path.resolve(target);
  root = path.resolve(root);
  if (target === root || target === path.parse(target).root) throw new Error("Target must be a separate disposable checkout");
  await assertSafePath(target, { directory: true });
  const catalogs = await loadCatalogs(root);
  const writes = [];
  const runtime = path.join(REPOSITORY_ROOT, "runtime");
  for (const overlay of TEMPLATE_TARGETS) {
    const destination = path.join(target, overlay.path);
    await assertSafePath(destination, { writable: true });
    const current = await readFile(destination, "utf8");
    assertSourceHash(current, overlay);
    const template = await readFile(path.join(runtime, overlay.template), "utf8");
    writes.push({ path: overlay.path, content: overlay.template === "locales.ts.template" ? renderLocaleRegistry(template, catalogs) : template });
  }
  for (const overlay of EXACT_EDITS) {
    const destination = path.join(target, overlay.path);
    await assertSafePath(destination, { writable: true });
    writes.push({ path: overlay.path, content: applyExactOverlay(await readFile(destination, "utf8"), overlay) });
  }
  for (const { locale, messages } of catalogs) {
    const filename = `ui/src/i18n/locales/${locale}.json`;
    await assertSafePath(path.join(target, filename), { allowMissing: true, writable: true });
    writes.push({ path: filename, content: `${JSON.stringify(messages, null, 2)}\n` });
  }
  const testDestination = path.join(target, GENERATED_TEST_TARGET);
  await assertSafePath(testDestination, { allowMissing: true, writable: true });
  try {
    await readFile(testDestination);
    throw new Error(`Refusing to overwrite a preexisting generated test: ${GENERATED_TEST_TARGET}`);
  } catch (error) { if (error.code !== "ENOENT") throw error; }
  const testTemplate = await readFile(path.join(runtime, "community-locales.test.tsx"), "utf8");
  writes.push({
    path: GENERATED_TEST_TARGET,
    content: testTemplate.replace('/* PREPARED_CATALOG_LOCALES */ ["en", "ru"]', JSON.stringify(catalogs.map(({ locale }) => locale))),
  });
  for (const entry of writes) {
    const destination = path.join(target, entry.path);
    await mkdir(path.dirname(destination), { recursive: true });
    await writeFile(destination, entry.content, "utf8");
  }
  return { locales: catalogs.map(({ locale }) => locale), paths: writes.map(({ path }) => path) };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const args = process.argv.slice(2);
    if (args.length !== 2 || args[0] !== "--target") throw new Error("Usage: node scripts/prepare-locales.mjs --target ABSOLUTE_DISPOSABLE_CHECKOUT");
    console.log(JSON.stringify(await prepareLocales({ target: args[1] }), null, 2));
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
